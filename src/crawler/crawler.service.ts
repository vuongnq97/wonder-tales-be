import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as dns from 'dns';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

// ─── Interfaces ───────────────────────────────────────────

interface CrawledStory {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    thumbnail: string | null;
    tags: string[];
    sourceUrl: string;
}

interface CategoryConfig {
    name: string;
    slug: string;
    url: string;
}

interface SourceSelectors {
    storyLinks: string;
    storyLinksFallback?: string;
    pagination: string;
    paginationOlder?: string;
    title: string;
    content: string;
    thumbnail: string;
    tags: string;
    removeFromContent: string;
}

interface CrawlSource {
    domain: string;
    name: string;
    baseUrl: string;
    dnsIp?: string;
    categories: CategoryConfig[];
    selectors: SourceSelectors;
    storyUrlPattern: string;
    storyUrlExclude?: string[];
}

// ─── Dynamic DNS ──────────────────────────────────────────

function loadSources(): CrawlSource[] {
    // Try multiple paths: dist (prod) and src (dev)
    const candidates = [
        path.join(__dirname, 'sources.json'),
        path.join(process.cwd(), 'src', 'crawler', 'sources.json'),
        path.join(process.cwd(), 'dist', 'src', 'crawler', 'sources.json'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8');
            return JSON.parse(raw);
        }
    }
    throw new Error(
        `sources.json not found. Tried: ${candidates.join(', ')}`,
    );
}

function buildDnsMap(sources: CrawlSource[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const src of sources) {
        if (src.dnsIp) {
            map[src.domain] = src.dnsIp;
        }
    }
    return map;
}

function createCustomLookup(dnsMap: Record<string, string>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (hostname: string, options: any, callback: any) => {
        if (dnsMap[hostname]) {
            const ip = dnsMap[hostname];
            if (typeof options === 'function') {
                options(null, ip, 4);
            } else if (options?.all) {
                callback(null, [{ address: ip, family: 4 }]);
            } else {
                callback(null, ip, 4);
            }
        } else {
            dns.lookup(hostname, options, callback);
        }
    };
}

const DELAY_MS = 500;

// ─── Service ──────────────────────────────────────────────

@Injectable()
export class CrawlerService {
    private readonly logger = new Logger(CrawlerService.name);
    private readonly sources: CrawlSource[];
    private readonly httpsAgent: https.Agent;

    constructor(private readonly prisma: PrismaService) {
        this.sources = loadSources();
        const dnsMap = buildDnsMap(this.sources);
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            lookup: createCustomLookup(dnsMap),
        });
        this.logger.log(
            `Loaded ${this.sources.length} crawl source(s): ${this.sources.map((s) => s.domain).join(', ')}`,
        );
    }

    // ─── Helpers ────────────────────────────────────────────

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async fetchHtml(url: string): Promise<string> {
        const { data } = await axios.get<string>(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
            },
            timeout: 15000,
            httpsAgent: this.httpsAgent,
        });
        return data;
    }

    private resolveUrl(href: string, baseUrl: string): string {
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return `${baseUrl}${href}`;
        return `${baseUrl}/${href}`;
    }

    // ─── Category Crawling ──────────────────────────────────

    async crawlCategoryPages(
        categoryUrl: string,
        source: CrawlSource,
    ): Promise<string[]> {
        const storyUrls: string[] = [];
        let currentUrl: string | null = categoryUrl;
        const { selectors, storyUrlPattern, storyUrlExclude = [] } = source;

        while (currentUrl) {
            this.logger.log(`Crawling category page: ${currentUrl}`);
            const html = await this.fetchHtml(currentUrl);
            const $ = cheerio.load(html);

            // Extract story links using configured selectors
            $(selectors.storyLinks).each((_, el) => {
                const href = $(el).attr('href');
                if (href && href.includes(storyUrlPattern)) {
                    const fullUrl = this.resolveUrl(href, source.baseUrl);
                    if (!storyUrls.includes(fullUrl)) {
                        storyUrls.push(fullUrl);
                    }
                }
            });

            // Fallback selectors
            if (storyUrls.length === 0 && selectors.storyLinksFallback) {
                $(selectors.storyLinksFallback).each((_, el) => {
                    const href = $(el).attr('href');
                    if (href && href.includes(storyUrlPattern)) {
                        const excluded = storyUrlExclude.some((ex) =>
                            href.includes(ex),
                        );
                        if (!excluded) {
                            const fullUrl = this.resolveUrl(href, source.baseUrl);
                            if (!storyUrls.includes(fullUrl)) {
                                storyUrls.push(fullUrl);
                            }
                        }
                    }
                });
            }

            // Check for next page
            const nextLink = $(selectors.pagination).attr('href');
            if (
                nextLink &&
                nextLink !== currentUrl &&
                nextLink.includes('/page/')
            ) {
                currentUrl = this.resolveUrl(nextLink, source.baseUrl);
                await this.delay(DELAY_MS);
            } else if (selectors.paginationOlder) {
                const olderLink = $(selectors.paginationOlder).attr('href');
                if (olderLink && olderLink !== currentUrl) {
                    currentUrl = this.resolveUrl(olderLink, source.baseUrl);
                    await this.delay(DELAY_MS);
                } else {
                    currentUrl = null;
                }
            } else {
                currentUrl = null;
            }
        }

        this.logger.log(`Found ${storyUrls.length} story URLs`);
        return storyUrls;
    }

    // ─── Story Crawling ─────────────────────────────────────

    async crawlStoryPage(
        url: string,
        source: CrawlSource,
    ): Promise<CrawledStory | null> {
        try {
            const html = await this.fetchHtml(url);
            const $ = cheerio.load(html);
            const { selectors } = source;

            // Title
            const title =
                $(selectors.title).first().text().trim() ||
                $('h1').first().text().trim() ||
                $('title').text().replace(/ - .*$/, '').trim();

            if (!title) {
                this.logger.warn(`No title found for ${url}`);
                return null;
            }

            // Content
            const contentEl = $(selectors.content).first();
            contentEl.find(selectors.removeFromContent).remove();
            const content = contentEl.html()?.trim() || '';

            if (!content) {
                this.logger.warn(`No content found for ${url}`);
                return null;
            }

            // Excerpt
            const excerpt =
                contentEl.find('p').first().text().trim().substring(0, 300) || '';

            // Thumbnail
            const thumbnail =
                $(selectors.thumbnail).attr('content') ||
                contentEl.find('img').first().attr('src') ||
                null;

            // Tags
            const tags: string[] = [];
            $(selectors.tags).each((_, el) => {
                const tag = $(el).text().trim();
                if (tag) tags.push(tag);
            });

            // Slug from URL
            const slug =
                url
                    .replace(/\.html$/, '')
                    .replace(/\/$/, '')
                    .split('/')
                    .pop() || '';

            return { title, slug, excerpt, content, thumbnail, tags, sourceUrl: url };
        } catch (error) {
            this.logger.error(`Failed to crawl story: ${url}`, error);
            return null;
        }
    }

    // ─── Save Story ─────────────────────────────────────────

    private async saveStory(
        story: CrawledStory,
        categoryId: string,
    ): Promise<boolean> {
        try {
            await this.prisma.story.create({
                data: {
                    title: story.title,
                    slug: story.slug,
                    excerpt: story.excerpt,
                    content: story.content,
                    thumbnail: story.thumbnail,
                    tags: story.tags,
                    sourceUrl: story.sourceUrl,
                    categoryId,
                },
            });
            this.logger.log(`✅ Saved: ${story.title}`);
            return true;
        } catch {
            // Slug or sourceUrl conflict → try with suffix
            try {
                await this.prisma.story.create({
                    data: {
                        ...story,
                        slug: `${story.slug}-${Date.now()}`,
                        categoryId,
                    },
                });
                this.logger.log(`✅ Saved (suffix): ${story.title}`);
                return true;
            } catch (finalError) {
                this.logger.error(`❌ Failed to save: ${story.title}`, finalError);
                return false;
            }
        }
    }

    // ─── Crawl One Source ────────────────────────────────────

    async crawlSource(source: CrawlSource) {
        this.logger.log(`\n========== Crawling: ${source.name} (${source.domain}) ==========`);
        let totalStories = 0;
        let newStories = 0;
        let errors = 0;

        for (const cat of source.categories) {
            this.logger.log(`--- Category: ${cat.name} ---`);

            const category = await this.prisma.category.upsert({
                where: { slug: cat.slug },
                create: { name: cat.name, slug: cat.slug },
                update: { name: cat.name },
            });

            const storyUrls = await this.crawlCategoryPages(cat.url, source);
            totalStories += storyUrls.length;

            for (const url of storyUrls) {
                const existing = await this.prisma.story.findUnique({
                    where: { sourceUrl: url },
                });
                if (existing) continue;

                await this.delay(DELAY_MS);
                const story = await this.crawlStoryPage(url, source);
                if (!story) {
                    errors++;
                    continue;
                }

                const saved = await this.saveStory(story, category.id);
                if (saved) newStories++;
                else errors++;
            }
        }

        return { source: source.domain, totalStories, newStories, errors };
    }

    // ─── Crawl All Sources ──────────────────────────────────

    async crawlAll() {
        const results = [];
        for (const source of this.sources) {
            const result = await this.crawlSource(source);
            results.push(result);
        }

        const summary = {
            totalSources: this.sources.length,
            totalStories: results.reduce((s, r) => s + r.totalStories, 0),
            newStories: results.reduce((s, r) => s + r.newStories, 0),
            errors: results.reduce((s, r) => s + r.errors, 0),
            details: results,
        };
        this.logger.log(`=== Crawl complete ===`, summary);
        return summary;
    }

    // ─── Get Sources (for API) ──────────────────────────────

    getSources(): CrawlSource[] {
        return this.sources;
    }
}
