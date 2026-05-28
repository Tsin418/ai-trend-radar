import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ExternalLink, Star, GitFork, CircleDot } from 'lucide-react';
import { CategoryBadge, RiskBadge, SourceBadge, TrendBadge, WatchlistBadge } from './Badges';
import { ScoreBreakdown } from './ScoreBreakdown';
import { fmtDate, fmtDelta, fmtNum, fmtRate, fmtRelative } from '../../utils/format';
import type { ScoredRadarRepository } from '../../types/radar';

export function ProjectDetailDrawer({
  project, open, onClose,
}: {
  project: ScoredRadarRepository | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="!w-[640px] !max-w-[90vw] sm:!max-w-[640px] overflow-y-auto p-0">
        {project && (
          <div className="p-6">
            <SheetHeader className="space-y-2 text-left p-0">
              <div className="flex items-start justify-between gap-3">
                <SheetTitle className="text-base flex items-center gap-2 flex-wrap">
                  <span>{project.repository.repoFullName}</span>
                  {project.repository.isWatchlist && (
                    <WatchlistBadge
                      source={project.repository.watchlistSource}
                      status={project.repository.watchlistStatus}
                      newlyPromoted={project.repository.newlyPromotedToWatchlist}
                    />
                  )}
                </SheetTitle>
                <Button variant="outline" size="sm" asChild>
                  <a href={project.repository.repoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> GitHub
                  </a>
                </Button>
              </div>
              <SheetDescription className="text-sm">{project.repository.description}</SheetDescription>
            </SheetHeader>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <CategoryBadge category={project.repository.category} />
              <TrendBadge type={project.score.trendType} />
              <RiskBadge level={project.score.riskLevel} />
              <SourceBadge source={project.repository.source} />
              {project.repository.language && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
                  {project.repository.language}
                </span>
              )}
            </div>

            <Separator className="my-4" />

            <Section title="Growth">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Stars" icon={<Star className="w-3 h-3" />} value={fmtNum(project.repository.stars)} />
                <Stat label="Forks" icon={<GitFork className="w-3 h-3" />} value={fmtNum(project.repository.forks)} />
                <Stat label="Open Issues" icon={<CircleDot className="w-3 h-3" />} value={fmtNum(project.repository.openIssues)} />
                <Stat label="24h Δ" value={fmtDelta(project.score.dailyStarDelta, 'Baseline')} highlight={!!project.score.dailyStarDelta} />
                <Stat label="7d Δ" value={fmtDelta(project.score.weeklyStarDelta, 'Need 7d')} highlight={!!project.score.weeklyStarDelta} />
                <Stat label="Yesterday" value={fmtDelta(project.score.yesterdayStarDelta)} />
                <Stat label="Daily growth" value={fmtRate(project.score.dailyGrowthRate)} />
                <Stat label="Weekly growth" value={fmtRate(project.score.weeklyGrowthRate)} />
                <Stat label="Acceleration" value={`${project.score.acceleration.toFixed(2)}× (${project.score.accelerationConfidence})`} />
              </div>
            </Section>

            <Section title="Score Breakdown">
              <ScoreBreakdown score={project.score} />
            </Section>

            {project.score.signals.length > 0 && (
              <Section title="Signals">
                <ul className="text-sm space-y-1">
                  {project.score.signals.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground/60" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Why it matters">
              <p className="text-sm">{project.whyItMatters}</p>
            </Section>

            <Section title="Developer insight">
              <p className="text-sm">{project.developerInsight}</p>
            </Section>

            {project.llmSummary && (
              <Section title={`LLM Summary · confidence ${project.llmSummary.confidence}`}>
                <div className="text-sm space-y-2">
                  <div className="px-3 py-2 rounded-md bg-indigo-50/60 border border-indigo-100 text-indigo-900">
                    {project.llmSummary.oneLiner}
                  </div>
                  <KV k="Problem solved" v={project.llmSummary.problemSolved} />
                  <KV k="Why now" v={project.llmSummary.whyNow} />
                  <KV k="What changed" v={project.llmSummary.whatChanged} />
                  <KV k="Why trending" v={project.llmSummary.whyTrending} />
                  <KV k="Developer takeaway" v={project.llmSummary.developerTakeaway} />
                  <KV k="Target users" v={project.llmSummary.targetUsers} />
                  <KV k="Risk notes" v={project.llmSummary.riskNotes} warning />
                </div>
              </Section>
            )}

            <Section title="Metadata">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Meta k="Created" v={fmtDate(project.repository.createdAt)} />
                <Meta k="Pushed" v={fmtRelative(project.repository.pushedAt)} />
                <Meta k="First seen" v={fmtDate(project.repository.firstSeenAt)} />
                <Meta k="Last seen" v={fmtDate(project.repository.lastSeenAt)} />
                {project.repository.watchlistPromotedAt && (
                  <Meta k="Promoted" v={fmtDate(project.repository.watchlistPromotedAt)} />
                )}
                {project.repository.watchlistLastMovementAt && (
                  <Meta k="Last movement" v={fmtDate(project.repository.watchlistLastMovementAt)} />
                )}
              </div>
              {project.repository.watchlistPromotedReason && (
                <p className="mt-2 text-xs text-muted-foreground">{project.repository.watchlistPromotedReason}</p>
              )}
              {project.repository.topics?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {project.repository.topics.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">#{t}</span>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
      {children}
    </section>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`tabular-nums ${highlight ? 'text-emerald-700' : ''}`}>{value}</div>
    </div>
  );
}

function KV({ k, v, warning }: { k: string; v: string; warning?: boolean }) {
  return (
    <div>
      <div className={`text-xs ${warning ? 'text-amber-700' : 'text-muted-foreground'}`}>{k}</div>
      <div>{v}</div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border rounded-md px-3 py-2">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
