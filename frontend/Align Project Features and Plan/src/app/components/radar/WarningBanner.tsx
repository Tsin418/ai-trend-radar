import { AlertTriangle } from 'lucide-react';
import { cn } from '../ui/utils';

export function WarningBanner({
  level = 'warning', title, message,
}: {
  level?: 'warning' | 'info' | 'error';
  title: string;
  message?: string;
}) {
  const cls = {
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-900',
  }[level];
  return (
    <div className={cn('rounded-md border px-3 py-2 flex items-start gap-2 text-sm', cls)}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <div>{title}</div>
        {message && <div className="text-xs opacity-80 mt-0.5">{message}</div>}
      </div>
    </div>
  );
}
