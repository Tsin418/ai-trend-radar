import { cn } from '../ui/utils';
import {
  LayoutDashboard,
  GitBranch,
  Boxes,
  Radio,
  Star,
  FileText,
  Activity,
  Settings,
  Radar,
} from 'lucide-react';

export type ViewKey =
  | 'dashboard'
  | 'projects'
  | 'categories'
  | 'signals'
  | 'watchlist'
  | 'digests'
  | 'health'
  | 'settings';

const items: { key: ViewKey; label: string; icon: any; hint?: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Today radar' },
  { key: 'projects', label: 'Projects', icon: GitBranch, hint: 'All AI repos' },
  { key: 'categories', label: 'Categories', icon: Boxes, hint: 'Direction heat' },
  { key: 'signals', label: 'Multi-source Signals', icon: Radio, hint: 'PH · HF · HN' },
  { key: 'watchlist', label: 'Watchlist', icon: Star, hint: 'Tracked repos' },
  { key: 'digests', label: 'Digests', icon: FileText, hint: 'Daily / Weekly' },
  { key: 'health', label: 'Source Health', icon: Activity, hint: 'Pipeline status' },
  { key: 'settings', label: 'Settings', icon: Settings, hint: 'Profile · keywords' },
];

export function SidebarNav({
  view, onChange, healthCount,
}: {
  view: ViewKey;
  onChange: (v: ViewKey) => void;
  healthCount: { failing: number; warning: number };
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar h-full flex flex-col">
      <div className="px-4 h-14 flex items-center gap-2 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white">
          <Radar className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sidebar-foreground">AI Developer Radar</div>
          <div className="text-xs text-muted-foreground">Trend intelligence</div>
        </div>
      </div>
      <nav className="p-2 flex-1 overflow-y-auto">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.key;
          const showAlert = it.key === 'health' && (healthCount.failing > 0 || healthCount.warning > 0);
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60',
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1 text-left">{it.label}</span>
              {showAlert && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  healthCount.failing ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                )}>
                  {healthCount.failing || healthCount.warning}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border text-xs text-muted-foreground">
        <div>v0.1 · MVP</div>
        <a
          href="https://github.com/Tsin418/ai-trend-radar"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground underline-offset-2 hover:underline"
        >
          github.com/Tsin418/ai-trend-radar
        </a>
      </div>
    </aside>
  );
}
