import { z } from 'zod';

export const RepoLLMSummarySchema = z.object({
  oneLiner: z.string().min(1),
  problemSolved: z.string().min(1),
  aiCategory: z.string().min(1),
  whyTrending: z.string().min(1),
  developerTakeaway: z.string().min(1),
  targetUsers: z.string().min(1),
  riskNotes: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low'])
});

export type RepoLLMSummaryInput = z.infer<typeof RepoLLMSummarySchema>;

export const TrendLLMSummarySchema = z.object({
  whatItIs: z.string().min(1),
  whyNow: z.string().min(1),
  whoShouldCare: z.string().min(1),
  technicalKeywords: z.array(z.string()).max(12),
  businessRelevance: z.string().min(1),
  developerRelevance: z.string().min(1),
  watchDecision: z.enum(['track', 'deep_dive', 'ignore', 'wait']),
  riskNotes: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high'])
});

export type TrendLLMSummaryInput = z.infer<typeof TrendLLMSummarySchema>;
