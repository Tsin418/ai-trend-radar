import { Progress } from '../ui/progress';
import type { RepoScore } from '../../types/radar';

const items: { key: keyof RepoScore; label: string; invert?: boolean }[] = [
  { key: 'attentionScore', label: 'Attention' },
  { key: 'accelerationScore', label: 'Acceleration' },
  { key: 'earlyPotentialScore', label: 'Early Potential' },
  { key: 'developerActivityScore', label: 'Dev Activity' },
  { key: 'aiRelevanceScore', label: 'AI Relevance' },
  { key: 'usefulnessScore', label: 'Usefulness' },
  { key: 'riskScore', label: 'Risk', invert: true },
];

export function ScoreBreakdown({ score }: { score: RepoScore }) {
  return (
    <div className="space-y-2.5">
      {items.map((it) => {
        const v = (score[it.key] as number) ?? 0;
        return (
          <div key={it.key as string}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{it.label}</span>
              <span className="tabular-nums">{v}</span>
            </div>
            <Progress value={v} className={it.invert ? '[&>*]:bg-red-500' : ''} />
          </div>
        );
      })}
      <div className="pt-2 mt-2 border-t flex items-center justify-between">
        <span className="text-sm">Final Score</span>
        <span className="text-2xl tabular-nums">{score.finalScore}</span>
      </div>
    </div>
  );
}
