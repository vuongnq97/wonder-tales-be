"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var CrawlerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const https = __importStar(require("https"));
const dns = __importStar(require("dns"));
const prisma_service_1 = require("../prisma/prisma.service");
const CATEGORIES = [
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
const customLookup = (hostname, options, callback) => {
    if (hostname === 'truyencotich.vn') {
        if (typeof options === 'function') {
            options(null, '103.77.162.39', 4);
        }
        else if (options?.all) {
            callback(null, [{ address: '103.77.162.39', family: 4 }]);
        }
        else {
            callback(null, '103.77.162.39', 4);
        }
    }
    else {
        dns.lookup(hostname, options, callback);
    }
};
let CrawlerService = CrawlerService_1 = class CrawlerService {
    prisma;
    logger = new common_1.Logger(CrawlerService_1.name);
    httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        lookup: customLookup,
    });
    constructor(prisma) {
        this.prisma = prisma;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async fetchHtml(url) {
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
            },
            timeout: 15000,
            httpsAgent: this.httpsAgent,
        });
        return data;
    }
    async crawlCategoryPages(categoryUrl) {
        const storyUrls = [];
        let currentUrl = categoryUrl;
        while (currentUrl) {
            this.logger.log(`Crawling category page: ${currentUrl}`);
            const html = await this.fetchHtml(currentUrl);
            const $ = cheerio.load(html);
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
            $('.post-listing .post-box-title a, .all-posts-title a, .entry-title a').each((_, el) => {
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
            if (storyUrls.length === 0) {
                $('#main-content a[href*=".html"], .main-content a[href*=".html"], #tie-wrapper a[href*="truyen-co-tich"]').each((_, el) => {
                    const href = $(el).attr('href');
                    if (href &&
                        href.includes('.html') &&
                        !href.includes('danh-muc') &&
                        !href.includes('tag/')) {
                        const fullUrl = href.startsWith('http')
                            ? href
                            : `https://truyencotich.vn${href}`;
                        if (!storyUrls.includes(fullUrl)) {
                            storyUrls.push(fullUrl);
                        }
                    }
                });
            }
            const nextLink = $('a.next, a[rel="next"], .pages a:last-child').attr('href');
            if (nextLink &&
                nextLink !== currentUrl &&
                nextLink.includes('/page/')) {
                currentUrl = nextLink.startsWith('http')
                    ? nextLink
                    : `https://truyencotich.vn${nextLink}`;
                await this.delay(DELAY_MS);
            }
            else {
                const olderLink = $('a:contains("Older"), a:contains("older"), .older-posts a, .nav-previous a').attr('href');
                if (olderLink && olderLink !== currentUrl) {
                    currentUrl = olderLink.startsWith('http')
                        ? olderLink
                        : `https://truyencotich.vn${olderLink}`;
                    await this.delay(DELAY_MS);
                }
                else {
                    currentUrl = null;
                }
            }
        }
        this.logger.log(`Found ${storyUrls.length} story URLs`);
        return storyUrls;
    }
    async crawlStoryPage(url) {
        try {
            const html = await this.fetchHtml(url);
            const $ = cheerio.load(html);
            const title = $('h1.post-title, h1.entry-title, .post-header h1, article h1')
                .first()
                .text()
                .trim() ||
                $('h1').first().text().trim() ||
                $('title').text().replace(/ - .*$/, '').trim();
            if (!title) {
                this.logger.warn(`No title found for ${url}`);
                return null;
            }
            const contentEl = $('.entry-content, .post-content, .entry, article .content, .post-inner .entry').first();
            contentEl.find('script, style, .social-share, .post-tags, .related-posts, .comments, .navigation, ins, .adsbygoogle').remove();
            const content = contentEl.html()?.trim() || '';
            if (!content) {
                this.logger.warn(`No content found for ${url}`);
                return null;
            }
            const excerpt = contentEl.find('p').first().text().trim().substring(0, 300) || '';
            const thumbnail = $('meta[property="og:image"]').attr('content') ||
                contentEl.find('img').first().attr('src') ||
                null;
            const tags = [];
            $('.post-tags a, .tagcloud a, .tags a, a[rel="tag"], .post-tag a').each((_, el) => {
                const tag = $(el).text().trim();
                if (tag)
                    tags.push(tag);
            });
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
        }
        catch (error) {
            this.logger.error(`Failed to crawl story: ${url}`, error);
            return null;
        }
    }
    async crawlAll() {
        let totalStories = 0;
        let newStories = 0;
        let errors = 0;
        for (const cat of CATEGORIES) {
            this.logger.log(`=== Crawling category: ${cat.name} ===`);
            const category = await this.prisma.category.upsert({
                where: { slug: cat.slug },
                create: { name: cat.name, slug: cat.slug },
                update: { name: cat.name },
            });
            const storyUrls = await this.crawlCategoryPages(cat.url);
            totalStories += storyUrls.length;
            for (const url of storyUrls) {
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
                }
                catch (dbError) {
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
                    }
                    catch (finalError) {
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
};
exports.CrawlerService = CrawlerService;
exports.CrawlerService = CrawlerService = CrawlerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CrawlerService);
//# sourceMappingURL=crawler.service.js.map