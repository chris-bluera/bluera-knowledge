#!/usr/bin/env node

import { Command } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createProgram, getGlobalOptions } from './cli/program.js';
import { createStoreCommand } from './cli/commands/store.js';
import { createSearchCommand } from './cli/commands/search.js';
import { createIndexCommand } from './cli/commands/index-cmd.js';
import { createServeCommand } from './cli/commands/serve.js';
import { createCrawlCommand } from './cli/commands/crawl.js';
import { createExportCommand } from './cli/commands/export.js';
import { createImportCommand } from './cli/commands/import.js';
import { createQualityCommand } from './cli/commands/quality.js';
import { createSetupCommand } from './cli/commands/setup.js';
import { createMCPCommand } from './cli/commands/mcp.js';

// Default paths
const DEFAULT_DATA_DIR = join(homedir(), '.bluera', 'knowledge-data');
const DEFAULT_CONFIG = join(homedir(), '.bluera', 'knowledge.json');
const DEFAULT_REPOS_DIR = join(homedir(), '.bluera', 'repos');

/**
 * Format a command and its subcommands recursively for comprehensive help output.
 */
function formatCommandHelp(cmd: Command, indent: string = ''): string[] {
  const lines: string[] = [];
  const name = cmd.name();
  const desc = cmd.description();
  const args = cmd.registeredArguments.map(a => {
    const req = a.required;
    return req ? `<${a.name()}>` : `[${a.name()}]`;
  }).join(' ');

  // Command header with arguments
  lines.push(`${indent}${name}${args ? ' ' + args : ''}`);
  if (desc) {
    lines.push(`${indent}  ${desc}`);
  }

  // Options (skip -h, --help which is auto-added)
  const options = cmd.options.filter(o => o.flags !== '-h, --help');
  for (const opt of options) {
    lines.push(`${indent}  ${opt.flags.padEnd(28)} ${opt.description}`);
  }

  // Subcommands (recursive)
  const subcommands = cmd.commands.filter(c => c.name() !== 'help');
  for (const sub of subcommands) {
    lines.push('');
    lines.push(...formatCommandHelp(sub, indent + '  '));
  }

  return lines;
}

/**
 * Print comprehensive help showing all commands, subcommands, and options.
 */
function printFullHelp(program: Command): void {
  console.log('bkb - CLI tool for managing knowledge stores with semantic search\n');

  // Active paths
  console.log('Paths:');
  console.log(`  data        ${DEFAULT_DATA_DIR}`);
  console.log(`  config      ${DEFAULT_CONFIG}`);
  console.log(`  repos       ${DEFAULT_REPOS_DIR}`);

  // Global options
  console.log('\nGlobal options:');
  const globalOpts = program.options.filter(o => o.flags !== '-h, --help' && o.flags !== '-V, --version');
  for (const opt of globalOpts) {
    console.log(`  ${opt.flags.padEnd(28)} ${opt.description}`);
  }

  console.log('\nCommands:\n');

  // All commands except help
  const commands = program.commands.filter(c => c.name() !== 'help');
  for (const cmd of commands) {
    console.log(formatCommandHelp(cmd).join('\n'));
    console.log('');
  }
}

const program = createProgram();

program.addCommand(createStoreCommand(() => getGlobalOptions(program)));
program.addCommand(createSearchCommand(() => getGlobalOptions(program)));
program.addCommand(createIndexCommand(() => getGlobalOptions(program)));
program.addCommand(createServeCommand(() => getGlobalOptions(program)));
program.addCommand(createCrawlCommand(() => getGlobalOptions(program)));
program.addCommand(createExportCommand(() => getGlobalOptions(program)));
program.addCommand(createImportCommand(() => getGlobalOptions(program)));
program.addCommand(createQualityCommand(() => getGlobalOptions(program)));
program.addCommand(createSetupCommand(() => getGlobalOptions(program)));
program.addCommand(createMCPCommand(() => getGlobalOptions(program)));

// Show comprehensive help when no arguments provided
if (process.argv.length <= 2) {
  printFullHelp(program);
  process.exit(0);
}

program.parse();
