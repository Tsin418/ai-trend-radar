import { Card } from '../../ui/card';
import { ProjectCard } from '../ProjectCard';
import { WarningBanner } from '../WarningBanner';
import { EmptyState } from '../EmptyState';
import type { RadarDigest } from '../../../types/radar';

const headlineNumberPattern = /([+-]?\d[\d,]*(?:\.\d+)?(?:[x×%kKmMbBhHdD])?)/g;
const headlineNumberOnlyPattern = /^[+-]?\d[\d,]*(?:\.\d+)?(?:[x×%kKmMbBhHdD])?$/;
const projectGridClass = 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3';

function renderHeadlineText(text: string) {
  return text.split(headlineNumberPattern).map((part, index) => {
    if (!headlineNumberOnlyPattern.test(part)) {
      return part;
    }

    return (
      <span key={`${part}-${index}`} className="font-bold text-foreground">
        {part}
      </span>
    );
  });
}

export function DashboardView({
  digest, onOpenDetail,
}: {
  digest: RadarDigest;
  onOpenDetail: (repo: string) => void;
}) {
  return (
    <div>
      {digest.baselineCreated && (
        <div className="p-6 pb-0">
          <WarningBanner
            level="info"
            title="Baseline snapshot created today"
            message="Daily/weekly delta values will become reliable once 7 consecutive snapshots have been recorded."
          />
        </div>
      )}

      <Card className="rounded-none border-x-0 border-t-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Today's headline</div>
            <h2 className="mt-2 text-3xl leading-tight sm:text-4xl">
              {renderHeadlineText(digest.headline)}
            </h2>
            <p className="mt-5 text-base text-muted-foreground leading-8">
              {renderHeadlineText(digest.summary)}
            </p>
          </div>
        </div>
      </Card>

      <div className="p-6 space-y-5">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base">Top Hot Projects</h3>
            <span className="text-xs text-muted-foreground">{digest.hotProjects.length} projects</span>
          </div>
          {digest.hotProjects.length === 0 ? (
            <EmptyState title="No hot projects today" hint="The bar may not have been crossed yet." />
          ) : (
            <div className={projectGridClass}>
              {digest.hotProjects.map((p) => (
                <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base">Early Signals</h3>
            <span className="text-xs text-muted-foreground">{digest.earlySignals.length} signals</span>
          </div>
          {digest.earlySignals.length === 0 ? (
            <EmptyState title="No early signals matched the threshold today" />
          ) : (
            <div className={projectGridClass}>
              {digest.earlySignals.map((p) => (
                <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base">Watchlist Movements</h3>
            <span className="text-xs text-muted-foreground">{digest.watchlistMovements.length} repos</span>
          </div>
          {digest.watchlistMovements.length === 0 ? (
            <EmptyState title="No watchlist movement today" hint="Watchlist repos didn't cross movement thresholds." />
          ) : (
            <div className={projectGridClass}>
              {digest.watchlistMovements.map((p) => (
                <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
