import { Card } from '../../ui/card';
import { DigestPreview } from '../DigestPreview';
import type { RadarDigest } from '../../../types/radar';
import { fmtRelative } from '../../../utils/format';

export function DigestView({ digest }: { digest: RadarDigest }) {
  const archive = [
    { date: digest.date, title: digest.title, isCurrent: true },
    { date: '2026-05-27', title: 'AI Developer Radar｜Daily｜2026-05-27', isCurrent: false },
    { date: '2026-05-26', title: 'AI Developer Radar｜Daily｜2026-05-26', isCurrent: false },
    { date: '2026-05-22', title: 'AI Developer Radar｜Weekly｜W21', isCurrent: false },
    { date: '2026-05-25', title: 'AI Developer Radar｜Daily｜2026-05-25', isCurrent: false },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg">Digests</h2>
        <p className="text-sm text-muted-foreground">Generated digest · Markdown · Feishu · Email format</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <DigestPreview digest={digest} />
        </div>

        <Card className="p-4">
          <div className="text-sm mb-3">Archive</div>
          <ul className="space-y-2">
            {archive.map((a) => (
              <li
                key={a.date}
                className={`p-2 rounded-md border ${a.isCurrent ? 'bg-indigo-50/50 border-indigo-200' : 'border-border'}`}
              >
                <div className="text-sm">{a.title}</div>
                <div className="text-xs text-muted-foreground">{fmtRelative(`${a.date}T09:00:00+09:00`)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
