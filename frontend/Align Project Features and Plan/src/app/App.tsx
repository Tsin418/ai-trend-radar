import { useMemo, useState } from 'react';
import { Toaster } from './components/ui/sonner';
import { SidebarNav, type ViewKey } from './components/radar/SidebarNav';
import { TopBar } from './components/radar/TopBar';
import { ProjectDetailDrawer } from './components/radar/ProjectDetailDrawer';
import { DashboardView } from './components/radar/views/DashboardView';
import { ProjectsView } from './components/radar/views/ProjectsView';
import { CategoriesView } from './components/radar/views/CategoriesView';
import { SignalsView } from './components/radar/views/SignalsView';
import { WatchlistView } from './components/radar/views/WatchlistView';
import { DigestView } from './components/radar/views/DigestView';
import { InformationView } from './components/radar/views/InformationView';
import { SettingsView } from './components/radar/views/SettingsView';
import { statusOf } from './components/radar/SourceHealthStrip';
import { WarningBanner } from './components/radar/WarningBanner';
import { useRadarDigest } from './hooks/useRadarDigest';
import type { GrowthLinks } from './types/radar';

const viewLabels: Record<ViewKey, string> = {
  dashboard: 'Today Radar',
  projects: 'Projects',
  categories: 'Categories',
  signals: 'Multi-source Signals',
  watchlist: 'Watchlist',
  digests: 'Digests',
  information: 'News',
  settings: 'Settings',
};

const emptyGrowthLinks: GrowthLinks = {
  githubRepoUrl: '',
  githubProfileUrl: '',
  personalHomepageUrl: '',
  linkedinUrl: '',
  xiaohongshuUrl: '',
};

export default function App() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [openRepo, setOpenRepo] = useState<string | null>(null);

  const { digest, loading, error, usingFallback } = useRadarDigest();

  const allProjects = useMemo(() => {
    const map = new Map<string, typeof digest.selectedProjects[number]>();
    [
      ...digest.selectedProjects,
      ...digest.hotProjects,
      ...digest.acceleratingProjects,
      ...digest.earlySignals,
      ...digest.watchlistMovements,
    ].forEach((p) => map.set(p.repository.repoFullName, p));
    return Array.from(map.values());
  }, [digest]);

  const selectedProject = useMemo(
    () => allProjects.find((p) => p.repository.repoFullName === openRepo) ?? null,
    [allProjects, openRepo],
  );

  const healthCount = useMemo(() => {
    const sources = digest.sourceHealth ?? [];
    return {
      failing: sources.filter((s) => statusOf(s) === 'failed').length,
      warning: sources.filter((s) => statusOf(s) === 'warning').length,
    };
  }, [digest.sourceHealth]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <SidebarNav view={view} onChange={setView} healthCount={healthCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          date={digest.date}
          generatedAt={digest.generatedAt}
          viewLabel={viewLabels[view]}
          growthLinks={digest.growthLinks ?? emptyGrowthLinks}
        />
        <main className="flex-1 overflow-y-auto">
          {(loading || usingFallback) && (
            <div className="px-6 pt-6">
              {loading && (
                <WarningBanner
                  level="info"
                  title="Loading latest dashboard data"
                  message="The dashboard is reading the latest generated JSON snapshot."
                />
              )}
              {usingFallback && (
                <WarningBanner
                  level="warning"
                  title="Using mock data because backend dashboard JSON failed to load."
                  message={error?.message}
                />
              )}
            </div>
          )}
          {view === 'dashboard' && <DashboardView digest={digest} onOpenDetail={setOpenRepo} />}
          {view === 'projects' && <ProjectsView projects={allProjects} onOpenDetail={setOpenRepo} />}
          {view === 'categories' && <CategoriesView digest={digest} />}
          {view === 'signals' && <SignalsView digest={digest} />}
          {view === 'watchlist' && <WatchlistView projects={allProjects} onOpenDetail={setOpenRepo} />}
          {view === 'digests' && <DigestView digest={digest} />}
          {view === 'information' && <InformationView digest={digest} />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
      <ProjectDetailDrawer
        project={selectedProject}
        open={openRepo !== null}
        onClose={() => setOpenRepo(null)}
      />
      <Toaster position="bottom-right" />
    </div>
  );
}
