import { Card } from '../ui/card';
import { fmtNum } from '../../utils/format';
import type { RadarCategoryStat } from '../../types/radar';

export function CategoryHeatCard({ stats }: { stats: RadarCategoryStat[] }) {
  const maxRepoCount = Math.max(1, ...stats.map((s) => s.repoCount));

  const heatClass = (count: number) => {
    const ratio = count / maxRepoCount;
    if (ratio >= 0.75) return 'from-rose-500 to-orange-400 text-rose-700 bg-rose-50 border-rose-200';
    if (ratio >= 0.5) return 'from-amber-400 to-yellow-300 text-amber-700 bg-amber-50 border-amber-200';
    if (ratio >= 0.25) return 'from-sky-400 to-cyan-300 text-sky-700 bg-sky-50 border-sky-200';
    return 'from-slate-300 to-slate-200 text-slate-600 bg-slate-50 border-slate-200';
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm">Category Heat</div>
          <div className="text-xs text-muted-foreground">Repo count intensity · avg weekly star delta</div>
        </div>
      </div>
      <div className="space-y-3">
        {stats.map((s) => {
          const w = Math.max(4, (s.repoCount / maxRepoCount) * 100);
          const sideLabel = s.selectedRepoCount == null ? `+${s.newRepoCount} new` : `${s.selectedRepoCount} selected`;
          const classes = heatClass(s.repoCount);
          return (
            <div key={s.category} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{s.category}</span>
                  <span className={`tabular-nums text-xs px-2 py-0.5 rounded-full border ${classes.split(' ').slice(2).join(' ')}`}>
                    {s.repoCount} repos
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                  <div
                    className={`h-full bg-gradient-to-r ${classes.split(' ').slice(0, 2).join(' ')} rounded-full`}
                    style={{ width: `${w}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground w-32 text-right">
                {fmtNum(s.averageWeeklyStarDelta)} avg · {sideLabel}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
