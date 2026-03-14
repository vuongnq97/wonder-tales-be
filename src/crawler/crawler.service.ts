import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as dns from 'dns';
import { PrismaService } from '../prisma/prisma.service';

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

const CATEGORIES: CategoryConfig[] = [
    {
        name: 'Cổ tích Việt Nam',
        slug: 'co-tich-viet-nam',
        url: 'https://truyencotich.vn/danh-muc/truyen-co-tich/co-tich-viet-nam',
    },
    {
        name: 'Cổ tích Thế giới',
        slug: 'co-tich-the-gioi',
        url: 'https://truyencotich.vn/danh-muc/truyen-co-tich/co-tich-the-gioi',
    },
];

const DELAY_MS = 500;

// Custom DNS lookup to resolve truyencotich.vn
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customLookup = (hostname: string, options: any, callback: any) => {
    if (hostname === 'truyencotich.vn') {
        if (typeof options === 'function') {
            options(null, '103.77.162.39', 4);
        } else if (options?.all) {
            callback(null, [{ address: '103.77.162.39', family: 4 }]);
        } else {
            callback(null, '103.77.162.39', 4);
        }
    } else {
        dns.lookup(hostname, options, callback);
    }
};

@Injectable()
export class CrawlerService {
    private readonly logger = new Logger(CrawlerService.name);
    private readonly httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        lookup: customLookup,
    });

    constructor(private readonly prisma: PrismaService) { }

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

    /**
     * Crawl a category listing page and return all story URLs.
     * Follows pagination links (page/2, page/3, etc.)
     */
    async crawlCategoryPages(categoryUrl: string): Promise<string[]> {
        const storyUrls: string[] = [];
        let currentUrl: string | null = categoryUrl;

        while (currentUrl) {
            this.logger.log(`Crawling category page: ${currentUrl}`);
            const html = await this.fetchHtml(currentUrl);
            const $ = cheerio.load(html);

            // Extract story links from article titles
            $('article h2 a, .post-title a, h2.post-box-title a').each((_, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('.html')) {
                    const fullUrl = href.startsWith('http')
                        ? href
                        : `https://truyencotich.vn${href}`;
                    if (!storyUrls.includes(fullUrl)) {
                        storyUrls.push(fullUrl);
                    }
                }
            });

            // Also try broader selectors for story links
            $(
                '.post-listing .post-box-title a, .all-posts-title a, .entry-title a',
            ).each((_, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('.html')) {
                    const fullUrl = href.startsWith('http')
                        ? href
                        : `https://truyencotich.vn${href}`;
                    if (!storyUrls.includes(fullUrl)) {
                        storyUrls.push(fullUrl);
                    }
                }
            });

            // If selectors above don't work, try getting all links within the main content
            if (storyUrls.length === 0) {
                $(
                    '#main-content a[href*=".html"], .main-content a[href*=".html"], #tie-wrapper a[href*="truyen-co-tich"]',
                ).each((_, el) => {
                    const href = $(el).attr('href');
                    if (
                        href &&
                        href.includes('.html') &&
                        !href.includes('danh-muc') &&
                        !href.includes('tag/')
                    ) {
                        const fullUrl = href.startsWith('http')
                            ? href
                            : `https://truyencotich.vn${href}`;
                        if (!storyUrls.includes(fullUrl)) {
                            storyUrls.push(fullUrl);
                        }
                    }
                });
            }

            // Check for next page link
            const nextLink = $('a.next, a[rel="next"], .pages a:last-child').attr(
                'href',
            );
            if (
                nextLink &&
                nextLink !== currentUrl &&
                nextLink.includes('/page/')
            ) {
                currentUrl = nextLink.startsWith('http')
                    ? nextLink
                    : `https://truyencotich.vn${nextLink}`;
                await this.delay(DELAY_MS);
            } else {
                // Also try "← Older posts" style links
                const olderLink = $('a:contains("Older"), a:contains("older"), .older-posts a, .nav-previous a').attr('href');
                if (olderLink && olderLink !== currentUrl) {
                    currentUrl = olderLink.startsWith('http')
                        ? olderLink
                        : `https://truyencotich.vn${olderLink}`;
                    await this.delay(DELAY_MS);
                } else {
                    currentUrl = null;
                }
            }
        }

        this.logger.log(`Found ${storyUrls.length} story URLs`);
        return storyUrls;
    }

    /**
     * Crawl a single story page and extract content.
     */
    async crawlStoryPage(url: string): Promise<CrawledStory | null> {
        try {
            const html = await this.fetchHtml(url);
            const $ = cheerio.load(html);

            // Extract title
            const title =
                $('h1.post-title, h1.entry-title, .post-header h1, article h1')
                    .first()
                    .text()
                    .trim() ||
                $('h1').first().text().trim() ||
                $('title').text().replace(/ - .*$/, '').trim();

            if (!title) {
                this.logger.warn(`No title found for ${url}`);
                return null;
            }

            // Extract content
            const contentEl = $(
                '.entry-content, .post-content, .entry, article .content, .post-inner .entry',
            ).first();

            // Remove unwanted elements
            contentEl.find(
                'script, style, .social-share, .post-tags, .related-posts, .comments, .navigation, ins, .adsbygoogle',
            ).remove();

            const content = contentEl.html()?.trim() || '';

            if (!content) {
                this.logger.warn(`No content found for ${url}`);
                return null;
            }

            // Extract excerpt (first paragraph text)
            const excerpt =
                contentEl.find('p').first().text().trim().substring(0, 300) || '';

            // Extract thumbnail
            const thumbnail =
                $('meta[property="og:image"]').attr('content') ||
                contentEl.find('img').first().attr('src') ||
                null;

            // Extract tags
            const tags: string[] = [];
            $(
                '.post-tags a, .tagcloud a, .tags a, a[rel="tag"], .post-tag a',
            ).each((_, el) => {
                const tag = $(el).text().trim();
                if (tag) tags.push(tag);
            });

            // Generate slug from URL
            const slug = url
                .replace(/\.html$/, '')
                .split('/')
                .pop() || '';

            return {
                title,
                slug,
                excerpt,
                content,
                thumbnail,
                tags,
                sourceUrl: url,
            };
        } catch (error) {
            this.logger.error(`Failed to crawl story: ${url}`, error);
            return null;
        }
    }

    /**
     * Run full crawl: all categories → all stories → save to DB
     */
    async crawlAll(): Promise<{
        totalCategories: number;
        totalStories: number;
        newStories: number;
        errors: number;
    }> {
        let totalStories = 0;
        let newStories = 0;
        let errors = 0;

        for (const cat of CATEGORIES) {
            this.logger.log(`=== Crawling category: ${cat.name} ===`);

            // Upsert category
            const category = await this.prisma.category.upsert({
                where: { slug: cat.slug },
                create: { name: cat.name, slug: cat.slug },
                update: { name: cat.name },
            });

            // Get all story URLs
            const storyUrls = await this.crawlCategoryPages(cat.url);
            totalStories += storyUrls.length;

            for (const url of storyUrls) {
                // Check if already crawled
                const existing = await this.prisma.story.findUnique({
                    where: { sourceUrl: url },
                });

                if (existing) {
                    this.logger.debug(`Skipping (already exists): ${url}`);
                    continue;
                }

                await this.delay(DELAY_MS);
                const story = await this.crawlStoryPage(url);

                if (!story) {
                    errors++;
                    continue;
                }

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
                            categoryId: category.id,
                        },
                    });
                    newStories++;
                    this.logger.log(`✅ Saved: ${story.title}`);
                } catch (dbError) {
                    // Handle slug conflicts by appending a random suffix
                    try {
                        await this.prisma.story.create({
                            data: {
                                title: story.title,
                                slug: `${story.slug}-${Date.now()}`,
                                excerpt: story.excerpt,
                                content: story.content,
                                thumbnail: story.thumbnail,
                                tags: story.tags,
                                sourceUrl: story.sourceUrl,
                                categoryId: category.id,
                            },
                        });
                        newStories++;
                        this.logger.log(`✅ Saved (with suffix): ${story.title}`);
                    } catch (finalError) {
                        errors++;
                        this.logger.error(`❌ Failed to save: ${story.title}`, finalError);
                    }
                }
            }
        }

        const result = {
            totalCategories: CATEGORIES.length,
            totalStories,
            newStories,
            errors,
        };
        this.logger.log(`=== Crawl complete ===`, result);
        return result;
    }
}
