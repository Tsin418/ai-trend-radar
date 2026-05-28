import { Card } from '../../ui/card';
import { CategoryBadge } from '../Badges';
import type { RadarDigest } from '../../../types/radar';
import { EmptyState } from '../EmptyState';

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return '00:00';
  }
}

export function InformationView({ digest }: { digest: RadarDigest }) {
  const items = digest.multiSourceSections?.aihotHighlights || [];

  if (items.length === 0) {
    return <div className="p-6"><EmptyState title="No AI News found" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-lg">Information</h2>
        <p className="text-sm text-muted-foreground">AI automatically curated high-value content</p>
      </div>
      
      <div className="relative">
        <div className="absolute left-[55.5px] sm:left-[79.5px] top-6 bottom-[-32px] w-px bg-border/60"></div>
        <div className="space-y-8 pb-8">
          {items.map((it) => {
            const time = formatTime(it.publishedAt || it.collectedAt);
            return (
              <div key={it.id} className="relative flex items-start gap-4 sm:gap-8 group">
                {/* Timeline time block */}
                <div className="w-12 sm:w-16 flex-shrink-0 text-right pt-4 text-sm font-medium text-foreground">
                  {time}
                </div>
                {/* Timeline dot */}
                <div className="absolute left-[51px] sm:left-[75px] top-[21.5px] w-[10px] h-[10px] rounded-full bg-border group-hover:bg-primary transition-colors ring-4 ring-background z-10"></div>
                
                {/* Card block */}
                <Card className="flex-1 hover:bg-muted/30 transition-colors min-w-0">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">{it.source}</span>
                    </div>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-base sm:text-lg font-medium hover:underline underline-offset-2 flex text-foreground"
                    >
                      {it.title}
                    </a>
                    {(it.summary || it.description) && (
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                        {it.summary || it.description}
                      </p>
                    )}
                    
                    {it.tags && it.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {it.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                            {t}
                          </span>
                        ))}
                        {it.category && <CategoryBadge category={it.category} />}
                      </div>
                    )}

                    {it.recommendedReason && (
                      <div className="mt-4 p-3 bg-emerald-500/10 rounded-md">
                         <div className="flex gap-2">
                           <span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm whitespace-nowrap">推荐理由:</span>
                           <span className="text-emerald-700/90 dark:text-emerald-400/90 text-sm leading-relaxed">{it.recommendedReason}</span>
                         </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
