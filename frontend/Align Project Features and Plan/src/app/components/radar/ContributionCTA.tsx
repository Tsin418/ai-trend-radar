import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ExternalLink, Github } from 'lucide-react';

const DEFAULT_REPO_ISSUES_URL = 'https://github.com/Tsin418/ai-trend-radar/issues';

export function ContributionCTA({
  title = 'Help improve this radar',
  description = '发现分类错误、想推荐信号源，或有更好的展示方式？欢迎一起共建这个开源项目。',
  issuesUrl = DEFAULT_REPO_ISSUES_URL,
}: {
  title?: string;
  description?: string;
  issuesUrl?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <a href={issuesUrl} target="_blank" rel="noreferrer">
              <Github className="mr-1 h-3.5 w-3.5" />
              Contribute on GitHub
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
