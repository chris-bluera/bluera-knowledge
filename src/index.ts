#!/usr/bin/env node

import { createProgram, getGlobalOptions } from './cli/program.js';
import { createStoreCommand } from './cli/commands/store.js';
import { createSearchCommand } from './cli/commands/search.js';
import { createIndexCommand } from './cli/commands/index-cmd.js';
import { createServeCommand } from './cli/commands/serve.js';
import { createCrawlCommand } from './cli/commands/crawl.js';
import { createExportCommand } from './cli/commands/export.js';

const program = createProgram();

program.addCommand(createStoreCommand(() => getGlobalOptions(program)));
program.addCommand(createSearchCommand(() => getGlobalOptions(program)));
program.addCommand(createIndexCommand(() => getGlobalOptions(program)));
program.addCommand(createServeCommand(() => getGlobalOptions(program)));
program.addCommand(createCrawlCommand(() => getGlobalOptions(program)));
program.addCommand(createExportCommand(() => getGlobalOptions(program)));

program.parse();
