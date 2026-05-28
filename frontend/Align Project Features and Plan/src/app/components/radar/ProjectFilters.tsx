import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Search } from 'lucide-react';

export interface FilterState {
  q: string;
  category: string;
  source: string;
  language: string;
  trendType: string;
  riskLevel: string;
  watchlistOnly: boolean;
  hotToday: boolean;
  earlyOnly: boolean;
  sortBy: 'finalScore' | 'dailyStarDelta' | 'weeklyStarDelta' | 'acceleration' | 'pushedAt';
}

export const defaultFilters: FilterState = {
  q: '',
  category: 'all',
  source: 'all',
  language: 'all',
  trendType: 'all',
  riskLevel: 'all',
  watchlistOnly: false,
  hotToday: false,
  earlyOnly: false,
  sortBy: 'finalScore',
};

export function ProjectFilters({
  filters, onChange, categories, sources, languages,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  categories: string[];
  sources: string[];
  languages: string[];
}) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => onChange({ ...filters, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search repo, description, topic..."
            className="pl-9 h-9"
          />
        </div>

        <Select value={filters.category} onValueChange={(v) => set('category', v)}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.source} onValueChange={(v) => set('source', v)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.language} onValueChange={(v) => set('language', v)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Language" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.trendType} onValueChange={(v) => set('trendType', v)}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Trend" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trends</SelectItem>
            <SelectItem value="sustained_hot">Sustained Hot</SelectItem>
            <SelectItem value="sudden_breakout">Breakout</SelectItem>
            <SelectItem value="early_signal">Early Signal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.riskLevel} onValueChange={(v) => set('riskLevel', v)}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Risk" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sortBy} onValueChange={(v) => set('sortBy', v as FilterState['sortBy'])}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="finalScore">Sort: Final score</SelectItem>
            <SelectItem value="dailyStarDelta">Sort: 24h delta</SelectItem>
            <SelectItem value="weeklyStarDelta">Sort: 7d delta</SelectItem>
            <SelectItem value="acceleration">Sort: Acceleration</SelectItem>
            <SelectItem value="pushedAt">Sort: Recently pushed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={filters.watchlistOnly} onCheckedChange={(v) => set('watchlistOnly', v)} />
          <span>Watchlist only</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={filters.hotToday} onCheckedChange={(v) => set('hotToday', v)} />
          <span>Hot today</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={filters.earlyOnly} onCheckedChange={(v) => set('earlyOnly', v)} />
          <span>Early signals only</span>
        </label>
      </div>
    </div>
  );
}

export function applyFilters(
  list: import('../../types/radar').ScoredRadarRepository[],
  f: FilterState,
): import('../../types/radar').ScoredRadarRepository[] {
  let out = list.filter((p) => {
    const r = p.repository;
    const s = p.score;
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${r.repoFullName} ${r.description} ${(r.topics || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.category !== 'all' && r.category !== f.category) return false;
    if (f.source !== 'all' && r.source !== f.source) return false;
    if (f.language !== 'all' && r.language !== f.language) return false;
    if (f.trendType !== 'all' && s.trendType !== f.trendType) return false;
    if (f.riskLevel !== 'all' && s.riskLevel !== f.riskLevel) return false;
    if (f.watchlistOnly && !r.isWatchlist) return false;
    if (f.hotToday && s.trendType === 'early_signal') return false;
    if (f.earlyOnly && s.trendType !== 'early_signal') return false;
    return true;
  });
  out = [...out].sort((a, b) => {
    const av = (a.score as any)[f.sortBy] ?? 0;
    const bv = (b.score as any)[f.sortBy] ?? 0;
    if (f.sortBy === 'pushedAt') {
      return new Date(b.repository.pushedAt || 0).getTime() - new Date(a.repository.pushedAt || 0).getTime();
    }
    return bv - av;
  });
  return out;
}
