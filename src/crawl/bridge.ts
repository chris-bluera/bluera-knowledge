import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

interface CrawlResult {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    links: string[];
    crawledAt: string;
  }>;
}

export class PythonBridge {
  private process: ChildProcess | null = null;
  private pending: Map<string, { resolve: (v: CrawlResult) => void; reject: (e: Error) => void }> = new Map();

  async start(): Promise<void> {
    if (this.process) return;

    this.process = spawn('python3', ['python/crawl_worker.py'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        const pending = this.pending.get(response.id);
        if (pending) {
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
          this.pending.delete(response.id);
        }
      } catch {}
    });
  }

  async crawl(url: string): Promise<CrawlResult> {
    if (!this.process) await this.start();

    const id = randomUUID();
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'crawl',
      params: { url },
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
