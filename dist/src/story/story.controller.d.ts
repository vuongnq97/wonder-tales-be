import { StoryService } from './story.service';
export declare class StoryController {
    private readonly storyService;
    constructor(storyService: StoryService);
    findAll(page?: string, limit?: string, search?: string, categorySlug?: string): Promise<{
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
    }>;
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
    getFeatured(limit?: string): Promise<({
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
