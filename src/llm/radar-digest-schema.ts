import { z } from 'zod';
import type { CompactDailyDigestInput, LlmDigestModelOutput } from './radar-digest-types.js';

const actionSchema = z.enum(['值得试用', '值得了解', '持续观察', '暂时忽略']);
const confidenceSchema = z.enum(['high', 'medium', 'low']);
const perspectiveSchema = z.enum(['developer', 'product', 'information', 'cross_source']);
const trendJudgmentSchema = z.enum(['升温中', '值得观察', '可能是噪音']);
const audienceSchema = z.enum(['developer', 'product', 'general']);
const relatedItemTypeSchema = z.enum(['repo', 'product', 'model', 'paper', 'news', 'discussion', 'unknown']);

const sourceRefsSchema = z.array(z.string().min(1)).max(12);

const perspectiveSummarySchema = z.object({
  headline: z.string().min(1).max(120),
  summary: z.string().min(1).max(400),
  keyItems: z.array(z.string().min(1).max(120)).max(6),
  suggestedAction: actionSchema,
  sourceRefs: sourceRefsSchema
});

const todayPulseSchema = z.object({
  title: z.string().min(1).max(120),
  date: z.string().min(1).max(32),
  executiveSummary: z.string().min(1).max(300),
  topChanges: z.array(z.object({
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(300),
    perspective: perspectiveSchema,
    whyItMatters: z.string().min(1).max(300),
    suggestedAction: actionSchema,
    confidence: confidenceSchema,
    sourceRefs: sourceRefsSchema
  })).max(6),
  developerView: perspectiveSummarySchema,
  productView: perspectiveSummarySchema,
  informationView: perspectiveSummarySchema,
  noiseWarning: z.string().max(200).optional(),
  suggestedReadingOrder: z.array(z.string().min(1).max(80)).max(6).optional()
});

const trendClusterSchema = z.object({
  name: z.string().min(1).max(120),
  oneLiner: z.string().min(1).max(240),
  whyNow: z.string().min(1).max(320),
  audience: z.array(audienceSchema).min(1).max(3),
  judgment: trendJudgmentSchema,
  confidence: confidenceSchema,
  relatedSources: z.array(z.string().min(1).max(80)).max(8),
  relatedItems: z.array(z.object({
    title: z.string().min(1).max(200),
    source: z.string().min(1).max(120),
    url: z.string().url().optional(),
    itemType: relatedItemTypeSchema
  })).max(8)
});

export const RadarDigestModelOutputSchema = z.object({
  todayPulse: todayPulseSchema.optional(),
  trendClusters: z.array(trendClusterSchema).max(6).optional(),
  warnings: z.array(z.string().min(1).max(200)).max(12).optional()
});

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export function parseModelOutput(text: string): LlmDigestModelOutput {
  const cleaned = stripCodeFence(text);
  const parsed = JSON.parse(cleaned) as unknown;
  return RadarDigestModelOutputSchema.parse(parsed);
}

function validateSourceRefs(output: LlmDigestModelOutput, validIds: Set<string>): string[] {
  const warnings: string[] = [];
  const collectRefs = [
    ...(output.todayPulse?.topChanges.flatMap((item) => item.sourceRefs) ?? []),
    ...(output.todayPulse?.developerView.sourceRefs ?? []),
    ...(output.todayPulse?.productView.sourceRefs ?? []),
    ...(output.todayPulse?.informationView.sourceRefs ?? [])
  ];
  for (const ref of collectRefs) {
    if (!validIds.has(ref)) {
      warnings.push(`Invalid sourceRef removed: ${ref}`);
    }
  }
  return warnings;
}

function validateRelatedItems(output: LlmDigestModelOutput, input: CompactDailyDigestInput): string[] {
  const warnings: string[] = [];
  const titleSourceSet = new Set(
    input.items.map((item) => `${item.title.trim().toLowerCase()}||${item.source.trim().toLowerCase()}`)
  );
  const urlSet = new Set(input.items.map((item) => (item.url ?? '').trim()).filter(Boolean));

  for (const cluster of output.trendClusters ?? []) {
    for (const related of cluster.relatedItems) {
      const titleSource = `${related.title.trim().toLowerCase()}||${related.source.trim().toLowerCase()}`;
      const hasTitleSource = titleSourceSet.has(titleSource);
      const hasUrl = Boolean(related.url && urlSet.has(related.url.trim()));
      if (!hasTitleSource && !hasUrl) {
        warnings.push(`Related item mismatch removed: ${related.title}`);
      }
    }
  }
  return warnings;
}

function pruneInvalidSourceRefs(output: LlmDigestModelOutput, validIds: Set<string>): void {
  const prune = (refs: string[]): string[] => refs.filter((ref) => validIds.has(ref));
  if (!output.todayPulse) return;
  output.todayPulse.topChanges = output.todayPulse.topChanges.map((item) => ({
    ...item,
    sourceRefs: prune(item.sourceRefs)
  }));
  output.todayPulse.developerView.sourceRefs = prune(output.todayPulse.developerView.sourceRefs);
  output.todayPulse.productView.sourceRefs = prune(output.todayPulse.productView.sourceRefs);
  output.todayPulse.informationView.sourceRefs = prune(output.todayPulse.informationView.sourceRefs);
}

function pruneInvalidRelatedItems(output: LlmDigestModelOutput, input: CompactDailyDigestInput): void {
  if (!output.trendClusters) return;
  const titleSourceSet = new Set(
    input.items.map((item) => `${item.title.trim().toLowerCase()}||${item.source.trim().toLowerCase()}`)
  );
  const urlSet = new Set(input.items.map((item) => (item.url ?? '').trim()).filter(Boolean));

  output.trendClusters = output.trendClusters.map((cluster) => ({
    ...cluster,
    relatedItems: cluster.relatedItems.filter((related) => {
      const titleSource = `${related.title.trim().toLowerCase()}||${related.source.trim().toLowerCase()}`;
      const hasTitleSource = titleSourceSet.has(titleSource);
      const hasUrl = Boolean(related.url && urlSet.has(related.url.trim()));
      return hasTitleSource || hasUrl;
    })
  }));
}

function trimTopChanges(output: LlmDigestModelOutput): void {
  if (!output.todayPulse) return;
  output.todayPulse.topChanges = output.todayPulse.topChanges.slice(0, 3);
}

function trimTrendClusters(output: LlmDigestModelOutput): void {
  if (!output.trendClusters) return;
  output.trendClusters = output.trendClusters.slice(0, 6);
}

export function validateAndSanitizeModelOutput(
  output: LlmDigestModelOutput,
  input: CompactDailyDigestInput
): { output: LlmDigestModelOutput; warnings: string[] } {
  const validIds = new Set(input.items.map((item) => item.id));
  const warnings = [
    ...validateSourceRefs(output, validIds),
    ...validateRelatedItems(output, input)
  ];
  pruneInvalidSourceRefs(output, validIds);
  pruneInvalidRelatedItems(output, input);
  trimTopChanges(output);
  trimTrendClusters(output);
  return { output, warnings };
}
