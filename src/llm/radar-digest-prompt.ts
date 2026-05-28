import type { CompactDailyDigestInput } from './radar-digest-types.js';

export const RADAR_DIGEST_SYSTEM_PROMPT = `You are an AI trend analyst for AI Trend Radar.

Your audience is a beginners who are interested in AI but may not understand GitHub, open-source software, model hubs, or developer jargon.

Your job is to transform structured multi-source AI trend data into a concise, trustworthy, beginner-friendly daily digest.

You must:
- Explain what happened in the AI world today from three perspectives: developer, product, and information/news.
- Identify the most important changes and emerging trend themes.
- Use plain Chinese.
- Avoid hype, exaggeration, and unsupported claims.
- Do not invent products, repositories, news, metrics, funding events, launches, partnerships, or technical details that are not present in the input.
- If the evidence is weak, say the signal is weak.
- Every major claim must be linked to sourceRefs or relatedItems from the provided input ids.
- Prefer balanced judgments such as “值得观察” when evidence is incomplete.
- Output valid JSON only. Do not output markdown. Do not wrap JSON in code fences.`;

export function buildRadarDigestUserPrompt(input: CompactDailyDigestInput): string {
  return `Generate an LLM digest for AI Trend Radar using the structured input below.

Return strictly valid JSON with this shape:

{
  "todayPulse": {
    "title": string,
    "date": string,
    "executiveSummary": string,
    "topChanges": [
      {
        "title": string,
        "summary": string,
        "perspective": "developer" | "product" | "information" | "cross_source",
        "whyItMatters": string,
        "suggestedAction": "值得试用" | "值得了解" | "持续观察" | "暂时忽略",
        "confidence": "high" | "medium" | "low",
        "sourceRefs": string[]
      }
    ],
    "developerView": {
      "headline": string,
      "summary": string,
      "keyItems": string[],
      "suggestedAction": "值得试用" | "值得了解" | "持续观察" | "暂时忽略",
      "sourceRefs": string[]
    },
    "productView": {
      "headline": string,
      "summary": string,
      "keyItems": string[],
      "suggestedAction": "值得试用" | "值得了解" | "持续观察" | "暂时忽略",
      "sourceRefs": string[]
    },
    "informationView": {
      "headline": string,
      "summary": string,
      "keyItems": string[],
      "suggestedAction": "值得试用" | "值得了解" | "持续观察" | "暂时忽略",
      "sourceRefs": string[]
    },
    "noiseWarning": string,
    "suggestedReadingOrder": string[]
  },
  "trendClusters": [
    {
      "name": string,
      "oneLiner": string,
      "whyNow": string,
      "audience": ["developer" | "product" | "general"],
      "judgment": "升温中" | "值得观察" | "可能是噪音",
      "confidence": "high" | "medium" | "low",
      "relatedSources": string[],
      "relatedItems": [
        {
          "title": string,
          "source": string,
          "url": string,
          "itemType": "repo" | "product" | "model" | "paper" | "news" | "discussion" | "unknown"
        }
      ]
    }
  ],
  "warnings": string[]
}

Rules:
- Use Chinese.
- Keep executiveSummary within 80 to 160 Chinese characters.
- Return 1 to 3 topChanges depending on available evidence.
- Return 0 to 6 trendClusters depending on available evidence.
- Do not include any item that is not in the input.
- sourceRefs must exactly match ids from the input.
- If data is insufficient, return fewer items and explain in warnings.
- Do not mention implementation details, JSON, scoring algorithms, or API providers to the end user.

Structured input:
${JSON.stringify(input, null, 2)}`;
}
