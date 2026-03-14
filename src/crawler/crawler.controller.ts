import { Controller, Post, Logger } from '@nestjs/common';
import { CrawlerService } from './crawler.service';

@Controller('api/crawl')
export class CrawlerController {
    private readonly logger = new Logger(CrawlerController.name);

    constructor(private readonly crawlerService: CrawlerService) { }

    @Post()
    async triggerCrawl() {
        this.logger.log('Crawl triggered via API');
        const result = await this.crawlerService.crawlAll();
        return {
            message: 'Crawl completed',
            ...result,
        };
    }
}
