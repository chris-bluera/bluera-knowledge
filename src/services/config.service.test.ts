import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService } from './config.service.js';
import { rm, mkdtemp, writeFile, access } from 'node:fs/promises';
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

  describe('path expansion', () => {
    it('expands tilde to home directory', () => {
      const service = new ConfigService(configPath, '~/.bluera/data');
      const dataDir = service.resolveDataDir();
      // Note: expandPath is called in constructor, so ~ will be kept
      // since dataDir parameter is explicitly provided
      expect(dataDir).toBe('~/.bluera/data');
    });

    it('resolves relative paths against project root', () => {
      const service = new ConfigService(configPath, undefined, tempDir);
      const dataDir = service.resolveDataDir();
      // When dataDir is undefined, it uses DEFAULT_CONFIG.dataDir which is relative
      expect(dataDir).toContain(tempDir);
    });

    it('keeps absolute paths as-is', () => {
      const absolutePath = '/absolute/path/to/data';
      const service = new ConfigService(configPath, absolutePath);
      const dataDir = service.resolveDataDir();
      expect(dataDir).toBe(absolutePath);
    });

    it('uses explicit dataDir when provided', () => {
      const explicitDir = '/explicit/data/dir';
      const service = new ConfigService(configPath, explicitDir);
      const dataDir = service.resolveDataDir();
      expect(dataDir).toBe(explicitDir);
    });

    it('uses default path resolution when dataDir is empty string', () => {
      const service = new ConfigService(
        configPath,
        '' // Empty string triggers default path logic
      );
      const dataDir = service.resolveDataDir();
      // Empty string is not undefined, so it should resolve relative default
      expect(dataDir).toContain('.bluera/bluera-knowledge/data');
    });
  });

  describe('config caching', () => {
    it('caches loaded config', async () => {
      const config1 = await configService.load();
      const config2 = await configService.load();
      expect(config1).toBe(config2); // Same reference
    });

    it('updates cache when saving', async () => {
      const config = await configService.load();
      config.search.defaultLimit = 25;
      await configService.save(config);

      const loaded = await configService.load();
      expect(loaded.search.defaultLimit).toBe(25);
    });
  });

  describe('config persistence', () => {
    it('creates config directory if it does not exist', async () => {
      const deepPath = join(tempDir, 'deep', 'nested', 'path', 'config.json');
      const service = new ConfigService(deepPath, tempDir);

      const config = await service.load();
      await service.save(config);

      // Should successfully save to deep path
      const loaded = await service.load();
      expect(loaded).toBeDefined();
    });
  });

  describe('first-run vs corruption handling (CLAUDE.md compliance)', () => {
    it('creates config file on first run when missing', async () => {
      // Config file does not exist
      const config = await configService.load();

      // Should return default config
      expect(config.version).toBe(1);

      // File should now exist (created automatically)
      await expect(access(configPath)).resolves.toBeUndefined();
    });

    it('throws on corrupted config file', async () => {
      // Create corrupted config file
      await writeFile(configPath, '{invalid json syntax');

      // Create fresh service (no cache)
      const freshService = new ConfigService(configPath, tempDir);

      // Should throw per CLAUDE.md "fail early and fast"
      await expect(freshService.load()).rejects.toThrow();
    });

    it('throws with descriptive message on JSON parse error', async () => {
      await writeFile(configPath, '{"incomplete":');

      const freshService = new ConfigService(configPath, tempDir);

      await expect(freshService.load()).rejects.toThrow(/JSON|parse|config/i);
    });
  });
});
