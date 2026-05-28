import { Card } from '../../ui/card';
import { CategoryHeatCard } from '../CategoryHeat';
import { CategoryBadge } from '../Badges';
import { fmtNum } from '../../../utils/format';
import type { RadarDigest } from '../../../types/radar';

export function CategoriesView({ digest }: { digest: RadarDigest }) {
  const stats = digest.categoryStats ?? [];

  const topByCategory: Record<string, typeof digest.selectedProjects[number] | undefined> = {};
  for (const p of digest.selectedProjects) {
    const c = p.repository.category;
    if (!topByCategory[c] || (topByCategory[c]!.score.finalScore < p.score.finalScore)) {
      topByCategory[c] = p;
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg">Categories</h2>
        <p className="text-sm text-muted-foreground">Direction-level heat across the AI radar profile</p>
      </div>

      <CategoryHeatCard stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {stats.map((s) => {
          const top = topByCategory[s.category];
          return (
            <Card key={s.category} className="p-4">
              <CategoryBadge category={s.category} />
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Repos</div>
                  <div className="tabular-nums">{s.repoCount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg 7d Δ</div>
                  <div className="tabular-nums">{fmtNum(s.averageWeeklyStarDelta)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {s.selectedRepoCount == null ? 'New' : 'Selected'}
                  </div>
                  <div className="tabular-nums">{s.selectedRepoCount ?? s.newRepoCount}</div>
                </div>
              </div>
              {top && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">Top repo</div>
                  <a href={top.repository.repoUrl} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                    {top.repository.repoFullName}
                  </a>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{top.repository.description}</div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
