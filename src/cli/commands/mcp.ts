import { Command } from 'commander';
import { runMCPServer } from '../../mcp/server.js';
import type { GlobalOptions } from '../program.js';

export function createMCPCommand(getOptions: () => GlobalOptions): Command {
  const mcp = new Command('mcp')
    .description('Start MCP (Model Context Protocol) server for AI agent integration')
    .action(async () => {
      const opts = getOptions();

      await runMCPServer({
        dataDir: opts.dataDir,
        config: opts.config,
      });
    });

  return mcp;
}
