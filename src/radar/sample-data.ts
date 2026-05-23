import type { RadarRepository } from './types.js';

export function createSampleRepositories(now = new Date()): RadarRepository[] {
  const today = now.toISOString();
  const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const older = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      repoFullName: 'example/coding-agent-lab',
      repoUrl: 'https://github.com/example/coding-agent-lab',
      owner: 'example',
      name: 'coding-agent-lab',
      description: 'Open-source coding agent framework for SWE task automation.',
      language: 'TypeScript',
      topics: ['coding-agent', 'llm', 'automation'],
      category: 'Coding Agent / SWE Agent',
      createdAt: older,
      pushedAt: recent,
      firstSeenAt: today,
      lastSeenAt: today,
      source: 'sample',
      stars: 820,
      forks: 78,
      openIssues: 22,
      isArchived: false,
      isFork: false,
      isWatchlist: false
    },
    {
      repoFullName: 'example/mcp-toolbox',
      repoUrl: 'https://github.com/example/mcp-toolbox',
      owner: 'example',
      name: 'mcp-toolbox',
      description: 'Model Context Protocol server toolkit with examples for tool calling.',
      language: 'Python',
      topics: ['mcp', 'tool-calling', 'agents'],
      category: 'MCP / Tool Calling',
      createdAt: older,
      pushedAt: recent,
      firstSeenAt: today,
      lastSeenAt: today,
      source: 'sample',
      stars: 260,
      forks: 29,
      openIssues: 8,
      isArchived: false,
      isFork: false,
      isWatchlist: true
    },
    {
      repoFullName: 'example/local-llm-runtime',
      repoUrl: 'https://github.com/example/local-llm-runtime',
      owner: 'example',
      name: 'local-llm-runtime',
      description: 'Local LLM inference runtime for developer applications.',
      language: 'Rust',
      topics: ['llm', 'inference', 'local-llm'],
      category: 'Local LLM / Inference',
      createdAt: older,
      pushedAt: recent,
      firstSeenAt: today,
      lastSeenAt: today,
      source: 'sample',
      stars: 1850,
      forks: 166,
      openIssues: 31,
      isArchived: false,
      isFork: false,
      isWatchlist: false
    }
  ];
}
