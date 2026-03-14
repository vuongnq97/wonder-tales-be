import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private ai: GoogleGenAI | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not set — AI features disabled');
        } else {
            this.ai = new GoogleGenAI({ apiKey });
            this.logger.log('Gemini AI initialized');
        }
    }

    private stripHtml(html: string): string {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private async getStoryContent(slug: string): Promise<{ title: string; text: string }> {
        const story = await this.prisma.story.findUnique({ where: { slug } });
        if (!story) throw new Error(`Story not found: ${slug}`);
        return { title: story.title, text: this.stripHtml(story.content) };
    }

    async summarize(slug: string): Promise<{ summary: string; moral: string }> {
        if (!this.ai) throw new Error('AI not configured. Set GEMINI_API_KEY.');

        const { title, text } = await this.getStoryContent(slug);
        const truncated = text.substring(0, 8000);

        const response = await this.ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Bạn là chuyên gia về truyện cổ tích. Hãy tóm tắt câu truyện "${title}" bằng tiếng Việt.

Nội dung truyện:
${truncated}

Trả về JSON theo format sau (KHÔNG markdown, chỉ JSON thuần):
{
  "summary": "Tóm tắt ngắn gọn 3-5 câu, giữ nội dung chính",
  "moral": "Bài học đạo đức / ý nghĩa của câu truyện trong 1-2 câu"
}`,
        });

        try {
            const raw = response.text?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '';
            return JSON.parse(raw);
        } catch {
            this.logger.error('Failed to parse summarize response');
            return {
                summary: response.text || 'Không thể tóm tắt truyện.',
                moral: '',
            };
        }
    }

    async generateQuiz(slug: string): Promise<{
        questions: Array<{
            question: string;
            options: string[];
            correctAnswer: number;
        }>;
    }> {
        if (!this.ai) throw new Error('AI not configured. Set GEMINI_API_KEY.');

        const { title, text } = await this.getStoryContent(slug);
        const truncated = text.substring(0, 8000);

        const response = await this.ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Bạn là giáo viên dạy văn học. Hãy tạo 5 câu hỏi trắc nghiệm bằng tiếng Việt về câu truyện "${title}".

Nội dung truyện:
${truncated}

Trả về JSON theo format sau (KHÔNG markdown, chỉ JSON thuần):
{
  "questions": [
    {
      "question": "Câu hỏi?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctAnswer": 0
    }
  ]
}

Yêu cầu:
- 5 câu hỏi, mỗi câu 4 đáp án A/B/C/D
- correctAnswer là index (0-3) của đáp án đúng
- Câu hỏi từ dễ đến khó
- Bao gồm câu hỏi về nhân vật, cốt truyện, và bài học`,
        });

        try {
            const raw = response.text?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '';
            return JSON.parse(raw);
        } catch {
            this.logger.error('Failed to parse quiz response');
            return { questions: [] };
        }
    }
}
