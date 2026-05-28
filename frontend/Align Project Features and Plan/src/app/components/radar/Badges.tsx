import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import type { RiskLevel, TrendType } from '../../types/radar';

export function TrendBadge({ type }: { type: TrendType }) {
  const map: Record<TrendType, { label: string; cls: string }> = {
    sustained_hot: { label: 'Sustained Hot', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    sudden_breakout: { label: 'Breakout', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    early_signal: { label: 'Early Signal', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  };
  const m = map[type];
  return <Badge variant="outline" className={cn('rounded-md', m.cls)}>{m.label}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    High: 'bg-red-50 text-red-700 border-red-200',
    Unknown: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return <Badge variant="outline" className={cn('rounded-md', map[level])}>Risk · {level}</Badge>;
}

const categoryColors: Record<string, string> = {
  'Coding Agent / SWE Agent': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'MCP / Tool Calling': 'bg-violet-50 text-violet-700 border-violet-200',
  'RAG / Knowledge Base': 'bg-sky-50 text-sky-700 border-sky-200',
  'Local LLM / Inference': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'AI Agent Framework': 'bg-blue-50 text-blue-700 border-blue-200',
  'AI App Builder': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'AI Workflow Automation': 'bg-pink-50 text-pink-700 border-pink-200',
  'Vector Database / Embedding': 'bg-teal-50 text-teal-700 border-teal-200',
  'AI Browser / Computer Use': 'bg-purple-50 text-purple-700 border-purple-200',
  'AI DevTool / Observability': 'bg-slate-50 text-slate-700 border-slate-200',
};

export function CategoryBadge({ category }: { category: string }) {
  const cls = categoryColors[category] ?? 'bg-slate-50 text-slate-700 border-slate-200';
  return <Badge variant="outline" className={cn('rounded-md', cls)}>{category}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <Badge variant="outline" className="rounded-md bg-slate-50 text-slate-600 border-slate-200">
      {source}
    </Badge>
  );
}

export function WatchlistBadge() {
  return (
    <Badge variant="outline" className="rounded-md bg-amber-50 text-amber-700 border-amber-200">
      ★ Watchlist
    </Badge>
  );
}
