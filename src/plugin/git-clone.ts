import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { ok, err } from '../types/result.js';
import type { Result } from '../types/result.js';

export interface CloneOptions {
  url: string;
  targetDir: string;
  branch?: string;
  depth?: number;
}

export async function cloneRepository(options: CloneOptions): Promise<Result<string>> {
  const { url, targetDir, branch, depth = 1 } = options;

  await mkdir(targetDir, { recursive: true });

  const args = ['clone', '--depth', String(depth)];
  if (branch !== undefined) {
    args.push('--branch', branch);
  }
  args.push(url, targetDir);

  return new Promise((resolve) => {
    const git = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    git.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    git.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(ok(targetDir));
      } else {
        resolve(err(new Error(`Git clone failed: ${stderr}`)));
      }
    });
  });
}

export function isGitUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://') || source.startsWith('git@');
}

export function extractRepoName(url: string): string {
  const match = /\/([^/]+?)(\.git)?$/.exec(url);
  const name = match?.[1];
  if (name === undefined) {
    return 'repository';
  }
  return name;
}
