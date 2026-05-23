# Rankers 架构说明

## 概览

Rankers 是推荐排序策略层，负责把候选趋势项目和用户画像转换成最终推荐列表。

当前已实现：

- `RuleBasedRanker` - 基于关键词、语言偏好、热度和排名的规则评分

未来可扩展：

- `LLMRanker` - 通过语义理解做推荐排序
- `HybridRanker` - 规则预筛 + LLM 精排

## 核心接口

```typescript
interface Ranker<TItem, TProfile, TResult> {
  readonly name: string;
  rank(items: TItem[], profile: TProfile, limit: number): TResult[];
}
```

## 当前实现

```typescript
import { createRuleBasedRanker } from './index.js';

const ranker = createRuleBasedRanker();
const recommendations = ranker.rank(repositories, profile, 5);
```

## 设计原则

1. 将排序策略和抓取、通知解耦
2. 允许并存多种排序策略
3. 保持 `TrendingDigest` 输出结构稳定
4. 先保证规则排序稳定，再扩展到 LLM
