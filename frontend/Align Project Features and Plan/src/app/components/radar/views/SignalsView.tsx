import { MultiSourceSignalCard } from '../MultiSourceSignalCard';
import { CrossSourceCard } from '../CrossSourceCard';
import { EmptyState } from '../EmptyState';
import { Card } from '../../ui/card';
import { ContributionCTA } from '../ContributionCTA';
import type { RadarDigest } from '../../../types/radar';

function audienceHint(title: string, category?: string): string {
  const combined = `${title} ${category ?? ''}`.toLowerCase();
  if (combined.includes('agent') || combined.includes('mcp') || combined.includes('coding')) {
    return '更适合开发者先关注';
  }
  if (combined.includes('product') || combined.includes('workflow') || combined.includes('automation')) {
    return '更适合产品经理和应用探索者';
  }
  return '普通 AI 关注者也能快速理解';
}

function trendLabel(sourceCount: number, heatScore: number): string {
  if (sourceCount >= 3 || heatScore >= 75) return '升温中';
  if (sourceCount === 2 || heatScore >= 55) return '值得观察';
  return '可能是噪音';
}

export function SignalsView({ digest }: { digest: RadarDigest }) {
  const m = digest.multiSourceSections;
  if (!m) return <div className="p-6"><EmptyState title="No multi-source signals" /></div>;

  const trendClusters = (digest.topicClusters?.length
    ? digest.topicClusters
    : digest.trendEntities?.length
      ? digest.trendEntities
      : m.crossSourceHighlights
  ).slice(0, 6);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg">Multi-source Signals</h2>
        <p className="text-sm text-muted-foreground">
          Trend signals beyond GitHub: Product Hunt · Hugging Face · Hacker News
        </p>
      </div>

      <section>
        <h3 className="text-base mb-3">Trend Clusters / 今日趋势主题</h3>
        {trendClusters.length === 0 ? (
          <EmptyState title="No trend clusters today" hint="跨来源信号不足时，会回退展示基础信号卡片。" />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {trendClusters.map((cluster) => {
              const repoCandidates = cluster.sourceItems.filter((item) => item.sourceType === 'opensource' || item.url.includes('github.com'));
              const contentCandidates = cluster.sourceItems.filter((item) => item.sourceType !== 'opensource');
              const label = trendLabel(cluster.sourceCount, cluster.metrics.heatScore);

              return (
                <Card key={cluster.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm">{cluster.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cluster.summary ?? '多个来源都出现了这个主题，说明它值得持续关注。'}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{cluster.sourceCount} sources</div>
                      <div className="mt-1 text-foreground">Heat {cluster.metrics.heatScore}</div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground">相关 GitHub 项目：</span>
                      {repoCandidates.length > 0 ? repoCandidates.slice(0, 2).map((item) => item.title).join('、') : '可从下方 Cross-source Highlights 继续查看'}
                    </p>
                    <p>
                      <span className="text-foreground">相关产品/资讯：</span>
                      {contentCandidates.length > 0 ? contentCandidates.slice(0, 2).map((item) => item.title).join('、') : '当前以开发者信号为主'}
                    </p>
                    <p>
                      <span className="text-foreground">适合谁关注：</span>
                      {audienceHint(cluster.title, cluster.category)}
                    </p>
                    <p>
                      <span className="text-foreground">趋势判断：</span>
                      {label}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {m.crossSourceHighlights.length > 0 && (
        <section>
          <h3 className="text-base mb-3">Cross-source Highlights</h3>
          <div className="grid grid-cols-1 gap-3">
            {m.crossSourceHighlights.map((e) => <CrossSourceCard key={e.id} entity={e} />)}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MultiSourceSignalCard 
          title="Product Launches" 
          items={m.productLaunches.slice(0, 5)} 
          accent="bg-fuchsia-500" 
          showLLMSummary={true}
        />
        <MultiSourceSignalCard 
          title="Model / Demo Signals" 
          items={m.modelDemoSignals} 
          accent="bg-cyan-500" 
        />
        <MultiSourceSignalCard 
          title="Developer Buzz" 
          items={m.developerBuzz.slice(0, 5)} 
          accent="bg-orange-500" 
          showLLMSummary={true}
        />
      </div>

      <ContributionCTA
        title="Recommend a new signal source"
        description="如果你希望我们接入新的信息源，或者发现趋势归类不准确，欢迎在 GitHub 提 issue。"
      />
    </div>
  );
}
