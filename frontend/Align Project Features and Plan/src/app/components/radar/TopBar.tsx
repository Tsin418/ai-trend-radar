import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Copy, Download, RefreshCw } from 'lucide-react';
import { fmtRelative } from '../../utils/format';
import type { RadarRunMode } from '../../types/radar';

export function TopBar({
  date, generatedAt, mode, onModeChange, onCopy, viewLabel,
}: {
  date: string;
  generatedAt: string;
  mode: RadarRunMode;
  onModeChange: (m: RadarRunMode) => void;
  onCopy: () => void;
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
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as RadarRunMode)}>
          <TabsList className="h-8">
            <TabsTrigger value="daily" className="text-xs px-3">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs px-3">Weekly</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={onCopy} className="h-8">
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Digest
        </Button>
        <Button variant="outline" size="sm" className="h-8">
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export
        </Button>
        <Button variant="outline" size="sm" className="h-8">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
}
