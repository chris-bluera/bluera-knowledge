import { z } from 'zod';
import type { HandlerContext, ToolResponse } from '../types.js';

/**
 * Command definition for the execute meta-tool
 *
 * Each command has a name, description, optional args schema, and handler.
 * Commands are registered in the registry and invoked via execute(command, args).
 */
export interface CommandDefinition {
  /** Command name (e.g., 'stores', 'store:info', 'job:status') */
  name: string;
  /** Human-readable description shown in help output */
  description: string;
  /** Optional Zod schema for argument validation */
  argsSchema?: z.ZodType;
  /** Handler function that executes the command */
  handler: CommandHandler;
}

/**
 * Command handler function signature
 *
 * @param args - Validated command arguments (or empty object if no args)
 * @param context - Handler context with services and options
 * @returns Promise resolving to tool response
 */
export type CommandHandler = (
  args: Record<string, unknown>,
  context: HandlerContext
) => Promise<ToolResponse>;

/**
 * Command registry - singleton that holds all registered commands
 */
class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

  /**
   * Register a command
   */
  register(command: CommandDefinition): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command already registered: ${command.name}`);
    }
    this.commands.set(command.name, command);
  }

  /**
   * Register multiple commands at once
   */
  registerAll(commands: CommandDefinition[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Get a command by name
   */
  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  /**
   * Check if a command exists
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all registered commands
   */
  all(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands grouped by category (prefix before colon)
   */
  grouped(): Map<string, CommandDefinition[]> {
    const groups = new Map<string, CommandDefinition[]>();

    for (const cmd of this.commands.values()) {
      const colonIndex = cmd.name.indexOf(':');
      const category = colonIndex === -1 ? 'general' : cmd.name.slice(0, colonIndex);

      const existing = groups.get(category) ?? [];
      existing.push(cmd);
      groups.set(category, existing);
    }

    return groups;
  }
}

/** Global command registry instance */
export const commandRegistry = new CommandRegistry();

/**
 * Execute a command by name
 *
 * @param commandName - The command to execute
 * @param args - Arguments to pass to the command
 * @param context - Handler context
 * @returns Promise resolving to tool response
 */
export async function executeCommand(
  commandName: string,
  args: Record<string, unknown>,
  context: HandlerContext
): Promise<ToolResponse> {
  const command = commandRegistry.get(commandName);

  if (command === undefined) {
    throw new Error(
      `Unknown command: ${commandName}. Use execute("commands") to list available commands.`
    );
  }

  // Validate args if schema provided (Zod parse returns unknown, safe to cast after validation)
  /* eslint-disable @typescript-eslint/consistent-type-assertions */
  const validatedArgs: Record<string, unknown> =
    command.argsSchema !== undefined
      ? (command.argsSchema.parse(args) as Record<string, unknown>)
      : args;
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  return command.handler(validatedArgs, context);
}

/**
 * Generate help text for a command or all commands
 */
export function generateHelp(commandName?: string): string {
  if (commandName !== undefined) {
    const command = commandRegistry.get(commandName);
    if (command === undefined) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    const lines = [`Command: ${command.name}`, `Description: ${command.description}`, ''];

    if (command.argsSchema !== undefined) {
      lines.push('Arguments:');
      // Extract schema shape for documentation
      const schema = command.argsSchema;
      if (schema instanceof z.ZodObject) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const shape = schema.shape as Record<string, z.ZodType>;
        for (const [key, fieldSchema] of Object.entries(shape)) {
          const isOptional = fieldSchema.safeParse(undefined).success;
          const desc = fieldSchema.description ?? '';
          lines.push(`  ${key}${isOptional ? ' (optional)' : ''}: ${desc}`);
        }
      }
    } else {
      lines.push('Arguments: none');
    }

    return lines.join('\n');
  }

  // Generate help for all commands
  const groups = commandRegistry.grouped();
  const lines = ['Available commands:', ''];

  for (const [category, commands] of groups) {
    lines.push(`${category}:`);
    for (const cmd of commands) {
      lines.push(`  ${cmd.name} - ${cmd.description}`);
    }
    lines.push('');
  }

  lines.push('Use execute("help", {command: "name"}) for detailed command help.');

  return lines.join('\n');
}
