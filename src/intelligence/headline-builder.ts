import type { TopicBrief } from './types.js';

export function buildIntelligenceHeadline(topicBriefs: TopicBrief[]): {
  headline: string;
  keyTakeaways: string[];
} {
  if (topicBriefs.length === 0) {
    return {
      headline: 'No strong multi-source AI trend signal was detected today.',
      keyTakeaways: []
    };
  }

  const headline = topicBriefs.length === 1
    ? `${topicBriefs[0].title} is today's strongest AI trend signal, supported by ${topicBriefs[0].sourceCount} source(s).`
    : `Today's strongest AI trend signals are ${formatList(topicBriefs.slice(0, 3).map((topic) => topic.title))}.`;

  return {
    headline,
    keyTakeaways: topicBriefs.slice(0, 3).flatMap((topic) => [
      truncate(`${topic.title}: ${topic.whyNow}`),
      truncate(`${topic.title}: ${topic.developerRelevance}`),
      truncate(`${topic.title}: watch decision is ${topic.watchDecision}.`)
    ])
  };
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function truncate(value: string, maxLength = 180): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}.`;
}
