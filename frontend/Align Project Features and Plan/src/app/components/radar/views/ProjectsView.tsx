import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';
import { Button } from '../../ui/button';
import { ProjectFilters, defaultFilters, applyFilters, type FilterState } from '../ProjectFilters';
import { ProjectTable } from '../ProjectTable';
import { ProjectCard } from '../ProjectCard';
import { EmptyState } from '../EmptyState';
import type { ScoredRadarRepository } from '../../../types/radar';
import { LayoutGrid, Rows3 } from 'lucide-react';

export function ProjectsView({
  projects, onOpenDetail,
}: {
  projects: ScoredRadarRepository[];
  onOpenDetail: (repo: string) => void;
}) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [view, setView] = useState<'table' | 'cards'>('table');

  const categories = useMemo(
    () => Array.from(new Set(projects.map((p) => p.repository.category))).sort(),
    [projects],
  );
  const sources = useMemo(
    () => Array.from(new Set(projects.map((p) => p.repository.source))).sort(),
    [projects],
  );
  const languages = useMemo(
    () => Array.from(new Set(projects.map((p) => p.repository.language).filter(Boolean) as string[])).sort(),
    [projects],
  );

  const filtered = useMemo(() => applyFilters(projects, filters), [projects, filters]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg">Projects</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {projects.length} projects · ranked by {filters.sortBy}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFilters(defaultFilters)}>Reset</Button>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="table" className="text-xs px-2"><Rows3 className="w-3.5 h-3.5" /></TabsTrigger>
              <TabsTrigger value="cards" className="text-xs px-2"><LayoutGrid className="w-3.5 h-3.5" /></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <ProjectFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        sources={sources}
        languages={languages}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No projects match the current filters" hint="Try clearing filters or broadening the search." />
      ) : view === 'table' ? (
        <ProjectTable projects={filtered} onOpenDetail={onOpenDetail} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <ProjectCard key={p.repository.repoFullName} project={p} onOpenDetail={onOpenDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
