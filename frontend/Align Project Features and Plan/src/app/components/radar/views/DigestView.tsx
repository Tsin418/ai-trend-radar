import { Card } from '../../ui/card';
import { DigestPreview } from '../DigestPreview';
import type { RadarDigest } from '../../../types/radar';
import { fmtRelative } from '../../../utils/format';
import { useEffect, useMemo, useState } from 'react';

type ArchiveEntry = {
  id: string;
  type: 'daily' | 'weekly';
  date: string;
  title: string;
  path?: string;
};

type ArchiveIndex = {
  entries?: ArchiveEntry[];
};

export function DigestView({ digest }: { digest: RadarDigest }) {
  const currentEntry = useMemo<ArchiveEntry>(() => ({
    id: `${digest.date}-${digest.mode}`,
    type: digest.mode,
    date: digest.date,
    title: digest.title,
  }), [digest.date, digest.mode, digest.title]);

  const [archive, setArchive] = useState<ArchiveEntry[]>([currentEntry]);
  const [selectedId, setSelectedId] = useState(currentEntry.id);
  const [archiveMarkdown, setArchiveMarkdown] = useState<string | null>(null);
  const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadArchiveIndex() {
      try {
        const response = await fetch('/data/archive/index.json', {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Archive index failed: ${response.status}`);
        const data = await response.json() as ArchiveIndex;
        if (cancelled) return;

        const entries = data.entries ?? [];
        const hasCurrent = entries.some((entry) => entry.date === digest.date && entry.type === digest.mode);
        setArchive(hasCurrent ? entries : [currentEntry, ...entries]);
      } catch {
        if (!cancelled) setArchive([currentEntry]);
      }
    }

    void loadArchiveIndex();
    return () => { cancelled = true; };
  }, [currentEntry, digest.date, digest.mode]);

  const selectArchive = async (entry: ArchiveEntry) => {
    setSelectedId(entry.id);
    setArchiveMarkdown(null);
    if (!entry.path) return;

    setLoadingArchiveId(entry.id);
    try {
      const response = await fetch(`/data/archive/${entry.path}`, {
        headers: { Accept: 'text/markdown,text/plain' },
      });
      if (!response.ok) throw new Error(`Archive markdown failed: ${response.status}`);
      const markdown = await response.text();
      setArchiveMarkdown(markdown);
    } catch {
      setArchiveMarkdown(`Archive file is unavailable: ${entry.title}`);
    } finally {
      setLoadingArchiveId(null);
    }
  };

  return (
    <div className="p-6 h-full min-h-0 flex flex-col gap-5">
      <div className="shrink-0">
        <h2 className="text-lg">Digests</h2>
        <p className="text-sm text-muted-foreground">Generated digest · Markdown · Feishu · Email format</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
        <div className="lg:col-span-2 min-h-0">
          <DigestPreview digest={digest} markdownOverride={archiveMarkdown} />
        </div>

        <Card className="p-4 h-full min-h-0 overflow-y-auto">
          <div className="text-sm mb-3">Archive</div>
          <ul className="space-y-2">
            {archive.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => void selectArchive(a)}
                  className={`w-full p-2 rounded-md border text-left transition-colors hover:bg-muted/60 ${
                    selectedId === a.id ? 'bg-indigo-50/50 border-indigo-200' : 'border-border'
                  }`}
                >
                  <div className="text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {loadingArchiveId === a.id ? 'Loading...' : fmtRelative(`${a.date}T09:00:00+09:00`)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
