import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
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
        if (!story) {
            throw new HttpException(
                `Không tìm thấy truyện: ${slug}`,
                HttpStatus.NOT_FOUND,
            );
        }
        return { title: story.title, text: this.stripHtml(story.content) };
    }

    private async callGemini(prompt: string, retries = 2): Promise<string> {
        if (!this.ai) {
            throw new HttpException(
                'AI chưa được cấu hình. Hãy set GEMINI_API_KEY.',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await this.ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });
                return response.text || '';
            } catch (error: any) {
                const status = error?.status || error?.statusCode;
                this.logger.error(
                    `Gemini API error (attempt ${attempt + 1}/${retries + 1}): status=${status}, message=${error?.message}`,
                );

                if (status === 429 && attempt < retries) {
                    // Rate limited — wait and retry
                    const delay = (attempt + 1) * 3000;
                    this.logger.warn(`Rate limited. Waiting ${delay}ms before retry...`);
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }

                if (status === 429) {
                    throw new HttpException(
                        'AI đang bận (rate limit). Vui lòng thử lại sau 1 phút.',
                        HttpStatus.TOO_MANY_REQUESTS,
                    );
                }
                if (status === 403) {
                    throw new HttpException(
                        'API key không hợp lệ hoặc chưa kích hoạt Gemini API.',
                        HttpStatus.FORBIDDEN,
                    );
                }
                throw new HttpException(
                    `Lỗi AI: ${error?.message || 'Unknown error'}`,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
        throw new HttpException('AI không phản hồi', HttpStatus.SERVICE_UNAVAILABLE);
    }

    async summarize(slug: string): Promise<{ summary: string; moral: string }> {
        const { title, text } = await this.getStoryContent(slug);
        const truncated = text.substring(0, 8000);

        const rawText = await this.callGemini(
            `Bạn là chuyên gia về truyện cổ tích. Hãy tóm tắt câu truyện "${title}" bằng tiếng Việt.

Nội dung truyện:
${truncated}

Trả về JSON theo format sau (KHÔNG markdown, chỉ JSON thuần):
{
  "summary": "Tóm tắt ngắn gọn 3-5 câu, giữ nội dung chính",
  "moral": "Bài học đạo đức / ý nghĩa của câu truyện trong 1-2 câu"
}`,
        );

        try {
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return { summary: rawText, moral: '' };
        }
    }

    async generateQuiz(slug: string): Promise<{
        questions: Array<{
            question: string;
            options: string[];
            correctAnswer: number;
        }>;
    }> {
        const { title, text } = await this.getStoryContent(slug);
        const truncated = text.substring(0, 8000);

        const rawText = await this.callGemini(
            `Bạn là giáo viên dạy văn học. Hãy tạo 5 câu hỏi trắc nghiệm bằng tiếng Việt về câu truyện "${title}".

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
        );

        try {
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return { questions: [] };
        }
    }
}
