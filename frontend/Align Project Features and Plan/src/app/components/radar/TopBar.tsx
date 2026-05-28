import { Button } from '../ui/button';
import { fmtRelative } from '../../utils/format';

const TOP_LINKS = [
  { label: 'GitHub Repo', url: 'https://github.com/Tsin418/ai-trend-radar' },
  { label: 'Homepage', url: 'https://github.com/Tsin418' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com' },
  { label: 'XHS', url: 'https://www.xiaohongshu.com' },
];

export function TopBar({
  date, generatedAt, viewLabel,
}: {
  date: string;
  generatedAt: string;
  viewLabel: string;
}) {
  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">{viewLabel}</div>
        <div className="text-sm">·</div>
        <div className="text-sm">{date}</div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-xs text-muted-foreground">
          Last generated <span className="text-foreground">{fmtRelative(generatedAt)}</span>
        </div>
        {TOP_LINKS.map((item) => (
          <Button key={item.label} variant="outline" size="sm" className="h-8" asChild>
            <a href={item.url} target="_blank" rel="noreferrer">{item.label}</a>
          </Button>
        ))}
      </div>
    </header>
  );
}
