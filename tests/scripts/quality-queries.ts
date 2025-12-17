#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import {
  listQuerySets,
  loadQuerySet,
  loadAllQuerySets,
  printQuerySets,
  createPrompt,
  QUERIES_DIR,
  ROOT_DIR,
} from './quality-shared.js';
import type { QuerySet, CoreQuery } from './search-quality.types.js';

const CLAUDE_CLI = process.env.CLAUDE_CLI || `${process.env.HOME}/.claude/local/claude`;

function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\"'\"'")}'`;
}

async function generateQueries(seedSet?: string): Promise<void> {
  const prompt = createPrompt();

  console.log('🔍 Query Generation Mode\n');

  // Load seed queries if specified
  let seedQueries: CoreQuery[] = [];
  if (seedSet) {
    const seed = seedSet === 'all' ? loadAllQuerySets() : loadQuerySet(seedSet);
    seedQueries = seed.queries;
    console.log(`Seeding from ${seedSet} (${seedQueries.length} queries)\n`);
  }

  // Generate queries via Claude
  console.log('Generating queries from corpus analysis...\n');

  const generatePrompt = `You have access to explore the tests/fixtures/ directory which contains content indexed in a knowledge store.

${seedQueries.length > 0 ? `Existing queries to build on:\n${seedQueries.map(q => `- "${q.query}" (${q.category})`).join('\n')}\n\nPropose 10-15 NEW queries that complement the existing ones.` : 'Propose 10-15 diverse search queries.'}

For each query provide:
- query: the search string
- intent: what the user is trying to find
- category: one of code-pattern, concept, api-reference, troubleshooting, comparison

Return as JSON array.`;

  const args = [
    CLAUDE_CLI,
    '-p', shellEscape(generatePrompt),
    '--output-format', 'json',
    '--allowedTools', 'Glob,Read',
  ];

  let result: string;
  try {
    result = execSync(args.join(' '), {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      timeout: 120000,
    });
  } catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM') {
      console.error('Error: Claude CLI call timed out after 120 seconds');
    } else {
      console.error(`Error calling Claude CLI: ${error.message}`);
      if (error.stderr) {
        console.error(`stderr: ${error.stderr}`);
      }
    }
    throw error;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(result);
  } catch (error: any) {
    console.error('Error: Failed to parse Claude CLI response as JSON');
    console.error(`Response was: ${result.substring(0, 200)}...`);
    throw new Error(`Invalid JSON response from Claude CLI: ${error.message}`);
  }

  // Validate response structure
  let queries: CoreQuery[];
  if (parsed.structured_output) {
    if (!Array.isArray(parsed.structured_output)) {
      throw new Error('Expected structured_output to be an array');
    }
    queries = parsed.structured_output;
  } else if (parsed.result) {
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(parsed.result);
    } catch (error: any) {
      throw new Error(`Failed to parse result field as JSON: ${error.message}`);
    }
    if (!Array.isArray(parsedResult)) {
      throw new Error('Expected parsed result to be an array');
    }
    queries = parsedResult;
  } else {
    throw new Error('Response missing both structured_output and result fields');
  }

  // Validate each query has required fields
  queries.forEach((q, i) => {
    if (!q.query || typeof q.query !== 'string') {
      throw new Error(`Query ${i} missing or invalid 'query' field`);
    }
    if (!q.intent || typeof q.intent !== 'string') {
      throw new Error(`Query ${i} missing or invalid 'intent' field`);
    }
    if (!q.category || typeof q.category !== 'string') {
      throw new Error(`Query ${i} missing or invalid 'category' field`);
    }
  });

  // Assign IDs
  queries = queries.map((q, i) => ({
    ...q,
    id: `gen-${String(i + 1).padStart(3, '0')}`,
  }));

  // Interactive review loop
  let done = false;
  while (!done) {
    console.log(`\nProposed queries (${queries.length}):\n`);
    queries.forEach((q, i) => {
      console.log(`${String(i + 1).padStart(2)}. [${q.category}] "${q.query}"`);
      console.log(`    Intent: ${q.intent}\n`);
    });

    const action = await prompt.question('Actions: [a]ccept, [d]rop <nums>, [e]dit <num>, [q]uit: ');

    if (action === 'a' || action === 'accept') {
      done = true;
    } else if (action.startsWith('d ') || action.startsWith('drop ')) {
      const nums = action.replace(/^d(rop)?\s+/, '').split(',').map(n => parseInt(n.trim(), 10) - 1);
      queries = queries.filter((_, i) => !nums.includes(i));
      console.log(`Dropped ${nums.length} queries.`);
    } else if (action.startsWith('e ') || action.startsWith('edit ')) {
      const num = parseInt(action.replace(/^e(dit)?\s+/, ''), 10) - 1;
      if (queries[num]) {
        const newQuery = await prompt.question(`Query [${queries[num].query}]: `);
        const newIntent = await prompt.question(`Intent [${queries[num].intent}]: `);
        if (newQuery.trim()) queries[num].query = newQuery.trim();
        if (newIntent.trim()) queries[num].intent = newIntent.trim();
      }
    } else if (action === 'q' || action === 'quit') {
      prompt.close();
      console.log('Cancelled.');
      return;
    }
  }

  // Save to file
  const name = await prompt.question('Save as (name): ');
  const filename = name.trim() || `generated-${new Date().toISOString().split('T')[0]}`;

  const outputDir = join(QUERIES_DIR, 'generated');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, `${filename}.json`);
  const querySet: QuerySet = {
    version: '1.0.0',
    description: `AI-generated queries from ${new Date().toISOString()}`,
    queries,
    source: 'ai-generated',
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(outputPath, JSON.stringify(querySet, null, 2));
  console.log(`\n✓ Saved ${queries.length} queries to ${outputPath}`);

  prompt.close();
}

async function reviewQueries(setName: string): Promise<void> {
  const prompt = createPrompt();

  console.log(`📝 Reviewing query set: ${setName}\n`);

  const querySet = setName === 'all' ? loadAllQuerySets() : loadQuerySet(setName);
  let queries = [...querySet.queries];

  // Interactive review loop (same as generate)
  let done = false;
  while (!done) {
    console.log(`\nQueries (${queries.length}):\n`);
    queries.forEach((q, i) => {
      console.log(`${String(i + 1).padStart(2)}. [${q.category}] "${q.query}"`);
      console.log(`    Intent: ${q.intent}\n`);
    });

    const action = await prompt.question('Actions: [d]rop <nums>, [e]dit <num>, [a]dd, [s]ave, [q]uit: ');

    if (action === 's' || action === 'save') {
      done = true;
    } else if (action.startsWith('d ') || action.startsWith('drop ')) {
      const nums = action.replace(/^d(rop)?\s+/, '').split(',').map(n => parseInt(n.trim(), 10) - 1);
      queries = queries.filter((_, i) => !nums.includes(i));
      console.log(`Dropped ${nums.length} queries.`);
    } else if (action.startsWith('e ') || action.startsWith('edit ')) {
      const num = parseInt(action.replace(/^e(dit)?\s+/, ''), 10) - 1;
      if (queries[num]) {
        const newQuery = await prompt.question(`Query [${queries[num].query}]: `);
        const newIntent = await prompt.question(`Intent [${queries[num].intent}]: `);
        if (newQuery.trim()) queries[num].query = newQuery.trim();
        if (newIntent.trim()) queries[num].intent = newIntent.trim();
      }
    } else if (action === 'a' || action === 'add') {
      const newQuery = await prompt.question('Query: ');
      const newIntent = await prompt.question('Intent: ');
      const newCategory = await prompt.question('Category (code-pattern/concept/api-reference/troubleshooting/comparison): ');
      queries.push({
        id: `manual-${queries.length + 1}`,
        query: newQuery.trim(),
        intent: newIntent.trim(),
        category: (newCategory.trim() || 'code-pattern') as CoreQuery['category'],
      });
    } else if (action === 'q' || action === 'quit') {
      prompt.close();
      console.log('Cancelled without saving.');
      return;
    }
  }

  // Save back
  const sets = listQuerySets();
  const setInfo = sets.find(s => s.name === setName);
  if (setInfo && setName !== 'all') {
    // Backup original
    const backup = readFileSync(setInfo.path, 'utf-8');
    writeFileSync(`${setInfo.path}.bak`, backup);

    querySet.queries = queries;
    writeFileSync(setInfo.path, JSON.stringify(querySet, null, 2));
    console.log(`\n✓ Saved ${queries.length} queries to ${setInfo.path}`);
    console.log(`  Backup: ${setInfo.path}.bak`);
  } else {
    console.log('Cannot save "all" - edits would need to be saved to individual sets.');
  }

  prompt.close();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const showList = args.includes('--list');
  const generateMode = args.includes('--generate');
  const reviewMode = args.includes('--review');
  const setArg = args.find(a => a.startsWith('--set='))?.split('=')[1]
    ?? args[args.indexOf('--set') + 1];

  if (showList || (!generateMode && !reviewMode && !setArg)) {
    const sets = listQuerySets();
    printQuerySets(sets);
    console.log('\nUsage:');
    console.log('  --generate [--set <seed>]   Generate new queries');
    console.log('  --review --set <name|all>   Review existing queries');
    return;
  }

  if (generateMode) {
    await generateQueries(setArg);
  } else if (reviewMode) {
    if (!setArg) {
      console.error('--review requires --set <name|all>');
      process.exit(1);
    }
    await reviewQueries(setArg);
  }
}

main().catch(console.error);
