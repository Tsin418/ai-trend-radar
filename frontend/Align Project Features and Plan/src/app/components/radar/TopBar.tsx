import { Button } from '../ui/button';
import { fmtRelative } from '../../utils/format';
import type { GrowthLinks } from '../../types/radar';

export function TopBar({
  date, generatedAt, viewLabel, growthLinks,
}: {
  date: string;
  generatedAt: string;
  viewLabel: string;
  growthLinks: GrowthLinks;
}) {
  const links = [
    { label: 'GitHub Repo', url: growthLinks.githubRepoUrl },
    { label: 'Homepage', url: growthLinks.personalHomepageUrl || growthLinks.githubProfileUrl },
    { label: 'LinkedIn', url: growthLinks.linkedinUrl },
    { label: 'XHS', url: growthLinks.xiaohongshuUrl },
  ];

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
        {links.map((item) => (item.url ? (
          <Button key={item.label} variant="outline" size="sm" className="h-8" asChild>
            <a href={item.url} target="_blank" rel="noreferrer">{item.label}</a>
          </Button>
        ) : (
          <Button key={item.label} variant="outline" size="sm" className="h-8" disabled>
            {item.label}
          </Button>
        )))}
      </div>
    </header>
  );
}
