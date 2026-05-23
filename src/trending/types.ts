export interface GitHubTrendingContributor {
  login: string;
  url: string;
}

export interface GitHubTrendingRepo {
  rank: number;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  language: string | null;
  starsToday: number;
  totalStars: number | null;
  forks: number | null;
  contributors: GitHubTrendingContributor[];
}

export interface TrendingProfile {
  title: string;
  summary: string;
  keywords: string[];
  preferredLanguages: string[];
  focusAreas: string[];
}

export interface TrendingRecommendation {
  repo: GitHubTrendingRepo;
  score: number;
  reasons: string[];
  practiceIdeas: string[];
}

export interface TrendingDigest {
  date: string;
  generatedAt: string;
  profile: TrendingProfile;
  repositories: GitHubTrendingRepo[];
  recommendations: TrendingRecommendation[];
  summary: string;
}
