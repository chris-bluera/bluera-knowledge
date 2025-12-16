import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService } from './config.service.js';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ConfigService', () => {
  let configService: ConfigService;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'config-test-'));
    configPath = join(tempDir, 'config.json');
    configService = new ConfigService(configPath, tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('loads default config when no file exists', async () => {
    const config = await configService.load();
    expect(config.version).toBe(1);
    expect(config.embedding.model).toBe('Xenova/all-MiniLM-L6-v2');
  });

  it('saves and loads config', async () => {
    const config = await configService.load();
    config.search.defaultLimit = 20;
    await configService.save(config);

    const loaded = await configService.load();
    expect(loaded.search.defaultLimit).toBe(20);
  });

  it('resolves data directory path', async () => {
    const config = await configService.load();
    const dataDir = configService.resolveDataDir();
    expect(dataDir).toBe(tempDir);
  });
});
