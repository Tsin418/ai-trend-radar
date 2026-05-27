import type { SourceHealth, SourceType } from '../trends/types.js';

export interface IntelligenceEvidenceItem {
  id: string;
  title: string;
  source: string;
  sourceType: SourceType;
  url: string;
  summary?: string;
  category?: string;
  tags?: string[];
  publishedAt?: string;
  collectedAt: string;
  metrics?: {
    stars?: number;
    starDelta24h?: number;
    starDelta7d?: number;
    upvotes?: number;
    likes?: number;
    downloads?: number;
    commentsCount?: number;
    rank?: number;
  };
}

export interface TopicBrief {
  id: string;
  title: string;
  category?: string;
  sources: string[];
  sourceCount: number;
  heatScore: number;
  confidence: 'low' | 'medium' | 'high';
  watchDecision: 'track' | 'deep_dive' | 'wait' | 'ignore';
  whatItIs: string;
  whyNow: string;
  whoShouldCare: string;
  developerRelevance: string;
  businessRelevance: string;
  riskNotes: string;
  technicalKeywords: string[];
  evidenceItems: IntelligenceEvidenceItem[];
  relatedEntities: string[];
  metrics: {
    stars?: number;
    starDelta24h?: number;
    starDelta7d?: number;
    votes?: number;
    likes?: number;
    downloads?: number;
    commentsCount?: number;
    heatScore: number;
    crossSourceBonus: number;
  };
}

export interface IntelligenceBrief {
  date: string;
  headline: string;
  keyTakeaways: string[];
  topicBriefs: TopicBrief[];
  sourceHealth: SourceHealth[];
  dataNotes: string[];
}
