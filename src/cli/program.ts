import { Command } from 'commander';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('bkb')
    .description('CLI tool for managing knowledge stores with semantic search')
    .version('0.1.0');

  program
    .option('-c, --config <path>', 'Path to config file')
    .option('-d, --data-dir <path>', 'Data directory')
    .option('-f, --format <format>', 'Output format: json | table | plain', 'table')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-v, --verbose', 'Enable verbose logging');

  return program;
}

export interface GlobalOptions {
  config?: string;
  dataDir?: string;
  format: 'json' | 'table' | 'plain';
  quiet?: boolean;
  verbose?: boolean;
}

export function getGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts<GlobalOptions>();
  return {
    config: opts.config,
    dataDir: opts.dataDir,
    format: opts.format ?? 'table',
    quiet: opts.quiet,
    verbose: opts.verbose,
  };
}
