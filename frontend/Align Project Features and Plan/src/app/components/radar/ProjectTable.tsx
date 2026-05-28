import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { ExternalLink } from 'lucide-react';
import { CategoryBadge, RiskBadge, TrendBadge, WatchlistBadge } from './Badges';
import { fmtDelta, fmtNum, fmtRelative } from '../../utils/format';
import type { ScoredRadarRepository } from '../../types/radar';

export function ProjectTable({
  projects, onOpenDetail,
}: {
  projects: ScoredRadarRepository[];
  onOpenDetail: (repoFullName: string) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Repository</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Trend</TableHead>
            <TableHead className="text-right">Stars</TableHead>
            <TableHead className="text-right">24h Δ</TableHead>
            <TableHead className="text-right">7d Δ</TableHead>
            <TableHead className="text-right">Accel</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Pushed</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => {
            const r = p.repository;
            const s = p.score;
            return (
              <TableRow key={r.repoFullName} className="cursor-pointer" onClick={() => onOpenDetail(r.repoFullName)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{r.repoFullName}</span>
                    {r.isWatchlist && <WatchlistBadge />}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                </TableCell>
                <TableCell><CategoryBadge category={r.category} /></TableCell>
                <TableCell><TrendBadge type={s.trendType} /></TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(r.stars)}</TableCell>
                <TableCell className={`text-right tabular-nums ${s.dailyStarDelta == null ? 'text-muted-foreground' : 'text-emerald-700'}`}>
                  {fmtDelta(s.dailyStarDelta, 'Baseline')}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${s.weeklyStarDelta == null ? 'text-muted-foreground' : ''}`}>
                  {fmtDelta(s.weeklyStarDelta, 'Need 7d')}
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.acceleration.toFixed(2)}×</TableCell>
                <TableCell className="text-right tabular-nums">{s.finalScore}</TableCell>
                <TableCell><RiskBadge level={s.riskLevel} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtRelative(r.pushedAt)}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" asChild className="h-7">
                    <a href={r.repoUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
