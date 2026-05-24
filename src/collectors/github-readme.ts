import { defaultShouldRetry, withRetry } from '../utils/retry.js';

const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

interface GitHubReadmeResponse {
  content?: string;
  encoding?: string;
}

export interface GitHubReadmeResult {
  content: string;
  source: 'api' | 'raw-main' | 'raw-master';
}

function requestHeaders(token?: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'AI-Developer-Radar-Bot/0.1',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function fetchText(url: string, token?: string): Promise<string> {
  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          headers: requestHeaders(token),
          signal: controller.signal
        });
        const bodyText = await response.text();
        if (!response.ok) {
          throw new Error(`GitHub README request failed: HTTP ${response.status}. ${bodyText.slice(0, 300)}`);
        }
        return bodyText;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`GitHub README request timed out: ${url}`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      maxRetries: MAX_RETRIES,
      initialDelay: 1000,
      shouldRetry: defaultShouldRetry
    }
  );
}

async function fetchApiReadme(repoFullName: string, token?: string): Promise<GitHubReadmeResult> {
  const text = await fetchText(`${GITHUB_API}/repos/${repoFullName}/readme`, token);
  const payload = JSON.parse(text) as GitHubReadmeResponse;
  if (!payload.content || payload.encoding !== 'base64') {
    throw new Error(`GitHub README API returned unsupported payload for ${repoFullName}`);
  }

  return {
    content: Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8'),
    source: 'api'
  };
}

async function fetchRawReadme(repoFullName: string, branch: 'main' | 'master', token?: string): Promise<GitHubReadmeResult> {
  const content = await fetchText(`https://raw.githubusercontent.com/${repoFullName}/${branch}/README.md`, token);
  return {
    content,
    source: branch === 'main' ? 'raw-main' : 'raw-master'
  };
}

export async function fetchGitHubReadme(repoFullName: string, token?: string): Promise<GitHubReadmeResult> {
  try {
    return await fetchApiReadme(repoFullName, token);
  } catch {
    try {
      return await fetchRawReadme(repoFullName, 'main', token);
    } catch {
      return fetchRawReadme(repoFullName, 'master', token);
    }
  }
}
