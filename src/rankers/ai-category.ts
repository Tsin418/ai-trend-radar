import type { RadarRepository } from '../radar/types.js';

interface CategoryRule {
  category: string;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: 'Coding Agent / SWE Agent', keywords: ['coding-agent', 'swe-agent', 'code agent', 'developer agent', 'copilot', 'cursor', 'cline', 'aider', 'openhands'] },
  { category: 'MCP / Tool Calling', keywords: ['mcp', 'model context protocol', 'model-context-protocol', 'tool-calling', 'function-calling', 'tools'] },
  { category: 'RAG / Knowledge Base', keywords: ['rag', 'retrieval', 'knowledge-base', 'knowledge base', 'llamaindex', 'llama-index'] },
  { category: 'Vector Database / Embedding', keywords: ['vector-database', 'vector db', 'embedding', 'embeddings', 'qdrant', 'weaviate', 'milvus'] },
  { category: 'Local LLM / Inference', keywords: ['local-llm', 'inference', 'llama.cpp', 'onnx', 'vllm', 'ollama', 'gguf', 'runtime'] },
  { category: 'AI Browser / Computer Use', keywords: ['browser-agent', 'computer-use', 'browser automation', 'web agent', 'operator'] },
  { category: 'AI Workflow Automation', keywords: ['workflow', 'automation', 'orchestration', 'pipeline'] },
  { category: 'AI App Builder', keywords: ['app builder', 'ai app', 'chatbot', 'dify', 'flowise', 'lobe-chat'] },
  { category: 'AI DevTool / Observability', keywords: ['observability', 'eval', 'evals', 'tracing', 'monitoring', 'prompt management'] },
  { category: 'AI Agent Framework', keywords: ['agent', 'agents', 'multi-agent', 'langgraph', 'autogen', 'crew'] }
];

const GENERIC_AI_KEYWORDS = ['ai', 'llm', 'agent', 'rag', 'mcp', 'openai', 'anthropic', 'claude', 'gemini', 'llama', 'transformer', 'diffusion'];

export function normalizeRadarText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_/]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff.+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyAiCategory(repo: RadarRepository): { category: string; aiRelevanceScore: number; matchedKeywords: string[] } {
  const text = normalizeRadarText([repo.repoFullName, repo.description, repo.language ?? '', ...repo.topics].join(' '));
  const matchedKeywords = new Set<string>();
  let bestCategory = 'Other AI';
  let bestCount = 0;

  for (const rule of CATEGORY_RULES) {
    const count = rule.keywords.filter((keyword) => {
      const matched = text.includes(normalizeRadarText(keyword));
      if (matched) matchedKeywords.add(keyword);
      return matched;
    }).length;

    if (count > bestCount) {
      bestCount = count;
      bestCategory = rule.category;
    }
  }

  for (const keyword of GENERIC_AI_KEYWORDS) {
    if (text.includes(normalizeRadarText(keyword))) matchedKeywords.add(keyword);
  }

  const topicScore = Math.min(35, repo.topics.length * 5);
  const specificScore = Math.min(45, bestCount * 18);
  const genericScore = Math.min(25, Array.from(matchedKeywords).length * 5);
  const watchlistScore = repo.isWatchlist ? 15 : 0;
  const aiRelevanceScore = Math.min(100, topicScore + specificScore + genericScore + watchlistScore);

  return {
    category: bestCategory,
    aiRelevanceScore,
    matchedKeywords: Array.from(matchedKeywords)
  };
}
