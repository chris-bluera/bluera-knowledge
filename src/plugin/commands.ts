import { createServices } from '../services/index.js';
import { extractRepoName } from './git-clone.js';
import { DependencyUsageAnalyzer } from '../analysis/dependency-usage-analyzer.js';
import { RepoUrlResolver } from '../analysis/repo-url-resolver.js';
import ora from 'ora';

export async function handleSearch(args: {
  query: string;
  stores?: string;
  limit?: string;
}): Promise<void> {
  // PWD is set by Claude Code to user's project directory
  const services = await createServices(undefined, undefined, process.env['PWD']);
  const storeNames = args.stores?.split(',').map((s: string) => s.trim());

  const allStores = await services.store.list();
  const targetStores = storeNames !== undefined
    ? allStores.filter((s) => storeNames.includes(s.name))
    : allStores;

  if (targetStores.length === 0) {
    console.error('No stores found to search');
    process.exit(1);
  }

  // Initialize stores
  for (const store of targetStores) {
    await services.lance.initialize(store.id);
  }

  const results = await services.search.search({
    query: args.query,
    stores: targetStores.map((s) => s.id),
    mode: 'hybrid',
    limit: parseInt(args.limit ?? '10', 10),
    detail: 'contextual'
  });

  console.log(`Found ${String(results.totalResults)} results:\n`);
  for (const r of results.results) {
    if (r.summary !== undefined) {
      console.log(`Score: ${r.score.toFixed(2)} - ${r.summary.location}`);
      console.log(r.summary.purpose);
    }
    console.log('---');
  }
}

export async function handleAddRepo(args: {
  url: string;
  name?: string;
  branch?: string;
}): Promise<void> {
  // PWD is set by Claude Code to user's project directory
  const services = await createServices(undefined, undefined, process.env['PWD']);
  const storeName = args.name ?? extractRepoName(args.url);

  console.log(`Cloning ${args.url}...`);

  const result = await services.store.create({
    name: storeName,
    type: 'repo',
    url: args.url,
    ...(args.branch !== undefined ? { branch: args.branch } : {})
  });

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  console.log(`Created store: ${storeName} (${result.data.id})`);
  if ('path' in result.data) {
    console.log(`Location: ${result.data.path}`);
  }

  // Auto-index
  console.log('\nIndexing...');
  const indexResult = await services.index.indexStore(result.data);

  if (indexResult.success) {
    console.log(`Indexed ${String(indexResult.data.documentsIndexed)} files`);
  } else {
    console.error(`Indexing failed: ${indexResult.error.message}`);
  }
}

export async function handleAddFolder(args: {
  path: string;
  name?: string;
}): Promise<void> {
  // PWD is set by Claude Code to user's project directory
  const services = await createServices(undefined, undefined, process.env['PWD']);
  const { basename } = await import('node:path');
  const storeName = args.name ?? basename(args.path);

  console.log(`Adding folder: ${args.path}...`);

  const result = await services.store.create({
    name: storeName,
    type: 'file',
    path: args.path
  });

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  console.log(`Created store: ${storeName} (${result.data.id})`);
  if ('path' in result.data) {
    console.log(`Location: ${result.data.path}`);
  }

  // Auto-index
  console.log('\nIndexing...');
  const indexResult = await services.index.indexStore(result.data);

  if (indexResult.success) {
    console.log(`Indexed ${String(indexResult.data.documentsIndexed)} files`);
  } else {
    console.error(`Indexing failed: ${indexResult.error.message}`);
  }
}

export async function handleIndex(args: {
  store: string;
}): Promise<void> {
  // PWD is set by Claude Code to user's project directory
  const services = await createServices(undefined, undefined, process.env['PWD']);
  const store = await services.store.getByIdOrName(args.store);

  if (store === undefined) {
    console.error(`Store not found: ${args.store}`);
    process.exit(1);
  }

  console.log(`Indexing ${store.name}...`);
  const result = await services.index.indexStore(store);

  if (result.success) {
    console.log(`Indexed ${String(result.data.documentsIndexed)} documents in ${String(result.data.timeMs)}ms`);
  } else {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
}

export async function handleStores(): Promise<void> {
  // PWD is set by Claude Code to user's project directory
  const services = await createServices(undefined, undefined, process.env['PWD']);
  const stores = await services.store.list();

  if (stores.length === 0) {
    console.log('No stores found.');
    console.log('\nCreate a store with:');
    console.log('  /bluera-knowledge:add-repo <url> --name=<name>');
    console.log('  /bluera-knowledge:add-folder <path> --name=<name>');
    return;
  }

  // Table header
  console.log('| Name | Type | ID | Source |');
  console.log('|------|------|----|--------------------|');

  // Table rows
  for (const store of stores) {
    const name = store.name;
    const type = store.type;
    const id = store.id;
    let source = '';

    if ('url' in store && store.url !== undefined) {
      source = store.url;
    } else if ('path' in store) {
      source = store.path;
    }

    console.log(`| ${name} | ${type} | ${id.substring(0, 8)}... | ${source} |`);
  }
}

export async function handleSuggest(): Promise<void> {
  // PWD is set by Claude Code to user's project directory
  const projectRoot = process.env['PWD'] ?? process.cwd();

  console.log('Analyzing project dependencies...\n');

  // Create analyzer instance
  const services = await createServices(undefined, undefined, projectRoot);
  const analyzer = new DependencyUsageAnalyzer();
  const resolver = new RepoUrlResolver();

  // Analyze with progress indicator
  const spinner = ora('Scanning source files...').start();

  const result = await analyzer.analyze(projectRoot, (current, total, message) => {
    spinner.text = `${message} (${String(current)}/${String(total)})`;
  });

  spinner.stop();

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  const { usages, totalFilesScanned, skippedFiles } = result.data;

  console.log(`✔ Scanned ${String(totalFilesScanned)} files${skippedFiles > 0 ? ` (skipped ${String(skippedFiles)})` : ''}\n`);

  if (usages.length === 0) {
    console.log('No external dependencies found in this project.');
    console.log('\nMake sure you have a package.json or requirements.txt file.');
    return;
  }

  // Filter out packages already in stores
  const existingStores = await services.store.list();
  const existingRepoNames = new Set(existingStores.map(s => s.name));

  const newUsages = usages.filter(u => !existingRepoNames.has(u.packageName));

  if (newUsages.length === 0) {
    console.log('✔ All dependencies are already in knowledge stores!');
    return;
  }

  // Show top 5 suggestions
  const topSuggestions = newUsages.slice(0, 5);

  console.log('Top dependencies by usage in this project:\n');
  topSuggestions.forEach((usage, i) => {
    console.log(`${String(i + 1)}. ${usage.packageName}`);
    console.log(`   ${String(usage.importCount)} imports across ${String(usage.fileCount)} files\n`);
  });

  console.log('Searching for repository URLs...\n');

  // For each package, find repo URL
  for (const usage of topSuggestions) {
    const repoResult = await resolver.findRepoUrl(
      usage.packageName,
      'javascript' // TODO: detect language from project
    );

    if (repoResult.url !== null) {
      console.log(`✔ ${usage.packageName}: ${repoResult.url}`);
      console.log(`  /bluera-knowledge:add-repo ${repoResult.url} --name=${usage.packageName}\n`);
    } else {
      console.log(`✗ ${usage.packageName}: Could not find repository URL`);
      console.log(`  You can manually add it: /bluera-knowledge:add-repo <url> --name=${usage.packageName}\n`);
    }
  }

  console.log('Use the commands above to add repositories to your knowledge stores.');
}
