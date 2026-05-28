import type { LatestDailyDashboardFile } from '../dashboard/build-dashboard-data.js';
import { callOpenAICompatibleChat } from './openai-compatible-client.js';
import { buildFallbackLlmDigest } from './radar-digest-fallback.js';
import { buildCompactDailyDigestInput } from './radar-digest-input.js';
import { buildRadarDigestUserPrompt, RADAR_DIGEST_SYSTEM_PROMPT } from './radar-digest-prompt.js';
import { parseModelOutput, validateAndSanitizeModelOutput } from './radar-digest-schema.js';
import type { LlmDigest, RadarDigestLLMConfig } from './radar-digest-types.js';

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240);
  return String(error).slice(0, 240);
}

async function tryParseWithRepair(
  rawContent: string,
  config: RadarDigestLLMConfig
): Promise<string> {
  try {
    parseModelOutput(rawContent);
    return rawContent;
  } catch {
    const repairPrompt = `Fix this text into strictly valid JSON only. Do not add any new facts. Keep original meaning.

Invalid JSON text:
${rawContent}`;
    return callOpenAICompatibleChat(
      {
        apiKey: config.apiKey as string,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs
      },
      {
        model: config.model,
        systemPrompt: 'You are a JSON repair assistant. Output valid JSON only.',
        userPrompt: repairPrompt,
        temperature: 0,
        maxTokens: Math.max(600, Math.floor(config.maxOutputTokens / 2))
      }
    );
  }
}

export async function generateRadarLlmDigest(
  dashboard: LatestDailyDashboardFile,
  config: RadarDigestLLMConfig
): Promise<LlmDigest> {
  const { input, inputStats } = buildCompactDailyDigestInput(dashboard, { maxInputItems: config.maxInputItems });

  if (!config.enabled) {
    return buildFallbackLlmDigest(dashboard, inputStats, 'LLM disabled by config; used rule-based fallback.', config.model);
  }
  if (!config.apiKey) {
    return buildFallbackLlmDigest(dashboard, inputStats, 'LLM API key missing; used rule-based fallback.', config.model);
  }
  if (input.items.length === 0) {
    return buildFallbackLlmDigest(dashboard, inputStats, 'No compact input items available; used rule-based fallback.', config.model);
  }

  try {
    const userPrompt = buildRadarDigestUserPrompt(input);
    const rawContent = await callOpenAICompatibleChat(
      {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs
      },
      {
        model: config.model,
        systemPrompt: RADAR_DIGEST_SYSTEM_PROMPT,
        userPrompt,
        temperature: config.temperature,
        maxTokens: config.maxOutputTokens
      }
    );
    const contentToParse = await tryParseWithRepair(rawContent, config);
    const parsed = parseModelOutput(contentToParse);
    const validated = validateAndSanitizeModelOutput(parsed, input);

    return {
      status: 'success',
      generatedAt: new Date().toISOString(),
      model: config.model,
      language: config.language,
      inputStats,
      todayPulse: validated.output.todayPulse,
      trendClusters: validated.output.trendClusters ?? [],
      warnings: [...(validated.output.warnings ?? []), ...validated.warnings]
    };
  } catch (error) {
    return buildFallbackLlmDigest(
      dashboard,
      inputStats,
      `LLM unavailable; used rule-based fallback. ${safeErrorMessage(error)}`,
      config.model
    );
  }
}
