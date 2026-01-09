#!/usr/bin/env node

import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { AdapterRegistry } from './analysis/adapter-registry.js';
import { ZilAdapter } from './analysis/zil/index.js';
import { createCrawlCommand } from './cli/commands/crawl.js';
import { createIndexCommand } from './cli/commands/index-cmd.js';
import { createMCPCommand } from './cli/commands/mcp.js';
import {
  createAddRepoCommand,
  createAddFolderCommand,
  createStoresCommand,
  createSuggestCommand,
} from './cli/commands/plugin-api.js';
import { createSearchCommand } from './cli/commands/search.js';
import { createServeCommand } from './cli/commands/serve.js';
import { createSetupCommand } from './cli/commands/setup.js';
import { createStoreCommand } from './cli/commands/store.js';
import { createSyncCommand } from './cli/commands/sync.js';
import { createProgram, getGlobalOptions } from './cli/program.js';

// Register built-in language adapters
const registry = AdapterRegistry.getInstance();
registry.register(new ZilAdapter());

// Default paths
const DEFAULT_DATA_DIR = join(homedir(), '.bluera', 'bluera-knowledge', 'data');
const DEFAULT_CONFIG = join(homedir(), '.bluera', 'bluera-knowledge', 'config.json');
const DEFAULT_REPOS_DIR = join(homedir(), '.bluera', 'bluera-knowledge', 'repos');

/**
 * Format a command and its subcommands recursively for comprehensive help output.
 */
function formatCommandHelp(cmd: Command, indent: string = ''): string[] {
  const lines: string[] = [];
  const name = cmd.name();
  const desc = cmd.description();
  const args = cmd.registeredArguments
    .map((a) => {
      const req = a.required;
      return req ? `<${a.name()}>` : `[${a.name()}]`;
    })
    .join(' ');

  // Command header with arguments
  lines.push(`${indent}${name}${args ? ` ${args}` : ''}`);
  if (desc) {
    lines.push(`${indent}  ${desc}`);
  }

  // Options (skip -h, --help which is auto-added)
  const options = cmd.options.filter((o) => o.flags !== '-h, --help');
  for (const opt of options) {
    lines.push(`${indent}  ${opt.flags.padEnd(28)} ${opt.description}`);
  }

  // Subcommands (recursive)
  const subcommands = cmd.commands.filter((c) => c.name() !== 'help');
  for (const sub of subcommands) {
    lines.push('');
    lines.push(...formatCommandHelp(sub, `${indent}  `));
  }

  return lines;
}

/**
 * Print comprehensive help showing all commands, subcommands, and options.
 */
function printFullHelp(program: Command): void {
  console.log('bluera-knowledge - CLI tool for managing knowledge stores with semantic search\n');

  // Active paths
  console.log('Paths:');
  console.log(`  data        ${DEFAULT_DATA_DIR}`);
  console.log(`  config      ${DEFAULT_CONFIG}`);
  console.log(`  repos       ${DEFAULT_REPOS_DIR}`);

  // Global options
  console.log('\nGlobal options:');
  const globalOpts = program.options.filter(
    (o) => o.flags !== '-h, --help' && o.flags !== '-V, --version'
  );
  for (const opt of globalOpts) {
    console.log(`  ${opt.flags.padEnd(28)} ${opt.description}`);
  }

  console.log('\nCommands:\n');

  // All commands except help
  const commands = program.commands.filter((c) => c.name() !== 'help');
  for (const cmd of commands) {
    console.log(formatCommandHelp(cmd).join('\n'));
    console.log('');
  }
}

const program = createProgram();

// Plugin API commands (simple interface)
program.addCommand(createAddRepoCommand(() => getGlobalOptions(program)));
program.addCommand(createAddFolderCommand(() => getGlobalOptions(program)));
program.addCommand(createStoresCommand(() => getGlobalOptions(program)));
program.addCommand(createSuggestCommand(() => getGlobalOptions(program)));

// Advanced CLI commands
program.addCommand(createStoreCommand(() => getGlobalOptions(program)));
program.addCommand(createSearchCommand(() => getGlobalOptions(program)));
program.addCommand(createIndexCommand(() => getGlobalOptions(program)));
program.addCommand(createServeCommand(() => getGlobalOptions(program)));
program.addCommand(createCrawlCommand(() => getGlobalOptions(program)));
program.addCommand(createSetupCommand(() => getGlobalOptions(program)));
program.addCommand(createSyncCommand(() => getGlobalOptions(program)));
program.addCommand(createMCPCommand(() => getGlobalOptions(program)));

// Show comprehensive help when no arguments provided
if (process.argv.length <= 2) {
  printFullHelp(program);
  process.exit(0);
}

program.parse();
