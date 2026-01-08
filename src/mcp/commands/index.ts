/**
 * Command registration for the execute meta-tool
 *
 * This module registers all commands with the command registry.
 * Import this module to ensure all commands are available.
 */

import { jobCommands } from './job.commands.js';
import { metaCommands } from './meta.commands.js';
import { commandRegistry } from './registry.js';
import { storeCommands } from './store.commands.js';

// Register all commands
commandRegistry.registerAll(storeCommands);
commandRegistry.registerAll(jobCommands);
commandRegistry.registerAll(metaCommands);

// Re-export for convenience
export { commandRegistry, executeCommand, generateHelp } from './registry.js';
export type { CommandDefinition, CommandHandler } from './registry.js';
