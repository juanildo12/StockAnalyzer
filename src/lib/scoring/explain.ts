import { ScoreResult } from "./types";

export function formatScoreReport(result: ScoreResult): string {
  const lines: string[] = [];
  const { symbol, totalScore, grade, factors, summary } = result;

  lines.push(`${symbol} — ${totalScore}/100 (${grade})`);
  lines.push("");
  lines.push(summary);
  lines.push("");

  const sorted = [...factors].sort((a, b) => b.weightedScore - a.weightedScore);

  for (const f of sorted) {
    const bar = getBar(f.score);
    const weightPct = Math.round(f.weight * 100);
    lines.push(`${bar} ${f.label.padEnd(20)} ${String(f.score).padStart(3)}/100  (${weightPct}%)  ${f.explanation}`);

    for (const b of f.breakdown) {
      lines.push(`    ${b.metric}: ${b.detail}`);
    }
  }

  return lines.join("\n");
}

function getBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}
