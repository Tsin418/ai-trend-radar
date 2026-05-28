import { Card } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';
import { statusOf, SourceHealthStrip } from '../SourceHealthStrip';
import type { SourceHealth } from '../../../types/radar';
import { fmtRelative } from '../../../utils/format';

export function SourceHealthView({ sources }: { sources: SourceHealth[] }) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg">Source Health</h2>
        <p className="text-sm text-muted-foreground">Pipeline status, latency, item counts</p>
      </div>
      <SourceHealthStrip sources={sources} />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Latency</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Finished</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => {
              const st = statusOf(s);
              const Icon = { success: CheckCircle2, warning: AlertTriangle, failed: XCircle, disabled: MinusCircle }[st];
              const tone = {
                success: 'text-emerald-600',
                warning: 'text-amber-600',
                failed: 'text-red-600',
                disabled: 'text-slate-400',
              }[st];
              return (
                <TableRow key={s.source}>
                  <TableCell><Icon className={`w-4 h-4 ${tone}`} /></TableCell>
                  <TableCell>{s.source}</TableCell>
                  <TableCell className={tone}>{st}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.itemCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{(s.latencyMs / 1000).toFixed(1)}s</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtRelative(s.startedAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtRelative(s.finishedAt)}</TableCell>
                  <TableCell className="text-xs">
                    {s.error && <span className="text-red-700">{s.error}</span>}
                    {s.warning && <span className="text-amber-700">{s.warning}</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
