import { Card } from '../../ui/card';
import { KpiCard } from '../KpiCard';
import { CategoryHeatCard } from '../CategoryHeat';
import { SourceHealthStrip, statusOf } from '../SourceHealthStrip';
import { ProjectCard } from '../ProjectCard';
import { CrossSourceCard } from '../CrossSourceCard';
import { WarningBanner } from '../WarningBanner';
import { EmptyState } from '../EmptyState';
import type { RadarDigest } from '../../../types/radar';

export function DashboardView({
  digest, onOpenDetail,
}: {
  digest: RadarDigest;
  onOpenDetail: (repo: string) => void;
}) {
  const failingSources = (digest.sourceHealth ?? []).filter((s) => statusOf(s) === 'failed');
  const warningSources = (digest.sourceHealth ?? []).filter((s) => statusOf(s) === 'warning');

  return (
    <div className="p-6 space-y-5">
      {digest.baselineCreated && (
        <WarningBanner
          level="info"
          title="Baseline snapshot created today"
          message="Daily/weekly delta values will become reliable once 7 consecutive snapshots have been recorded."
        />
      )}
      {failingSources.length > 0 && (
        <WarningBanner
          level="error"
          title={`${failingSources.length} source${failingSources.length > 1 ? 's' : ''} failed in this run`}
          message={failingSources.map((s) => `${s.source}: ${s.error ?? 'unknown error'}`).join(' · ')}
        />
      )}

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Today's headline</div>
            <h2 className="mt-1">{digest.headline}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-3xl">
              {digest.summary}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Scanned Repos" value={digest.scannedRepoCount ?? '—'} accent="default" />
        <KpiCard label="AI Candidates" value={digest.aiCandidateCount ?? '—'} accent="indigo" />
        <KpiCard label="Hot Projects" value={digest.hotProjects.length} accent="success" trend="up" />
        <KpiCard label="Early Signals" value={digest.earlySignals.length} accent="indigo" />
        <KpiCard label="Watchlist Movements" value={digest.watchlistMovements.length} accent="amber" />
        <KpiCard
          label="Source Warnings"
          value={failingSources.length + warningSources.length}
          accent={failingSources.length ? 'red' : warningSources.length ? 'amber' : 'success'}
          warning={failingSources.length > 0 || warningSources.length > 0}
          helper={failingSources.length ? `${failingSources.length} failing` : warningSources.length ? `${warningSources.length} with warning` : 'All healthy'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base">Top Hot Projects</h3>
              <span className="text-xs text-muted-foreground">{digest.hotProjects.length} projects</span>
            </div>
            {digest.hotProjects.length === 0 ? (
              <EmptyState title="No hot projects today" hint="The bar may not have been crossed yet." />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {digest.watchlistMovements.map((p) => (
                  <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {digest.categoryStats && digest.categoryStats.length > 0 && (
            <CategoryHeatCard stats={digest.categoryStats} />
          )}

          {digest.multiSourceSections?.crossSourceHighlights && digest.multiSourceSections.crossSourceHighlights.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base">Cross-source Highlights</h3>
                <span className="text-xs text-muted-foreground">multi-source confirmation</span>
              </div>
              <div className="space-y-3">
                {digest.multiSourceSections.crossSourceHighlights.map((e) => (
                  <CrossSourceCard key={e.id} entity={e} />
                ))}
              </div>
            </section>
          )}

          {digest.dataNotes.length > 0 && (
            <Card className="p-4">
              <div className="text-sm mb-2">Data Notes</div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {digest.dataNotes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {digest.sourceHealth && <SourceHealthStrip sources={digest.sourceHealth} />}
    </div>
  );
}
