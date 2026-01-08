import { z } from 'zod';
import { commandRegistry, generateHelp } from './registry.js';
import type { CommandDefinition } from './registry.js';
import type { ToolResponse } from '../types.js';

/**
 * Meta commands for introspection and help
 *
 * These commands provide self-documentation for the execute tool,
 * allowing users to discover available commands and their usage.
 */
export const metaCommands: CommandDefinition[] = [
  {
    name: 'commands',
    description: 'List all available commands',
    handler: (): Promise<ToolResponse> => {
      const commands = commandRegistry.all();
      const commandList = commands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
      }));

      return Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ commands: commandList }, null, 2),
          },
        ],
      });
    },
  },
  {
    name: 'help',
    description: 'Show help for a specific command or list all commands',
    argsSchema: z.object({
      command: z.string().optional().describe('Command name to get help for'),
    }),
    handler: (args: Record<string, unknown>): Promise<ToolResponse> => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const commandName = args['command'] as string | undefined;
      const helpText = generateHelp(commandName);

      return Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: helpText,
          },
        ],
      });
    },
  },
];
