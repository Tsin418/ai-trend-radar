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
