import { Card } from '../../ui/card';
import { CategoryBadge } from '../Badges';

const categories = [
  'AI Agent Framework',
  'Coding Agent / SWE Agent',
  'RAG / Knowledge Base',
  'MCP / Tool Calling',
  'Local LLM / Inference',
  'AI App Builder',
  'AI Workflow Automation',
  'Vector Database / Embedding',
  'AI Browser / Computer Use',
  'AI DevTool / Observability',
];

const keywords = [
  'agent', 'mcp', 'rag', 'reranker', 'tool-use', 'swe-bench', 'computer-use',
  'embedding', 'local-llm', 'inference', 'llm-router', 'browser-agent',
];

export function SettingsView() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg">Settings</h2>
        <p className="text-sm text-muted-foreground">Radar profile · keywords · thresholds (read-only in MVP)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-4">
          <div className="text-sm mb-3">Radar Profile</div>
          <KV k="Profile name" v="ai-developer-radar" />
          <KV k="Run mode" v="daily, weekly" />
          <KV k="Timezone" v="Asia/Tokyo (JST)" />
          <KV k="Schedule" v="08:30 JST daily · 09:00 JST Mondays" />
        </Card>

        <Card className="p-4">
          <div className="text-sm mb-3">Categories</div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => <CategoryBadge key={c} category={c} />)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm mb-3">Keywords</div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">#{k}</span>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm mb-3">Thresholds</div>
          <KV k="Hot daily Δ" v="≥ 80 stars" />
          <KV k="Hot weekly Δ" v="≥ 400 stars" />
          <KV k="Early signal growth" v="≥ 5%/day" />
          <KV k="Min final score" v="65" />
        </Card>

        <Card className="p-4">
          <div className="text-sm mb-3">Notification Channels</div>
          <KV k="Feishu" v="enabled · webhook hidden" />
          <KV k="Email" v="enabled · SMTP hidden" />
          <KV k="WeChat" v="disabled" />
          <div className="mt-2 text-xs text-amber-700">
            Secrets are never displayed in the frontend.
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm mb-3">LLM Enrichment</div>
          <KV k="Provider" v="DeepSeek (configurable)" />
          <KV k="Mode" v="selected projects only" />
          <KV k="Confidence floor" v="medium" />
        </Card>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span>{v}</span>
    </div>
  );
}
