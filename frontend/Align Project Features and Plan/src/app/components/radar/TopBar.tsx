import { Button } from '../ui/button';
import { fmtDateTime } from '../../utils/format';

const TOP_LINKS = [
	{ label: 'GitHub Repo', url: 'https://github.com/Tsin418/ai-trend-radar' },
	{ label: 'Homepage', url: 'https://personalpage.chenandrew418.workers.dev/' },
	{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/haoyang-chen-14b018295/' },
	{ label: '小红书', url: 'https://xhslink.com/m/2Xg6z7vc9jD' },
];

export function TopBar({
	date, generatedAt, multiSourceGeneratedAt, viewLabel,
}: {
	date: string;
	generatedAt: string;
	multiSourceGeneratedAt?: string;
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
					Daily: <span className="text-foreground">{fmtDateTime(generatedAt)}</span>
					{multiSourceGeneratedAt && (
						<> · Signals: <span className="text-foreground">{fmtDateTime(multiSourceGeneratedAt)}</span></>
					)}
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
