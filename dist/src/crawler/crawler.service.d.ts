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
export declare class CrawlerService {
    private readonly prisma;
    private readonly logger;
    private readonly httpsAgent;
    constructor(prisma: PrismaService);
    private delay;
    private fetchHtml;
    crawlCategoryPages(categoryUrl: string): Promise<string[]>;
    crawlStoryPage(url: string): Promise<CrawledStory | null>;
    crawlAll(): Promise<{
        totalCategories: number;
        totalStories: number;
        newStories: number;
        errors: number;
    }>;
}
export {};
