import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import ora from 'ora';
import { createServices } from '../../services/index.js';
import { DEFAULT_REPOS, type DefaultRepo } from '../../defaults/repos.js';
import type { GlobalOptions } from '../program.js';

const DEFAULT_REPOS_DIR = join(homedir(), '.bluera', 'repos');

export function createSetupCommand(getOptions: () => GlobalOptions): Command {
  const setup = new Command('setup')
    .description('Set up default knowledge stores from Anthropic repositories');

  setup
    .command('repos')
    .description('Clone and index default Anthropic repositories')
    .option('--repos-dir <path>', 'Directory to clone repos into', DEFAULT_REPOS_DIR)
    .option('--skip-clone', 'Skip cloning, only create stores and index')
    .option('--skip-index', 'Skip indexing after cloning')
    .option('--only <names>', 'Only setup specific repos (comma-separated)')
    .option('--list', 'List available default repos without setting up')
    .action(async (options: {
      reposDir: string;
      skipClone?: boolean;
      skipIndex?: boolean;
      only?: string;
      list?: boolean;
    }) => {
      const globalOpts = getOptions();

      // List mode: just show available repos
      if (options.list) {
        console.log('\nDefault repositories:\n');
        for (const repo of DEFAULT_REPOS) {
          console.log(`  ${repo.name}`);
          console.log(`    URL: ${repo.url}`);
          console.log(`    Description: ${repo.description}`);
          console.log(`    Tags: ${repo.tags.join(', ')}`);
          console.log('');
        }
        return;
      }

      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      // Filter repos if --only specified
      let repos: readonly DefaultRepo[] = DEFAULT_REPOS;
      if (options.only) {
        const onlyNames = options.only.split(',').map(n => n.trim().toLowerCase());
        repos = DEFAULT_REPOS.filter(r =>
          onlyNames.some(n => r.name.toLowerCase().includes(n))
        );
        if (repos.length === 0) {
          console.error(`No repos matched: ${options.only}`);
          console.log('Available repos:', DEFAULT_REPOS.map(r => r.name).join(', '));
          process.exit(1);
        }
      }

      console.log(`\nSetting up ${repos.length} repositories...\n`);

      // Ensure repos directory exists
      await mkdir(options.reposDir, { recursive: true });

      for (const repo of repos) {
        const repoPath = join(options.reposDir, repo.name);
        const spinner = ora(`Processing ${repo.name}`).start();

        try {
          // Step 1: Clone if needed
          if (!options.skipClone) {
            if (existsSync(repoPath)) {
              spinner.text = `${repo.name}: Already cloned, pulling latest...`;
              try {
                execSync('git pull --ff-only', { cwd: repoPath, stdio: 'pipe' });
              } catch {
                // Pull failed (maybe diverged), that's okay
                spinner.text = `${repo.name}: Pull skipped (local changes)`;
              }
            } else {
              spinner.text = `${repo.name}: Cloning...`;
              execSync(`git clone ${repo.url} "${repoPath}"`, { stdio: 'pipe' });
            }
          }

          // Step 2: Create store if needed
          spinner.text = `${repo.name}: Creating store...`;
          const existingStore = await services.store.getByIdOrName(repo.name);

          let storeId: string;
          if (existingStore) {
            storeId = existingStore.id;
            spinner.text = `${repo.name}: Store already exists`;
          } else {
            const result = await services.store.create({
              name: repo.name,
              type: 'repo',
              path: repoPath,
              description: repo.description,
              tags: repo.tags,
            });

            if (!result.success) {
              throw new Error(result.error instanceof Error ? result.error.message : String(result.error));
            }
            storeId = result.data.id;
          }

          // Step 3: Index if needed
          if (!options.skipIndex) {
            spinner.text = `${repo.name}: Indexing...`;
            const store = await services.store.getByIdOrName(storeId);
            if (store) {
              await services.lance.initialize(store.id);
              const indexResult = await services.index.indexStore(store, (event) => {
                if (event.type === 'progress') {
                  spinner.text = `${repo.name}: Indexing ${event.current}/${event.total} files`;
                }
              });

              if (indexResult.success) {
                spinner.succeed(
                  `${repo.name}: ${indexResult.data.documentsIndexed} docs, ${indexResult.data.chunksCreated} chunks`
                );
              } else {
                throw new Error(indexResult.error instanceof Error ? indexResult.error.message : String(indexResult.error));
              }
            }
          } else {
            spinner.succeed(`${repo.name}: Ready (indexing skipped)`);
          }
        } catch (error) {
          spinner.fail(`${repo.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log('\nSetup complete! Use "bluera-knowledge search <query>" to search.\n');
    });

  setup
    .command('list')
    .description('List available default repos')
    .action(() => {
      console.log('\nDefault repositories:\n');
      for (const repo of DEFAULT_REPOS) {
        console.log(`  ${repo.name}`);
        console.log(`    URL: ${repo.url}`);
        console.log(`    Description: ${repo.description}`);
        console.log(`    Tags: ${repo.tags.join(', ')}`);
        console.log('');
      }
    });

  return setup;
}
