import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';

import type { RadarDigest, TrendItem } from '../../../types/radar';
import { EmptyState } from '../EmptyState';
import { fetchAihotItems } from '../../../services/aihotApi';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { ContributionCTA } from '../ContributionCTA';

const AIHOT_CATEGORIES = [
  { label: '全部', value: undefined },
  { label: '模型', value: 'ai-models' },
  { label: '产品', value: 'ai-products' },
  { label: '行业', value: 'industry' },
  { label: '论文', value: 'paper' },
  { label: '技巧', value: 'tip' },
] as const;

type AihotCategory = typeof AIHOT_CATEGORIES[number]['value'];

const LOCAL_CATEGORY_ALIASES: Record<Exclude<AihotCategory, undefined>, string[]> = {
  'ai-models': ['ai-models', 'models'],
  'ai-products': ['ai-products', 'products'],
  industry: ['industry'],
  paper: ['paper', 'papers'],
  tip: ['tip', 'tools'],
};

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return '00:00';
  }
}

function formatDateGroup(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return '未知日期';
  }
}

function publishedAtMs(item: TrendItem): number {
  const timestamp = Date.parse(item.publishedAt || item.collectedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function conciseSummary(item: TrendItem): string {
  return item.summary || item.description || '该条目提供了一个值得关注的 AI 新动态。';
}

function worthWatching(item: TrendItem): string | undefined {
  const isAihotSource = item.sourceType === 'curated_trend'
    || item.source.toLowerCase().includes('aihot')
    || item.originalSource?.toLowerCase().includes('aihot');
  if (!isAihotSource) return undefined;
  return item.recommendedReason;
}

export function InformationView({ digest }: { digest: RadarDigest }) {
  const [activeCategory, setActiveCategory] = useState<AihotCategory>(undefined);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackItems = digest.multiSourceSections?.aihotHighlights || [];

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let ignore = false;
    
    async function load() {
      setItems([]);
      setLoading(true);
      setError(null);
      try {
        const fetchedItems = await fetchAihotItems({
          category: activeCategory,
          q: debouncedQuery,
          take: 100
        });
        if (!ignore) {
          setItems(fetchedItems);
        }
      } catch (err: any) {
        if (!ignore) {
          console.error(err);
          setError(err.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    
    load();
    return () => { ignore = true; };
  }, [activeCategory, debouncedQuery]);

  const fallbackDisplayItems = activeCategory
    ? fallbackItems.filter((item) => LOCAL_CATEGORY_ALIASES[activeCategory].includes(item.category || ''))
    : fallbackItems;

  const displayItems = [...(error && items.length === 0 && !debouncedQuery
    ? fallbackDisplayItems
    : items)].sort((a, b) => publishedAtMs(b) - publishedAtMs(a));

  const groupedItems = displayItems.reduce<Record<string, TrendItem[]>>((acc, item) => {
    const dateKey = formatDateGroup(item.publishedAt || item.collectedAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const todayPicks = [
    ...(digest.multiSourceSections?.aihotHighlights ?? []),
    ...(digest.multiSourceSections?.productLaunches ?? []),
    ...(digest.multiSourceSections?.modelDemoSignals ?? []),
    ...(digest.multiSourceSections?.developerBuzz ?? []),
  ]
    .sort((a, b) => publishedAtMs(b) - publishedAtMs(a))
    .filter((item, index, array) => array.findIndex((target) => target.id === item.id) === index)
    .slice(0, 5);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">Today&apos;s Picks / 今日精选</h2>
          <p className="text-sm text-muted-foreground mt-1">先看最值得读的 5 条，再决定要不要继续刷完整时间线。</p>
        </div>
        {todayPicks.length === 0 ? (
          <EmptyState title="今天暂无精选条目" hint="下方仍可查看完整分类和时间线。" />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {todayPicks.map((item) => {
              const reason = worthWatching(item);
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    {item.category && (
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {AIHOT_CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                      </Badge>
                    )}
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-base font-semibold hover:underline underline-offset-2"
                  >
                    {item.title}
                  </a>
                  <p className="mt-2 text-sm text-foreground/85 leading-relaxed">{conciseSummary(item)}</p>
                  {reason && (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="text-foreground">为什么值得看：</span>
                      {reason}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            精选
            <span className="text-sm font-normal text-muted-foreground ml-2">AI 自动挑选的高价值内容</span>
          </h2>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border rounded-xl bg-card p-2 px-4 shadow-sm">
          <div className="flex gap-1 overflow-x-auto w-full sm:w-auto scrollbar-none pb-2 sm:pb-0">
            {AIHOT_CATEGORIES.map(category => (
              <button
                key={category.label}
                onClick={() => setActiveCategory(category.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === category.value 
                    ? 'bg-primary text-primary-foreground shadow' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-[240px]">
              <Input
                type="text"
                placeholder="搜索标题/摘要..."
                className="bg-background rounded-full border-muted-foreground/20 h-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setDebouncedQuery(query)}
              className="px-4 py-1 h-9 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors whitespace-nowrap"
            >
              搜索
            </button>
          </div>
        </div>
      </div>

      {loading && displayItems.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">加载中...</div>
      ) : displayItems.length === 0 ? (
        <div className="p-6"><EmptyState title="目前没有找到相关内容" /></div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedItems).map(([date, dateItems]) => (
            <div key={date} className="relative mt-2">
              <div className="sticky top-0 z-20 pb-4 mb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">{date}</span>
              </div>
              
              <div className="relative">
                <div className="absolute left-[61.5px] sm:left-[77.5px] top-6 bottom-[-32px] w-px bg-border/60"></div>
                <div className="space-y-6 lg:space-y-8 pb-4">
                  {dateItems.map((it) => {
                    const time = formatTime(it.publishedAt || it.collectedAt);
                    return (
                      <div key={it.id} className="relative flex items-start gap-4 sm:gap-6 group">
                        <div className="w-12 sm:w-16 flex-shrink-0 text-right pt-1 text-sm font-medium text-foreground z-10 bg-background">
                          {time}
                        </div>
                        <div className="absolute left-[57px] sm:left-[73px] top-[5.5px] w-[10px] h-[10px] rounded-full bg-border group-hover:bg-primary transition-colors ring-4 ring-background z-10"></div>
                        
                        <Card className="flex-1 hover:bg-muted/30 transition-shadow hover:shadow-md min-w-0">
                          <div className="p-4 sm:p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-muted-foreground font-medium">{it.source}</span>
                            </div>
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-base sm:text-lg font-bold hover:underline underline-offset-2 flex text-foreground"
                            >
                              {it.title}
                            </a>
                            {(it.summary || it.description) && (
                              <p className="text-[13px] sm:text-sm text-foreground/80 mt-3 leading-relaxed">
                                {it.summary || it.description}
                              </p>
                            )}
                            
                            {it.tags && it.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-4">
                                {it.tags.slice(0, 5).map(t => (
                                  <Badge variant="secondary" key={t} className="text-xs font-normal shadow-none bg-secondary/60">
                                    #{t}
                                  </Badge>
                                ))}
                                {it.category && (
                                  <Badge variant="outline" className="text-xs font-normal border-primary/20 text-primary">
                                    {AIHOT_CATEGORIES.find(c => c.value === it.category)?.label || it.category}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {it.recommendedReason && (
                              <div className="mt-4 p-3 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                                 <div className="flex gap-2">
                                   <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[13px] sm:text-sm whitespace-nowrap">推荐理由:</span>
                                   <span className="text-emerald-700/90 dark:text-emerald-400/90 text-[13px] sm:text-sm leading-relaxed">{it.recommendedReason}</span>
                                 </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ContributionCTA
        title="Submit a source or report a wrong classification"
        description="如果你发现漏掉的重要 AI 动态，或分类有误，欢迎到 GitHub issues 提交。"
      />
    </div>
  );
}
