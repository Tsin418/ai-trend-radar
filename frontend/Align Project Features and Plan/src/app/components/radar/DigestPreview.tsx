import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import type { RadarDigest } from '../../types/radar';

export function buildMarkdown(d: RadarDigest): string {
  const lines: string[] = [];
  lines.push(`# ${d.title}`);
  if (d.headline) lines.push(`\n**${d.headline}**`);
  lines.push(`\n_Generated ${d.generatedAt}_\n`);
  lines.push(`## Summary\n${d.summary}\n`);
  if (d.hotProjects.length) {
    lines.push(`## Top Hot Projects`);
    d.hotProjects.forEach((p) => {
      lines.push(`- **[${p.repository.repoFullName}](${p.repository.repoUrl})** — ${p.repository.description}`);
      lines.push(`  - Stars: ${p.repository.stars} · 24h: +${p.score.dailyStarDelta ?? 0} · 7d: +${p.score.weeklyStarDelta ?? 0} · Score: ${p.score.finalScore}`);
      lines.push(`  - Why: ${p.whyItMatters}`);
    });
  }
  if (d.acceleratingProjects.length) {
    lines.push(`\n## Accelerating`);
    d.acceleratingProjects.forEach((p) => lines.push(`- [${p.repository.repoFullName}](${p.repository.repoUrl}) — accel ${p.score.acceleration.toFixed(2)}×`));
  }
  if (d.earlySignals.length) {
    lines.push(`\n## Early Signals`);
    d.earlySignals.forEach((p) => lines.push(`- [${p.repository.repoFullName}](${p.repository.repoUrl}) — ${p.repository.description}`));
  }
  if (d.dataNotes.length) {
    lines.push(`\n## Data Notes`);
    d.dataNotes.forEach((n) => lines.push(`- ${n}`));
  }
  return lines.join('\n');
}

function buildFeishu(d: RadarDigest): string {
  return `📡 ${d.title}\n${d.headline ?? ''}\n\n${d.summary}\n\n🔥 Top:\n${d.hotProjects
    .map((p) => `• ${p.repository.repoFullName}  +${p.score.dailyStarDelta ?? 0} (24h)  → ${p.repository.repoUrl}`)
    .join('\n')}`;
}

export function DigestPreview({ digest }: { digest: RadarDigest }) {
  const [tab, setTab] = useState<'markdown' | 'feishu'>('markdown');
  const md = buildMarkdown(digest);
  const feishu = buildFeishu(digest);
  const text = tab === 'markdown' ? md : feishu;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm">Digest Preview</div>
          <div className="text-xs text-muted-foreground">Copy to Markdown / Feishu / Email</div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="markdown" className="text-xs px-3">Markdown</TabsTrigger>
              <TabsTrigger value="feishu" className="text-xs px-3">Feishu</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={copy} className="h-8">
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
          </Button>
        </div>
      </div>
      <pre className="text-xs bg-slate-50 border rounded-md p-3 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    </Card>
  );
}
