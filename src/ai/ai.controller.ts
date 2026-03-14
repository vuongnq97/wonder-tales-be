import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('api/ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('summarize')
    async summarize(@Body() body: { storySlug: string }) {
        if (!body.storySlug) {
            throw new BadRequestException('storySlug is required');
        }
        return this.aiService.summarize(body.storySlug);
    }

    @Post('quiz')
    async quiz(@Body() body: { storySlug: string }) {
        if (!body.storySlug) {
            throw new BadRequestException('storySlug is required');
        }
        return this.aiService.generateQuiz(body.storySlug);
    }
}
