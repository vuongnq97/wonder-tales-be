"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CrawlerController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerController = void 0;
const common_1 = require("@nestjs/common");
const crawler_service_1 = require("./crawler.service");
let CrawlerController = CrawlerController_1 = class CrawlerController {
    crawlerService;
    logger = new common_1.Logger(CrawlerController_1.name);
    constructor(crawlerService) {
        this.crawlerService = crawlerService;
    }
    async triggerCrawl() {
        this.logger.log('Crawl triggered via API');
        const result = await this.crawlerService.crawlAll();
        return {
            message: 'Crawl completed',
            ...result,
        };
    }
};
exports.CrawlerController = CrawlerController;
__decorate([
    (0, common_1.Post)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CrawlerController.prototype, "triggerCrawl", null);
exports.CrawlerController = CrawlerController = CrawlerController_1 = __decorate([
    (0, common_1.Controller)('api/crawl'),
    __metadata("design:paramtypes", [crawler_service_1.CrawlerService])
], CrawlerController);
//# sourceMappingURL=crawler.controller.js.map