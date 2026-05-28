import { Card } from '../ui/card';
import { ExternalLink, Sparkles } from 'lucide-react';
import { CategoryBadge } from './Badges';
import { fmtNum } from '../../utils/format';
import type { TrendEntity } from '../../types/radar';

export function CrossSourceCard({ entity }: { entity: TrendEntity }) {
  return (
    <Card className="p-4 border-violet-200 bg-gradient-to-br from-violet-50/40 to-transparent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <a
              href={entity.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm hover:underline underline-offset-2 inline-flex items-center gap-1"
            >
              {entity.title}
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
            {entity.category && <CategoryBadge category={entity.category} />}
          </div>
          {entity.summary && <p className="text-xs text-muted-foreground mt-1">{entity.summary}</p>}
          {entity.whyItMatters && (
            <p className="text-xs mt-1.5">
              <span className="text-muted-foreground">Why: </span>{entity.whyItMatters}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Heat</div>
          <div className="text-2xl tabular-nums leading-none">{entity.metrics.heatScore}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {entity.sources.map((s) => (
          <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">{s}</span>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          +{entity.crossSourceBonus} cross-source bonus · {entity.metrics.starDelta24h != null ? `+${fmtNum(entity.metrics.starDelta24h)} 24h Δ` : ''}
        </span>
      </div>
    </Card>
  );
}
