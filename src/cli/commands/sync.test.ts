import { describe, it, expect } from 'vitest';
import { createSyncCommand } from './sync.js';
import type { GlobalOptions } from '../program.js';

describe('createSyncCommand', () => {
  function createTestOptions(): GlobalOptions {
    return {
      dataDir: '/tmp/test-data',
      projectRoot: '/tmp/test-project',
      format: 'table',
    };
  }

  it('creates sync command with correct name and description', () => {
    const cmd = createSyncCommand(createTestOptions);
    expect(cmd.name()).toBe('sync');
    expect(cmd.description()).toContain('Sync');
  });

  it('has --dry-run option', () => {
    const cmd = createSyncCommand(createTestOptions);
    const options = cmd.options;
    const dryRunOpt = options.find((o) => o.long === '--dry-run');
    expect(dryRunOpt).toBeDefined();
  });

  it('has --prune option', () => {
    const cmd = createSyncCommand(createTestOptions);
    const options = cmd.options;
    const pruneOpt = options.find((o) => o.long === '--prune');
    expect(pruneOpt).toBeDefined();
  });

  it('has --reindex option', () => {
    const cmd = createSyncCommand(createTestOptions);
    const options = cmd.options;
    const reindexOpt = options.find((o) => o.long === '--reindex');
    expect(reindexOpt).toBeDefined();
  });

  it('has correct option descriptions', () => {
    const cmd = createSyncCommand(createTestOptions);
    const options = cmd.options;

    const dryRunOpt = options.find((o) => o.long === '--dry-run');
    expect(dryRunOpt?.description).toContain('without making changes');

    const pruneOpt = options.find((o) => o.long === '--prune');
    expect(pruneOpt?.description).toContain('Remove');

    const reindexOpt = options.find((o) => o.long === '--reindex');
    expect(reindexOpt?.description).toContain('Re-index');
  });
});
