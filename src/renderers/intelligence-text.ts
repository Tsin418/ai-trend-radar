import type { IntelligenceBrief } from '../intelligence/types.js';

export function renderIntelligenceBriefText(brief: IntelligenceBrief): string {
  const lines: string[] = [
    `AI Intelligence Brief - ${brief.date}`,
    '',
    'Headline:',
    brief.headline,
    '',
    'Key Takeaways:'
  ];

  if (brief.keyTakeaways.length === 0) {
    lines.push('No strong takeaways today.');
  } else {
    brief.keyTakeaways.forEach((takeaway, index) => {
      lines.push(`${index + 1}. ${takeaway}`);
    });
  }

  lines.push('', 'Topic Briefs:');
  if (brief.topicBriefs.length === 0) {
    lines.push('No topic briefs generated.');
  }

  brief.topicBriefs.forEach((topic, index) => {
    lines.push(
      '',
      `[${index + 1}] ${topic.title}`,
      `Sources: ${topic.sources.join(', ')}`,
      `Heat Score: ${topic.heatScore}`,
      `Decision: ${topic.watchDecision}`,
      `Confidence: ${topic.confidence}`,
      '',
      'Why now:',
      topic.whyNow,
      '',
      'Developer relevance:',
      topic.developerRelevance,
      '',
      'Evidence:'
    );

    if (topic.evidenceItems.length === 0) {
      lines.push('- No linked evidence items.');
    } else {
      topic.evidenceItems.forEach((item) => {
        const summary = item.summary ? ` - ${item.summary}` : '';
        lines.push(`- [${item.source}] ${item.title}${summary}`);
      });
    }

    lines.push('', 'Risk notes:', topic.riskNotes);
  });

  if (brief.dataNotes.length > 0) {
    lines.push('', 'Data Notes:');
    brief.dataNotes.forEach((note) => lines.push(`- ${note}`));
  }

  return lines.join('\n');
}
