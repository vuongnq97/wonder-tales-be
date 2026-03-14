import { PrismaService } from '../prisma/prisma.service';
export declare class StoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(params: {
        page?: number;
        limit?: number;
        search?: string;
        categorySlug?: string;
    }): Promise<{
        data: ({
            category: {
                slug: string;
                id: string;
                name: string;
            };
        } & {
            title: string;
            content: string;
            slug: string;
            excerpt: string | null;
            thumbnail: string | null;
            tags: string[];
            sourceUrl: string;
            id: string;
            createdAt: Date;
            categoryId: string;
            updatedAt: Date;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findBySlug(slug: string): Promise<{
        relatedStories: {
            title: string;
            slug: string;
            excerpt: string | null;
            thumbnail: string | null;
            id: string;
        }[];
        category: {
            slug: string;
            id: string;
            name: string;
        };
        title: string;
        content: string;
        slug: string;
        excerpt: string | null;
        thumbnail: string | null;
        tags: string[];
        sourceUrl: string;
        id: string;
        createdAt: Date;
        categoryId: string;
        updatedAt: Date;
    } | null>;
    findCategories(): Promise<({
        _count: {
            stories: number;
        };
    } & {
        slug: string;
        id: string;
        name: string;
        createdAt: Date;
    })[]>;
    getFeaturedStories(limit?: number): Promise<({
        category: {
            slug: string;
            id: string;
            name: string;
        };
    } & {
        title: string;
        content: string;
        slug: string;
        excerpt: string | null;
        thumbnail: string | null;
        tags: string[];
        sourceUrl: string;
        id: string;
        createdAt: Date;
        categoryId: string;
        updatedAt: Date;
    })[]>;
}
