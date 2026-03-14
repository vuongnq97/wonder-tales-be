import { CrawlerService } from './crawler.service';
export declare class CrawlerController {
    private readonly crawlerService;
    private readonly logger;
    constructor(crawlerService: CrawlerService);
    triggerCrawl(): Promise<{
        totalCategories: number;
        totalStories: number;
        newStories: number;
        errors: number;
        message: string;
    }>;
}
