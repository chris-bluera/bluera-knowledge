import { Command } from 'commander';
import { createServices, destroyServices } from '../../services/index.js';
import type { SearchMode, DetailLevel } from '../../types/search.js';
import type { GlobalOptions } from '../program.js';

export function createSearchCommand(getOptions: () => GlobalOptions): Command {
  const search = new Command('search')
    .description('Search indexed documents using vector similarity + full-text matching')
    .argument('<query>', 'Search query')
    .option(
      '-s, --stores <stores>',
      'Limit search to specific stores (comma-separated IDs or names)'
    )
    .option(
      '-m, --mode <mode>',
      'vector (embeddings only), fts (text only), hybrid (both, default)',
      'hybrid'
    )
    .option('-n, --limit <count>', 'Maximum results to return (default: 10)', '10')
    .option('-t, --threshold <score>', 'Minimum score 0-1; omit low-relevance results')
    .option(
      '--min-relevance <score>',
      'Minimum raw cosine similarity 0-1; returns empty if no results meet threshold'
    )
    .option('--include-content', 'Show full document content, not just preview snippet')
    .option(
      '--detail <level>',
      'Context detail: minimal, contextual, full (default: minimal)',
      'minimal'
    )
    .action(
      async (
        query: string,
        options: {
          stores?: string;
          mode?: SearchMode;
          limit?: string;
          threshold?: string;
          minRelevance?: string;
          includeContent?: boolean;
          detail?: DetailLevel;
        }
      ) => {
        const globalOpts = getOptions();
        const services = await createServices(globalOpts.config, globalOpts.dataDir);
        let exitCode = 0;
        try {
          // Get store IDs
          let storeIds = (await services.store.list()).map((s) => s.id);

          searchLogic: {
            if (options.stores !== undefined) {
              const requestedStores = options.stores.split(',').map((s) => s.trim());
              const resolvedStores = [];

              for (const requested of requestedStores) {
                const store = await services.store.getByIdOrName(requested);
                if (store !== undefined) {
                  resolvedStores.push(store.id);
                } else {
                  console.error(`Error: Store not found: ${requested}`);
                  exitCode = 3;

                  break searchLogic;
                }
              }

              storeIds = resolvedStores;
            }

            if (storeIds.length === 0) {
              console.error('No stores to search. Create a store first.');
              exitCode = 1;

              break searchLogic;
            }

            // Initialize LanceDB for each store
            for (const storeId of storeIds) {
              await services.lance.initialize(storeId);
            }

            const results = await services.search.search({
              query,
              stores: storeIds,
              mode: options.mode ?? 'hybrid',
              limit: parseInt(options.limit ?? '10', 10),
              threshold:
                options.threshold !== undefined ? parseFloat(options.threshold) : undefined,
              minRelevance:
                options.minRelevance !== undefined ? parseFloat(options.minRelevance) : undefined,
              includeContent: options.includeContent,
              detail: options.detail ?? 'minimal',
            });

            if (globalOpts.format === 'json') {
              console.log(JSON.stringify(results, null, 2));
            } else if (globalOpts.quiet === true) {
              // Quiet mode: just list matching paths/URLs, one per line
              for (const r of results.results) {
                const path = r.metadata.path ?? r.metadata.url ?? 'unknown';
                console.log(path);
              }
            } else {
              console.log(`\nSearch: "${query}"`);

              // Build status line with optional confidence info
              let statusLine = `Mode: ${results.mode} | Detail: ${String(options.detail)} | Stores: ${String(results.stores.length)} | Results: ${String(results.totalResults)} | Time: ${String(results.timeMs)}ms`;
              if (results.confidence !== undefined) {
                statusLine += ` | Confidence: ${results.confidence}`;
              }
              if (results.maxRawScore !== undefined) {
                statusLine += ` | MaxRaw: ${results.maxRawScore.toFixed(3)}`;
              }
              console.log(`${statusLine}\n`);

              if (results.results.length === 0) {
                if (results.confidence === 'low') {
                  console.log('No sufficiently relevant results found.\n');
                } else {
                  console.log('No results found.\n');
                }
              } else {
                for (let i = 0; i < results.results.length; i++) {
                  const r = results.results[i];
                  if (r === undefined) continue;

                  if (r.summary) {
                    console.log(
                      `${String(i + 1)}. [${r.score.toFixed(2)}] ${r.summary.type}: ${r.summary.name}`
                    );
                    console.log(`   ${r.summary.location}`);
                    console.log(`   ${r.summary.purpose}`);

                    if (r.context && options.detail !== 'minimal') {
                      console.log(`   Imports: ${r.context.keyImports.slice(0, 3).join(', ')}`);
                      console.log(
                        `   Related: ${r.context.relatedConcepts.slice(0, 3).join(', ')}`
                      );
                    }

                    console.log();
                  } else {
                    // Display without summary
                    const path = r.metadata.path ?? r.metadata.url ?? 'unknown';
                    console.log(`${String(i + 1)}. [${r.score.toFixed(2)}] ${path}`);
                    const preview =
                      r.highlight ??
                      r.content.slice(0, 150).replace(/\n/g, ' ') +
                        (r.content.length > 150 ? '...' : '');
                    console.log(`   ${preview}\n`);
                  }
                }
              }
            }
          }
        } finally {
          await destroyServices(services);
        }

        if (exitCode !== 0) {
          process.exit(exitCode);
        }
      }
    );

  return search;
}
