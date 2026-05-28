import { MultiSourceSignalCard } from '../MultiSourceSignalCard';
import { CrossSourceCard } from '../CrossSourceCard';
import { EmptyState } from '../EmptyState';
import type { RadarDigest } from '../../../types/radar';

export function SignalsView({ digest }: { digest: RadarDigest }) {
  const m = digest.multiSourceSections;
  if (!m) return <div className="p-6"><EmptyState title="No multi-source signals" /></div>;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg">Multi-source Signals</h2>
        <p className="text-sm text-muted-foreground">
          Trend signals beyond GitHub: Product Hunt · Hugging Face · Hacker News · AIHot
        </p>
      </div>

      {m.crossSourceHighlights.length > 0 && (
        <section>
          <h3 className="text-base mb-3">Cross-source Highlights</h3>
          <div className="grid grid-cols-1 gap-3">
            {m.crossSourceHighlights.map((e) => <CrossSourceCard key={e.id} entity={e} />)}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MultiSourceSignalCard 
          title="Product Launches" 
          items={m.productLaunches.slice(0, 5)} 
          accent="bg-fuchsia-500" 
          showLLMSummary={true}
        />
        <MultiSourceSignalCard 
          title="Model / Demo Signals" 
          items={m.modelDemoSignals} 
          accent="bg-cyan-500" 
        />
        <MultiSourceSignalCard 
          title="Developer Buzz" 
          items={m.developerBuzz.slice(0, 5)} 
          accent="bg-orange-500" 
          showLLMSummary={true}
        />
      </div>
    </div>
  );
}
