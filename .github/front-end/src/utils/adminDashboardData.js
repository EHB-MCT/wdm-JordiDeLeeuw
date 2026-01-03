export const demoData = {
	totalUsers: 156,
	totalPhotos: 1247,
	timestampLeakage: Array.from({ length: 24 }, (_, i) => ({
		hour: i,
		count: Math.floor(Math.random() * 50) + 10,
	})),
	socialContextLeakage: {
		relationshipLabels: 23,
		handles: 45,
		emails: 18,
		phonePatterns: 12,
		nameEntities: 34,
	},
	professionalLiabilitySignals: [
		{ name: "Aggression Hits", count: 14 },
		{ name: "Profanity Hits", count: 9 },
		{ name: "Shouting Hits", count: 22 },
	],
	locationLeakageSignals: [
		{ name: "Explicit location keywords", count: 18 },
		{ name: "Travel/route context", count: 27 },
		{ name: "No location signals", count: 5 },
	],
};

export const chartColors = {
	timestamp: "#38bdf8",
	social: "#a78bfa",
	liability: "#f59e0b",
	location: "#22c55e",
};

export const chartMargin = { top: 12, right: 16, left: 8, bottom: 48 };
export const xAxisCommon = { height: 48, tick: { fontSize: 11 } };

export function prettyLabel(key) {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (c) => c.toUpperCase())
		.replace("Iban", "IBAN");
}

export function safeArray24(arr) {
	if (Array.isArray(arr) && arr.length === 24) return arr;
	return Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
}

export function safeSignals(arr, fallback) {
	if (Array.isArray(arr) && arr.length) return arr;
	return fallback;
}
