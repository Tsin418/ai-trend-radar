import { Card } from '../ui/card';
import { cn } from '../ui/utils';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

export interface KpiCardProps {
  label: string;
  value: string | number;
  helper?: string;
  trend?: 'up' | 'down' | 'flat';
  warning?: boolean;
  accent?: 'default' | 'success' | 'amber' | 'red' | 'indigo';
}

export function KpiCard({ label, value, helper, trend, warning, accent = 'default' }: KpiCardProps) {
  const accentBar = {
    default: 'bg-slate-200',
    success: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    indigo: 'bg-indigo-400',
  }[accent];

  return (
    <Card className="p-4 relative overflow-hidden">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', accentBar)} />
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        {warning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl tabular-nums">{value}</div>
        {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-600" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-600" />}
        {trend === 'flat' && <Minus className="w-4 h-4 text-slate-400" />}
      </div>
      {helper && <div className="mt-1 text-xs text-muted-foreground">{helper}</div>}
    </Card>
  );
}
