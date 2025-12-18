import { Command } from 'commander';
import { serve } from '@hono/node-server';
import { createServices } from '../../services/index.js';
import { createApp } from '../../server/app.js';
import type { GlobalOptions } from '../program.js';

export function createServeCommand(getOptions: () => GlobalOptions): Command {
  return new Command('serve')
    .description('Start HTTP API server for programmatic search access')
    .option('-p, --port <port>', 'Port to listen on (default: 3847)', '3847')
    .option('--host <host>', 'Bind address (default: 127.0.0.1, use 0.0.0.0 for all interfaces)', '127.0.0.1')
    .action(async (options: { port?: string; host?: string }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const app = createApp(services);

      const port = parseInt(options.port ?? '3847', 10);
      const host = options.host ?? '127.0.0.1';

      console.log(`Starting server on http://${host}:${port}`);

      serve({
        fetch: app.fetch,
        port,
        hostname: host,
      });
    });
}
