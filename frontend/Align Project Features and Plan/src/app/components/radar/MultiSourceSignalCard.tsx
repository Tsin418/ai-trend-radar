import { Card } from '../ui/card';
import { ExternalLink, Sparkles } from 'lucide-react';
import { CategoryBadge } from './Badges';
import { fmtNum } from '../../utils/format';
import type { TrendItem } from '../../types/radar';

export function MultiSourceSignalCard({
  title, items, accent, showLLMSummary,
}: {
  title: string;
  items: TrendItem[];
  accent?: string;
  showLLMSummary?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {accent && <span className={`w-2 h-2 rounded-full ${accent}`} />}
          <div className="text-sm">{title}</div>
        </div>
        <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 && 's'}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No items</div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm hover:underline underline-offset-2 truncate inline-flex items-center gap-1"
                  >
                    {it.title}
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                  {it.category && <CategoryBadge category={it.category} />}
                </div>
                {(it.summary || it.description) && (
                  <div className="mt-1.5 space-y-1">
                    {showLLMSummary && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="w-3 h-3" />
                        AI Summary
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {it.summary || it.description}
                    </p>
                  </div>
                )}
                {it.recommendedReason && (
                  <p className="text-xs text-foreground/80 mt-1">
                    <span className="text-muted-foreground">Why: </span>{it.recommendedReason}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{it.source}</span>
                  {it.metrics?.upvotes != null && <span>▲ {fmtNum(it.metrics.upvotes)}</span>}
                  {it.metrics?.likes != null && <span>♥ {fmtNum(it.metrics.likes)}</span>}
                  {it.metrics?.downloads != null && <span>↓ {fmtNum(it.metrics.downloads)}</span>}
                  {it.metrics?.commentsCount != null && <span>💬 {fmtNum(it.metrics.commentsCount)}</span>}
                  {it.metrics?.rank != null && <span>#{it.metrics.rank}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
