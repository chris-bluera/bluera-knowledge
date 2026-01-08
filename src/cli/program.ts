import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

interface PackageJson {
  version: string;
}

function getVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const content = readFileSync(join(__dirname, '../package.json'), 'utf-8');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const pkg: PackageJson = JSON.parse(content);
  return pkg.version;
}

const version = getVersion();

export function createProgram(): Command {
  const program = new Command();

  program
    .name('bluera-knowledge')
    .description('CLI tool for managing knowledge stores with semantic search')
    .version(version);

  program
    .option('-c, --config <path>', 'Path to config file')
    .option('-d, --data-dir <path>', 'Data directory')
    .option('-p, --project-root <path>', 'Project root directory (for resolving relative paths)')
    .option('-f, --format <format>', 'Output format: json | table | plain', 'table')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-v, --verbose', 'Enable verbose logging');

  return program;
}

export interface GlobalOptions {
  config?: string | undefined;
  dataDir?: string | undefined;
  projectRoot?: string | undefined;
  format: 'json' | 'table' | 'plain';
  quiet?: boolean | undefined;
  verbose?: boolean | undefined;
}

export function getGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts<GlobalOptions>();
  return {
    config: opts.config,
    dataDir: opts.dataDir,
    projectRoot: opts.projectRoot,
    format: opts.format,
    quiet: opts.quiet,
    verbose: opts.verbose,
  };
}
