import { Card } from '../../ui/card';
import { ProjectCard } from '../ProjectCard';
import { EmptyState } from '../EmptyState';
import { ContributionCTA } from '../ContributionCTA';
import type { ScoredRadarRepository } from '../../../types/radar';

function statusSummary(label: string): string {
  if (label === 'Newly Promoted') return '刚进入重点观察名单，代表最近出现了明显上升信号。';
  if (label === 'Cooling') return '热度在回落，但仍建议观察是否会二次升温。';
  if (label === 'Auto Watchlist') return '由系统自动识别并加入，适合持续观察趋势变化。';
  return '由人工加入的长期关注项目，通常和你的长期方向相关。';
}

function suggestedAction(project: ScoredRadarRepository): string {
  if (project.repository.newlyPromotedToWatchlist) return '建议动作：继续关注';
  if (project.repository.watchlistStatus === 'cooling') return '建议动作：暂时观察';
  if (project.repository.watchlistSource === 'manual') return '建议动作：持续跟踪';
  return '建议动作：按日观察';
}

function movementLabel(value?: string): string {
  if (!value) return '暂无最近移动时间';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`;
}

export function WatchlistView({
  projects, onOpenDetail,
}: {
  projects: ScoredRadarRepository[];
  onOpenDetail: (repo: string) => void;
}) {
  const watchlist = projects.filter((p) => p.repository.isWatchlist);
  const grouped = watchlist.reduce<Record<string, ScoredRadarRepository[]>>((acc, p) => {
    const status = p.repository.newlyPromotedToWatchlist
      ? 'Newly Promoted'
      : p.repository.watchlistStatus === 'cooling'
        ? 'Cooling'
        : p.repository.watchlistSource === 'auto'
          ? 'Auto Watchlist'
          : 'Manual Watchlist';
    (acc[status] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg">Watchlist</h2>
        <p className="text-sm text-muted-foreground">{watchlist.length} tracked repos with current movements · grouped by state</p>
      </div>
      {watchlist.length === 0 ? (
        <EmptyState title="No watchlist projects yet" hint="Add repos to your watchlist to track long-term." />
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <Card key={cat} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm">{cat}</div>
              <span className="text-xs text-muted-foreground">{items.length} repos</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{statusSummary(cat)}</p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {items.map((p) => (
                <div key={p.repository.repoFullName} className="space-y-2">
                  <ProjectCard project={p} onOpenDetail={onOpenDetail} showWhy={false} />
                  <div className="rounded-md border p-2.5 text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground">最近状态：</span>
                      {movementLabel(p.repository.watchlistLastMovementAt)}
                    </p>
                    <p className="mt-1">
                      <span className="text-foreground">{suggestedAction(p)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
      <ContributionCTA
        title="Report wrong watchlist status"
        description="如果你认为某个项目的 watchlist 状态不合理，欢迎提交 issue 帮我们修正。"
      />
    </div>
  );
}
