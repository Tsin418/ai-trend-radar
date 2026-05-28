import { Card } from '../../ui/card';
import { ProjectCard } from '../ProjectCard';
import { WarningBanner } from '../WarningBanner';
import { EmptyState } from '../EmptyState';
import { ContributionCTA } from '../ContributionCTA';
import type { RadarDigest } from '../../../types/radar';

const headlineNumberPattern = /([+-]?\d[\d,]*(?:\.\d+)?(?:[x×%kKmMbBhHdD])?)/g;
const headlineNumberOnlyPattern = /^[+-]?\d[\d,]*(?:\.\d+)?(?:[x×%kKmMbBhHdD])?$/;
const projectGridClass = 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3';

function fmtSigned(value: number | null | undefined, suffix = ''): string {
  if (value == null) return '变化仍在积累中';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}

function watcherAction(digest: RadarDigest): string {
  const topHot = digest.hotProjects[0];
  if (!topHot) return '今天信号偏分散，先关注“多来源共同出现”的主题会更稳妥。';

  if (topHot.score.acceleration >= 1.35) {
    return `${topHot.repository.name} 热度加速明显，建议优先关注这类方向是否持续 2-3 天。`;
  }
  return `${topHot.repository.name} 仍在上升，但节奏相对平稳，更适合持续观察而不是立刻下判断。`;
}

function renderHeadlineText(text: string) {
  return text.split(headlineNumberPattern).map((part, index) => {
    if (!headlineNumberOnlyPattern.test(part)) {
      return part;
    }

    return (
      <span key={`${part}-${index}`} className="font-bold text-foreground">
        {part}
      </span>
    );
  });
}

export function DashboardView({
  digest, onOpenDetail,
}: {
  digest: RadarDigest;
  onOpenDetail: (repo: string) => void;
}) {
  const multi = digest.multiSourceSections;
  const llmPulse = (digest.llmDigest && (digest.llmDigest.status === 'success' || digest.llmDigest.status === 'fallback'))
    ? digest.llmDigest.todayPulse
    : undefined;
  const topCluster = digest.topicClusters?.[0] ?? digest.trendEntities?.[0] ?? multi?.crossSourceHighlights?.[0];
  const topHot = digest.hotProjects[0];
  const topEarly = digest.earlySignals[0];
  const topProduct = multi?.productLaunches?.[0];
  const topInfo = multi?.aihotHighlights?.[0] ?? multi?.developerBuzz?.[0];

  const pulseChanges = llmPulse
    ? llmPulse.topChanges.slice(0, 3).map((item) => ({ title: item.title, detail: item.summary }))
    : [
        topCluster
          ? {
              title: topCluster.title,
              detail: `跨 ${topCluster.sourceCount} 个来源同时出现，说明这不是单点热度。`,
            }
          : null,
        topHot
          ? {
              title: topHot.repository.repoFullName,
              detail: `今天新增关注 ${fmtSigned(topHot.score.dailyStarDelta)}，开发者讨论度持续走高。`,
            }
          : null,
        topProduct || topInfo
          ? {
              title: topProduct?.title ?? topInfo?.title ?? '资讯流出现新变化',
              detail: topProduct
                ? '产品侧出现新尝试，可帮助判断“技术热度”是否在走向真实应用。'
                : '资讯侧有新信号，适合快速了解今天圈内在讨论什么。',
            }
          : null,
      ].filter((item): item is { title: string; detail: string } => Boolean(item));

  const developerView = llmPulse
    ? [llmPulse.developerView.summary, ...llmPulse.developerView.keyItems.map((item) => `${item}：来自今日开发者信号`) ].slice(0, 3)
    : [
        topHot ? `${topHot.repository.name}：适合看开发者正在集中解决什么问题。` : null,
        topEarly ? `${topEarly.repository.name}：早期升温，适合先收藏观察。` : null,
      ].filter((item): item is string => Boolean(item));

  const productView = llmPulse
    ? [llmPulse.productView.summary, ...llmPulse.productView.keyItems.map((item) => `${item}：来自今日产品信号`) ].slice(0, 3)
    : multi?.productLaunches?.slice(0, 2).map((item) => (
      `${item.title}：${item.recommendedReason ?? '可以帮助你判断这个方向是否正在产品化。'}`
    )) ?? [];

  const informationView = llmPulse
    ? [llmPulse.informationView.summary, ...llmPulse.informationView.keyItems.map((item) => `${item}：来自今日资讯信号`) ].slice(0, 3)
    : [
        ...(multi?.aihotHighlights?.slice(0, 1).map((item) => `${item.title}：${item.summary ?? '适合用来快速了解今天值得看的 AI 资讯。'}`) ?? []),
        ...(multi?.modelDemoSignals?.slice(0, 1).map((item) => `${item.title}：${item.recommendedReason ?? '可作为技术信号的补充参考。'}`) ?? []),
      ];

  return (
    <div>
      {digest.baselineCreated && (
        <div className="p-6 pb-0">
          <WarningBanner
            level="info"
            title="Baseline snapshot created today"
            message="Daily/weekly delta values will become reliable once 7 consecutive snapshots have been recorded."
          />
        </div>
      )}

      <Card className="rounded-none border-x-0 border-t-0 p-4 sm:p-6 lg:p-8">
        <div className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Today&apos;s AI Pulse</div>
            <h2 className="mt-2 text-2xl leading-tight sm:text-3xl">今日 AI 脉搏</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {llmPulse?.executiveSummary ?? '今天最值得关注的变化，按开发者、产品、资讯三个视角做了简化说明。'}
            </p>
          </div>

          <section>
            <h3 className="text-sm mb-2">今日最值得关注的 3 个变化</h3>
            {pulseChanges.length === 0 ? (
              <EmptyState title="今天暂无明显变化" hint="稍后刷新，或先看下方项目与资讯列表。" />
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {pulseChanges.slice(0, 3).map((item) => (
                  <div key={item.title} className="rounded-md border p-3">
                    <div className="text-sm">{item.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-sm">开发者视角</div>
              {developerView.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">今天暂无明显开发者升温信号。</p>
              ) : (
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {developerView.map((line) => <p key={line}>{line}</p>)}
                </div>
              )}
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm">产品视角</div>
              {productView.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">暂未捕捉到明显新品信号，可先关注多源趋势。</p>
              ) : (
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {productView.map((line) => <p key={line}>{line}</p>)}
                </div>
              )}
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm">资讯视角</div>
              {informationView.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">资讯侧暂无高置信精选。</p>
              ) : (
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {informationView.map((line) => <p key={line}>{line}</p>)}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-md border p-3">
            <h3 className="text-sm">今日判断</h3>
            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <p>
                <span className="text-foreground">值得关注：</span>
                {topCluster
                  ? `${topCluster.title} 在多来源同时出现，属于“升温中”方向。`
                  : '今天更适合优先看跨来源重复出现的话题。'}
              </p>
              <p>
                <span className="text-foreground">先别着急下结论：</span>
                {llmPulse?.noiseWarning ?? watcherAction(digest)}
              </p>
            </div>
          </section>
        </div>
      </Card>

      <Card className="rounded-none border-x-0 border-t-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Today's headline</div>
            <h2 className="mt-2 text-3xl leading-tight sm:text-4xl">
              {renderHeadlineText(digest.headline)}
            </h2>
            <p className="mt-5 text-base text-muted-foreground leading-8">
              {renderHeadlineText(digest.summary)}
            </p>
          </div>
        </div>
      </Card>

      <div className="p-6 space-y-5">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base">Top Hot Projects</h3>
            <span className="text-xs text-muted-foreground">{digest.hotProjects.length} projects</span>
          </div>
          {digest.hotProjects.length === 0 ? (
            <EmptyState title="No hot projects today" hint="The bar may not have been crossed yet." />
          ) : (
            <div className={projectGridClass}>
              {digest.hotProjects.map((p) => (
                <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} showWhy={false} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base">Early Signals</h3>
            <span className="text-xs text-muted-foreground">{digest.earlySignals.length} signals</span>
          </div>
          {digest.earlySignals.length === 0 ? (
            <EmptyState title="No early signals matched the threshold today" />
          ) : (
            <div className={projectGridClass}>
              {digest.earlySignals.map((p) => (
                <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} showWhy={false} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base">Watchlist Movements</h3>
            <span className="text-xs text-muted-foreground">{digest.watchlistMovements.length} repos</span>
          </div>
          {digest.watchlistMovements.length === 0 ? (
            <EmptyState title="No watchlist movement today" hint="Watchlist repos didn't cross movement thresholds." />
          ) : (
            <div className={projectGridClass}>
              {digest.watchlistMovements.map((p) => (
                <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} showWhy={false} />
              ))}
            </div>
          )}
        </section>

        <ContributionCTA />
      </div>
    </div>
  );
}
