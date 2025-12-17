#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import {
  listRuns,
  printRuns,
  createPrompt,
  formatJudgmentPrompt,
  parseJudgment,
  ROOT_DIR,
} from './quality-shared.js';
import type {
  QueryEvaluation,
  RunSummary,
  HilJudgment,
  HilQueryData,
  HilReviewSummary,
} from './search-quality.types.js';
import { HIL_JUDGMENT_SCORES } from './search-quality.types.js';

const CLAUDE_CLI = process.env.CLAUDE_CLI || `${process.env.HOME}/.claude/local/claude`;

interface ParsedRun {
  lines: Array<{ type: string; data?: unknown; timestamp?: string; runId?: string; config?: unknown }>;
  evaluations: QueryEvaluation[];
  summary: RunSummary | null;
}

function parseRunFile(path: string): ParsedRun {
  const content = readFileSync(path, 'utf-8');
  const lines = content.trim().split('\n').map(l => JSON.parse(l));

  const evaluations: QueryEvaluation[] = [];
  let summary: RunSummary | null = null;

  for (const line of lines) {
    if (line.type === 'query_evaluation') {
      evaluations.push(line.data as QueryEvaluation);
    } else if (line.type === 'run_summary') {
      summary = line.data as RunSummary;
    }
  }

  return { lines, evaluations, summary };
}

function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\"'\"'")}'`;
}

async function reviewRun(runId: string): Promise<void> {
  const runs = listRuns();
  const run = runs.find(r => r.id === runId);

  if (!run) {
    console.error(`Run not found: ${runId}`);
    console.log('\nAvailable runs:');
    printRuns(runs);
    process.exit(1);
  }

  const prompt = createPrompt();
  const parsed = parseRunFile(run.path);

  console.log(`\n📊 Reviewing run: ${runId}`);
  console.log(`   ${parsed.evaluations.length} queries, overall=${run.overallScore.toFixed(2)}\n`);

  const hilData: Map<number, HilQueryData> = new Map();

  for (let i = 0; i < parsed.evaluations.length; i++) {
    const eval_ = parsed.evaluations[i];
    const progress = `[${i + 1}/${parsed.evaluations.length}]`;

    console.log(`\n${progress} "${eval_.query.query}"`);
    console.log(`  AI overall: ${eval_.evaluation.scores.overall.toFixed(2)}`);
    console.log(`\n  Results returned:`);

    for (const r of eval_.searchResults.slice(0, 5)) {
      console.log(`  → ${r.source}`);
      const snippet = r.snippet.slice(0, 80).replace(/\n/g, ' ');
      console.log(`       "${snippet}${r.snippet.length > 80 ? '...' : ''}"`);
    }

    console.log(`\n  How did the search do?`);
    console.log(`  ${formatJudgmentPrompt()}`);

    const input = await prompt.question('> ');
    const judgment = parseJudgment(input);

    if (judgment === 'skip') {
      hilData.set(i, { reviewed: false });
      continue;
    }

    const hil: HilQueryData = {
      reviewed: true,
      reviewedAt: new Date().toISOString(),
    };

    if (judgment !== 'note') {
      hil.judgment = judgment;
      hil.humanScore = HIL_JUDGMENT_SCORES[judgment];
    }

    const note = await prompt.question('  Note (optional): ');
    if (note.trim()) {
      hil.note = note.trim();
    }

    hilData.set(i, hil);
  }

  prompt.close();

  // Calculate summary stats
  const reviewed = [...hilData.values()].filter(h => h.reviewed);
  const scores = reviewed.filter(h => h.humanScore !== undefined).map(h => h.humanScore!);
  const humanAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const flagged = reviewed.filter(h => h.flagged).length;

  // Generate synthesis via Claude
  console.log('\n📝 Generating synthesis...');

  const synthesisPrompt = `Summarize this human review of search quality results:

AI average score: ${run.overallScore.toFixed(2)}
Human average score: ${humanAvg.toFixed(2)}
Queries reviewed: ${reviewed.length}/${parsed.evaluations.length}

Human judgments:
${[...hilData.entries()].filter(([_, h]) => h.reviewed).map(([i, h]) => {
  const q = parsed.evaluations[i].query.query;
  return `- "${q}": ${h.judgment ?? 'note only'}${h.note ? ` - "${h.note}"` : ''}`;
}).join('\n')}

Provide:
1. A 2-3 sentence synthesis of the human feedback
2. 2-4 specific action items for improving search quality

Return as JSON: { "synthesis": "...", "actionItems": ["...", "..."] }`;

  const result = execSync([
    CLAUDE_CLI,
    '-p', shellEscape(synthesisPrompt),
    '--output-format', 'json',
  ].join(' '), {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    timeout: 60000,
  });

  const synthResult = JSON.parse(result);
  const synthesis = synthResult.structured_output ?? JSON.parse(synthResult.result);

  // Build HIL review summary
  const hilReview: HilReviewSummary = {
    reviewedAt: new Date().toISOString(),
    queriesReviewed: reviewed.length,
    queriesSkipped: parsed.evaluations.length - reviewed.length,
    queriesFlagged: flagged,
    humanAverageScore: Math.round(humanAvg * 100) / 100,
    aiVsHumanDelta: Math.round((humanAvg - run.overallScore) * 100) / 100,
    synthesis: synthesis.synthesis,
    actionItems: synthesis.actionItems,
  };

  // Update the JSONL file with HIL data
  const updatedLines = parsed.lines.map((line, idx) => {
    if (line.type === 'query_evaluation') {
      const evalIdx = parsed.lines.slice(0, idx).filter(l => l.type === 'query_evaluation').length;
      const hil = hilData.get(evalIdx);
      if (hil) {
        return { ...line, data: { ...(line.data as object), hil } };
      }
    }
    if (line.type === 'run_summary') {
      return { ...line, data: { ...(line.data as object), hilReview } };
    }
    return line;
  });

  writeFileSync(run.path, updatedLines.map(l => JSON.stringify(l)).join('\n') + '\n');

  console.log(`\n✓ Review saved to ${run.path}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Human avg: ${humanAvg.toFixed(2)} (AI: ${run.overallScore.toFixed(2)}, delta: ${hilReview.aiVsHumanDelta >= 0 ? '+' : ''}${hilReview.aiVsHumanDelta.toFixed(2)})`);
  console.log(`   ${hilReview.synthesis}`);
  console.log(`\n🎯 Action items:`);
  hilReview.actionItems.forEach((item, i) => console.log(`   ${i + 1}. ${item}`));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const showList = args.includes('--list');
  const runId = args.find(a => !a.startsWith('--'));

  if (showList || !runId) {
    const runs = listRuns();
    printRuns(runs);
    console.log('\nUsage: npm run test:quality:review -- <run-id>');
    return;
  }

  await reviewRun(runId);
}

main().catch(console.error);
