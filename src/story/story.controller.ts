import {
    Controller,
    Get,
    Param,
    Query,
    NotFoundException,
} from '@nestjs/common';
import { StoryService } from './story.service';

@Controller('api')
export class StoryController {
    constructor(private readonly storyService: StoryService) { }

    @Get('stories')
    async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('category') categorySlug?: string,
    ) {
        return this.storyService.findAll({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 12,
            search,
            categorySlug,
        });
    }

    @Get('stories/:slug')
    async findBySlug(@Param('slug') slug: string) {
        const story = await this.storyService.findBySlug(slug);
        if (!story) {
            throw new NotFoundException(`Story with slug "${slug}" not found`);
        }
        return story;
    }

    @Get('categories')
    async findCategories() {
        return this.storyService.findCategories();
    }

    @Get('featured')
    async getFeatured(@Query('limit') limit?: string) {
        return this.storyService.getFeaturedStories(
            limit ? parseInt(limit, 10) : 6,
        );
    }
}
