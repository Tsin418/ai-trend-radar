import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ExternalLink, Star, GitFork, CircleDot, Zap } from 'lucide-react';
import { CategoryBadge, RiskBadge, SourceBadge, TrendBadge, WatchlistBadge } from './Badges';
import { fmtDelta, fmtNum, fmtRelative } from '../../utils/format';
import type { ScoredRadarRepository } from '../../types/radar';

export function ProjectCard({
  project, onOpenDetail, showWhy = true,
}: {
  project: ScoredRadarRepository;
  onOpenDetail: (repoFullName: string) => void;
  showWhy?: boolean;
}) {
  const r = project.repository;
  const s = project.score;

  return (
    <Card className="p-4 hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onOpenDetail(r.repoFullName)}
              className="text-sm hover:underline underline-offset-2 truncate text-left"
            >
              {r.repoFullName}
            </button>
            {r.isWatchlist && <WatchlistBadge />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Final</div>
          <div className="text-2xl tabular-nums leading-none">{s.finalScore}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <CategoryBadge category={r.category} />
        <TrendBadge type={s.trendType} />
        <RiskBadge level={s.riskLevel} />
        <SourceBadge source={r.source} />
        {r.language && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
            {r.language}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3" /> Stars</div>
          <div className="tabular-nums">{fmtNum(r.stars)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">24h Δ</div>
          <div className={`tabular-nums ${s.dailyStarDelta == null ? 'text-muted-foreground' : 'text-emerald-700'}`}>
            {fmtDelta(s.dailyStarDelta, 'Baseline')}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">7d Δ</div>
          <div className={`tabular-nums ${s.weeklyStarDelta == null ? 'text-muted-foreground' : ''}`}>
            {fmtDelta(s.weeklyStarDelta, 'Need 7d snapshots')}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Accel</div>
          <div className="tabular-nums">{s.acceleration.toFixed(2)}×</div>
        </div>
      </div>

      {showWhy && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="text-foreground">Why:</span> {project.whyItMatters}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{fmtNum(r.forks)}</span>
          <span className="flex items-center gap-1"><CircleDot className="w-3 h-3" />{fmtNum(r.openIssues)}</span>
          <span>pushed {fmtRelative(r.pushedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <a href={r.repoUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" /> GitHub
            </a>
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => onOpenDetail(r.repoFullName)}>
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
