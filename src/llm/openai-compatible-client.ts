import { defaultShouldRetry, withRetry } from '../utils/retry.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface OpenAICompatibleClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export async function callOpenAICompatibleChat(
  options: OpenAICompatibleClientOptions,
  params: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
  }
): Promise<string> {
  const url = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;

  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: params.model,
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: params.userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: params.temperature,
            max_tokens: params.maxTokens
          })
        });

        const bodyText = await response.text();
        if (!response.ok) {
          throw new Error(`OpenAI-compatible API request failed: HTTP ${response.status}. ${bodyText.slice(0, 280)}`);
        }

        const payload = bodyText ? JSON.parse(bodyText) as ChatCompletionResponse : {};
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('OpenAI-compatible API returned an empty message content');
        }
        return content;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`OpenAI-compatible API request timed out after ${options.timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      maxRetries: 1,
      initialDelay: 1200,
      shouldRetry: defaultShouldRetry,
      onRetry: (error, attempt, delay) => {
        console.error(`[RadarDigestLLM] retry ${attempt}/1 in ${delay}ms: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}
