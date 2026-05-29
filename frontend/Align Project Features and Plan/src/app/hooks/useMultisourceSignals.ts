import { useEffect, useState } from 'react';
import type { TrendItem, TrendEntity } from '../types/radar';

interface MultisourceSignalsFile {
	schemaVersion: number;
	mode: string;
	generatedAt: string;
	sections: {
		productLaunches: TrendItem[];
		modelDemoSignals: TrendItem[];
		developerBuzz: TrendItem[];
		aihotHighlights: TrendItem[];
		crossSourceHighlights?: TrendEntity[];
	};
}

export interface MultisourceSections {
	productLaunches: TrendItem[];
	modelDemoSignals: TrendItem[];
	developerBuzz: TrendItem[];
	aihotHighlights: TrendItem[];
	crossSourceHighlights: TrendEntity[];
	generatedAt: string | null;
}

const EMPTY: MultisourceSections = {
	productLaunches: [],
	modelDemoSignals: [],
	developerBuzz: [],
	aihotHighlights: [],
	crossSourceHighlights: [],
	generatedAt: null,
};

const MULTISOURCE_URL = '/data/latest-multisource-signals.json';

function isMultisourceFile(value: unknown): value is MultisourceSignalsFile {
	if (!value || typeof value !== 'object') return false;
	const f = value as Record<string, unknown>;
	return f.schemaVersion === 1 && f.mode === 'multisource' && typeof f.generatedAt === 'string' && f.sections != null;
}

export function useMultisourceSignals(): MultisourceSections {
	const [sections, setSections] = useState<MultisourceSections>(EMPTY);

	useEffect(() => {
		let cancelled = false;
		let timer: ReturnType<typeof setInterval> | undefined;

		async function fetchSignals() {
			try {
				const response = await fetch(MULTISOURCE_URL, {
					headers: { Accept: 'application/json' },
				});
				if (!response.ok || cancelled) return;
				const json = await response.json() as unknown;
				if (!isMultisourceFile(json)) return;
				setSections({
					productLaunches: json.sections.productLaunches ?? [],
					modelDemoSignals: json.sections.modelDemoSignals ?? [],
					developerBuzz: json.sections.developerBuzz ?? [],
					aihotHighlights: json.sections.aihotHighlights ?? [],
					crossSourceHighlights: json.sections.crossSourceHighlights ?? [],
					generatedAt: json.generatedAt,
				});
			} catch {
				// keep existing sections on fetch failure
			}
		}

		void fetchSignals();
		timer = setInterval(fetchSignals, 5 * 60 * 1000);

		return () => {
			cancelled = true;
			if (timer) clearInterval(timer);
		};
	}, []);

	return sections;
}
