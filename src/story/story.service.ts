import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoryService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(params: {
        page?: number;
        limit?: number;
        search?: string;
        categorySlug?: string;
    }) {
        const {
            page = 1,
            limit = 12,
            search,
            categorySlug,
        } = params;

        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};

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

    async findBySlug(slug: string) {
        const story = await this.prisma.story.findUnique({
            where: { slug },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });

        if (!story) return null;

        // Get related stories from same category
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
}
