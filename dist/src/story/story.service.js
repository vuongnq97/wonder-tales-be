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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let StoryService = class StoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(params) {
        const { page = 1, limit = 12, search, categorySlug, } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { excerpt: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categorySlug) {
            where.category = { slug: categorySlug };
        }
        const [stories, total] = await Promise.all([
            this.prisma.story.findMany({
                where,
                include: {
                    category: {
                        select: { id: true, name: true, slug: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.story.count({ where }),
        ]);
        return {
            data: stories,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async findBySlug(slug) {
        const story = await this.prisma.story.findUnique({
            where: { slug },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });
        if (!story)
            return null;
        const relatedStories = await this.prisma.story.findMany({
            where: {
                categoryId: story.categoryId,
                id: { not: story.id },
            },
            select: {
                id: true,
                title: true,
                slug: true,
                excerpt: true,
                thumbnail: true,
            },
            take: 6,
            orderBy: { createdAt: 'desc' },
        });
        return { ...story, relatedStories };
    }
    async findCategories() {
        return this.prisma.category.findMany({
            include: {
                _count: {
                    select: { stories: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async getFeaturedStories(limit = 6) {
        return this.prisma.story.findMany({
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.StoryService = StoryService;
exports.StoryService = StoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StoryService);
//# sourceMappingURL=story.service.js.map