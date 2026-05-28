import { Inbox } from 'lucide-react';

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed rounded-lg py-10 px-6 text-center">
      <Inbox className="w-6 h-6 mx-auto text-muted-foreground" />
      <div className="mt-2 text-sm">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
