import { Card } from '../../ui/card';
import { ProjectCard } from '../ProjectCard';
import { EmptyState } from '../EmptyState';
import type { ScoredRadarRepository } from '../../../types/radar';

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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {items.map((p) => (
                <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} />
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
