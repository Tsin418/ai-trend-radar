import { Card } from '../ui/card';
import { cn } from '../ui/utils';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';
import type { SourceHealth } from '../../types/radar';

const labels: Record<string, string> = {
  'github-trending': 'GitHub Trending',
  'github-search': 'GitHub Search',
  'watchlist': 'Watchlist',
  'product-hunt': 'Product Hunt',
  'aihot': 'AIHot',
  'huggingface-models': 'HF Models',
  'huggingface-spaces': 'HF Spaces',
  'hackernews': 'Hacker News',
  'arxiv': 'arXiv',
};

export function statusOf(s: SourceHealth): 'success' | 'warning' | 'failed' | 'disabled' {
  if (!s.enabled) return 'disabled';
  if (!s.success) return 'failed';
  if (s.warning) return 'warning';
  return 'success';
}

export function SourceHealthStrip({ sources }: { sources: SourceHealth[] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm">Source Health</div>
          <div className="text-xs text-muted-foreground">Pipeline status across collectors</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ok</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> warn</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> fail</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> off</span>
        </div>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {sources.map((s) => {
          const st = statusOf(s);
          const map = {
            success: { Icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50/40 text-emerald-700' },
            warning: { Icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50/40 text-amber-700' },
            failed: { Icon: XCircle, cls: 'border-red-200 bg-red-50/40 text-red-700' },
            disabled: { Icon: MinusCircle, cls: 'border-slate-200 bg-slate-50 text-slate-500' },
          }[st];
          const Icon = map.Icon;
          return (
            <div
              key={s.source}
              className={cn('p-2 rounded-md border text-xs flex flex-col gap-1', map.cls)}
              title={s.error || s.warning || ''}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-3.5 h-3.5" />
                <span className="tabular-nums">{s.itemCount}</span>
              </div>
              <div className="truncate text-foreground/80">{labels[s.source] ?? s.source}</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {Math.round(s.latencyMs / 100) / 10}s
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
