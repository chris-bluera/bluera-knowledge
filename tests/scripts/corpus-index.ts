#!/usr/bin/env npx tsx

import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');
const CORPUS_DIR = join(__dirname, '..', 'fixtures', 'corpus');

const STORE_NAME = 'bluera-test-corpus';

function run(command: string, description: string): void {
  console.log(`\n📌 ${description}...`);
  try {
    execSync(command, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    throw error;
  }
}

async function main() {
  console.log('🔧 Corpus Index Setup');
  console.log(`   Store: ${STORE_NAME}`);
  console.log(`   Corpus: ${CORPUS_DIR}`);

  // Verify corpus exists
  if (!existsSync(CORPUS_DIR)) {
    console.error(`❌ Corpus directory not found: ${CORPUS_DIR}`);
    process.exit(1);
  }

  // Check if store exists, delete if so
  try {
    execSync(`node dist/index.js store info ${STORE_NAME}`, {
      cwd: ROOT_DIR,
      stdio: 'pipe',
    });
    console.log(`\n⚠️  Store "${STORE_NAME}" exists, deleting...`);
    run(`node dist/index.js store delete ${STORE_NAME} --force`, 'Deleting existing store');
  } catch {
    // Store doesn't exist, that's fine
  }

  // Create store
  run(
    `node dist/index.js store create ${STORE_NAME} --type file --source "${CORPUS_DIR}" --description "Test corpus for search quality benchmarks"`,
    'Creating test store'
  );

  // Index the store
  run(
    `node dist/index.js index ${STORE_NAME}`,
    'Indexing corpus'
  );

  // Show store info
  run(
    `node dist/index.js store info ${STORE_NAME}`,
    'Verifying store'
  );

  console.log('\n✅ Corpus indexed successfully!');
  console.log(`   Run quality tests with: npm run test:quality`);
}

main().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
