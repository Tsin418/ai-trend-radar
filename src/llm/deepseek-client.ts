import { defaultShouldRetry, withRetry } from '../utils/retry.js';

interface DeepSeekChatChoice {
  message?: {
    content?: string;
  };
}

interface DeepSeekChatResponse {
  choices?: DeepSeekChatChoice[];
}

export interface DeepSeekClientOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
}

export async function callDeepSeekJson<T>(
  params: {
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    timeoutMs?: number;
  },
  options: DeepSeekClientOptions
): Promise<T> {
  const model = params.model ?? options.model;
  const timeoutMs = params.timeoutMs ?? options.timeoutMs;
  const url = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;

  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: params.userPrompt }
            ],
            response_format: { type: 'json_object' },
            thinking: { type: 'disabled' },
            temperature: 0.2,
            max_tokens: options.maxOutputTokens
          })
        });

        const bodyText = await response.text();
        if (!response.ok) {
          throw new Error(`DeepSeek API request failed: HTTP ${response.status}. ${bodyText.slice(0, 300)}`);
        }

        const payload = bodyText ? JSON.parse(bodyText) as DeepSeekChatResponse : {};
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('DeepSeek API returned an empty message content');
        }

        return JSON.parse(content) as T;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`DeepSeek API request timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      maxRetries: options.maxRetries,
      initialDelay: 1200,
      shouldRetry: defaultShouldRetry,
      onRetry: (error, attempt, delay) => {
        console.error(`[DeepSeek] retry ${attempt}/${options.maxRetries} in ${delay}ms: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}
