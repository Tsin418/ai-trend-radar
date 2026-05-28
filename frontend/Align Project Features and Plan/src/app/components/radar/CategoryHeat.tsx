import { Card } from '../ui/card';
import { fmtNum } from '../../utils/format';
import type { RadarCategoryStat } from '../../types/radar';

export function CategoryHeatCard({ stats }: { stats: RadarCategoryStat[] }) {
  const max = Math.max(1, ...stats.map((s) => s.averageWeeklyStarDelta ?? 0));
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm">Category Heat</div>
          <div className="text-xs text-muted-foreground">Avg weekly star delta · new repo count</div>
        </div>
      </div>
      <div className="space-y-2">
        {stats.map((s) => {
          const w = ((s.averageWeeklyStarDelta ?? 0) / max) * 100;
          const sideLabel = s.selectedRepoCount == null ? `+${s.newRepoCount} new` : `${s.selectedRepoCount} selected`;
          return (
            <div key={s.category} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{s.category}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {fmtNum(s.averageWeeklyStarDelta)} avg · {s.repoCount} repos
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full"
                    style={{ width: `${w}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground w-20 text-right">{sideLabel}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
