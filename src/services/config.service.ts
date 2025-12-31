import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { AppConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';

export class ConfigService {
  private readonly configPath: string;
  private readonly dataDir: string;
  private config: AppConfig | null = null;

  constructor(
    configPath = `${homedir()}/.bluera/bluera-knowledge/config.json`,
    dataDir?: string
  ) {
    this.configPath = configPath;
    this.dataDir = dataDir ?? this.expandPath(DEFAULT_CONFIG.dataDir);
  }

  async load(): Promise<AppConfig> {
    if (this.config !== null) {
      return this.config;
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(content) } as AppConfig;
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }

    return this.config;
  }

  async save(config: AppConfig): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(config, null, 2));
    this.config = config;
  }

  resolveDataDir(): string {
    return this.dataDir;
  }

  private expandPath(path: string): string {
    // Expand ~ to home directory
    if (path.startsWith('~')) {
      return path.replace('~', homedir());
    }
    // Resolve relative paths against current working directory
    if (!path.startsWith('/')) {
      return resolve(process.cwd(), path);
    }
    // Return absolute paths as-is
    return path;
  }
}
