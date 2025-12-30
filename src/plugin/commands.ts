import { createServices } from '../services/index.js';
import { extractRepoName } from './git-clone.js';
import { analyzeDependencies } from './dependency-analyzer.js';

export async function handleSearch(args: {
  query: string;
  stores?: string;
  limit?: string;
}): Promise<void> {
  const services = await createServices();
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
  const services = await createServices();
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
  const services = await createServices();
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
  const services = await createServices();
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
  const services = await createServices();
  const stores = await services.store.list();

  if (stores.length === 0) {
    console.log('No stores found.');
    console.log('\nCreate a store with:');
    console.log('  /ckb:add-repo <url> --name=<name>');
    console.log('  /ckb:add-folder <path> --name=<name>');
    return;
  }

  console.log('Knowledge Stores:\n');
  for (const store of stores) {
    console.log(`${store.name} (${store.type})`);
    console.log(`  ID: ${store.id}`);
    if ('path' in store) {
      console.log(`  Path: ${store.path}`);
    }
    if ('url' in store && store.url !== undefined) {
      console.log(`  URL: ${store.url}`);
    }
    if (store.description !== undefined) {
      console.log(`  Description: ${store.description}`);
    }
    console.log('');
  }
}

export async function handleSuggest(): Promise<void> {
  const projectRoot = process.cwd();

  console.log('Analyzing project dependencies...\n');

  const suggestions = await analyzeDependencies(projectRoot);

  if (suggestions.length === 0) {
    console.log('No recognized dependencies found to suggest.');
    console.log('\nYou can manually add repos with:');
    console.log('  /ckb:add-repo <url> --name=<name>');
    return;
  }

  console.log('Suggested library sources to add:\n');

  for (const suggestion of suggestions) {
    const badge = {
      critical: '⭐️',
      high: '🔵',
      medium: '◆'
    }[suggestion.importance];

    console.log(`${badge} ${suggestion.name}`);
    console.log(`   ${suggestion.reason}`);
    console.log(`   /ckb:add-repo ${suggestion.url} --name=${suggestion.name}\n`);
  }

  console.log(`Showing ${String(suggestions.length)} important dependencies.`);
  console.log('Not suggesting minor/specific packages - focus on core libraries.');
}
