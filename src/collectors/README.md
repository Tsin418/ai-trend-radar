# Collectors 架构说明

## 概览

Collectors 是数据源的抽象层，支持从不同平台（GitHub、Product Hunt、Reddit 等）获取热门项目。

## 核心接口

### `Collector<T>`

```typescript
interface Collector<T = TrendingItem> {
  readonly name: string;
  fetch(limit: number): Promise<T[]>;
}
```

所有数据源都实现这个接口。

### `TrendingItem`

统一的数据结构，所有数据源都转换为这个格式：

```typescript
interface TrendingItem {
  rank: number;              // 排名
  id: string;                // 唯一标识
  title: string;             // 标题
  description: string;       // 描述
  url: string;               // 链接
  primaryTag: string | null; // 主标签（语言/分类）
  tags: string[];            // 标签列表
  heatScore: number;         // 热度指标（今日新增）
  totalScore: number | null; // 总热度
  metadata: Record<string, unknown>; // 平台特有数据
}
```

## 已实现的 Collector

### GitHubCollector

从 GitHub Trending 页面抓取每日热门项目。

**使用方式：**

```typescript
import { createGitHubCollector } from './collectors/index.js';

const collector = createGitHubCollector();
const items = await collector.fetch(10);

console.log(items[0].title); // owner/repo
console.log(items[0].heatScore); // 今日新增 stars
```

**元数据结构：**

```typescript
interface GitHubRepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  forks: number | null;
  contributors: GitHubContributor[];
}
```

### ProductHuntCollector

通过 Product Hunt API v2 GraphQL 抓取最近 featured posts，按 AI / developer-tool 相关性过滤，并统一转换为 `TrendingItem`。它是 launch/product signal，不与 GitHub stars 或仓库质量信号混用。

**使用方式：**

```typescript
import { createProductHuntCollector } from './collectors/index.js';

const collector = createProductHuntCollector();
const items = await collector.fetch(10);

console.log(items[0].title); // Product name
console.log(items[0].heatScore); // votes + comments * 3
```

也可以通过脚本 dry-run：

```bash
pnpm producthunt:dry-run
pnpm producthunt:json
```

## 向后兼容

原有的 `fetchGitHubTrending()` 函数仍然保留：

```typescript
import { fetchGitHubTrending } from './collectors/github-trending.js';

const repos = await fetchGitHubTrending(10);
// 返回旧的 GitHubTrendingRepo[] 格式
```

## 扩展新的数据源

### 1. 创建新的 Collector

```typescript
// src/collectors/reddit.ts
import type { Collector, TrendingItem } from './types.js';

export class RedditCollector implements Collector {
  readonly name = 'reddit';

  async fetch(limit: number): Promise<TrendingItem[]> {
    // 实现抓取逻辑
    return items;
  }
}

export function createRedditCollector(): Collector {
  return new RedditCollector();
}
```

### 2. 导出到 index.ts

```typescript
// src/collectors/index.ts
export { RedditCollector, createRedditCollector } from './reddit.js';
```

### 3. 使用

```typescript
const collector = createRedditCollector();
const items = await collector.fetch(10);
```

## 最佳实践

1. **统一转换**：始终将平台特有数据转换为 `TrendingItem`
2. **元数据存储**：平台特有字段放在 `metadata` 中
3. **工厂函数**：使用 `createXxxCollector()` 工厂函数而非直接 `new`
4. **重试机制**：网络请求建议实现重试（参考 GitHubCollector）
5. **超时控制**：使用 AbortController 控制请求超时
