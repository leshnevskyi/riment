import { randomInteger, round } from "remeda";

export function formatPercentage(value: number) {
	return round(value * 100, 2) + "%";
}

export function sum(values: number[]) {
	return values.reduce((sum, value) => sum + value, 0);
}

export function average(values: number[]) {
	if (values.length == 0) return 0;

	return sum(values) / values.length;
}

export function ceiling(value: number, significance: number) {
	return Math.ceil(value / significance) * significance;
}

export type GetExpertScoreOptions = Partial<{
	minScore: number;
	maxScore: number;
}>;

export function getExpertScores(
	expertCount: number,
	{ minScore = randomInteger(5, 8), maxScore = 10 }: GetExpertScoreOptions = {},
) {
	return Array.from({ length: expertCount }, () => {
		return randomInteger(minScore, maxScore);
	});
}
