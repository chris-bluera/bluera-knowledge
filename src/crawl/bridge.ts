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
  private readonly pending: Map<string, { resolve: (v: CrawlResult) => void; reject: (e: Error) => void; timeout: NodeJS.Timeout }> = new Map();

  start(): Promise<void> {
    if (this.process) return Promise.resolve();

    this.process = spawn('python3', ['python/crawl_worker.py'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Add error handler for process spawn errors
    this.process.on('error', (err) => {
      console.error('Python bridge process error:', err);
      this.rejectAllPending(new Error(`Process error: ${err.message}`));
    });

    // Add exit handler to detect non-zero exits
    this.process.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Python bridge process exited with code ${String(code)}`);
        this.rejectAllPending(new Error(`Process exited with code ${String(code)}`));
      } else if (signal) {
        console.error(`Python bridge process killed with signal ${signal}`);
        this.rejectAllPending(new Error(`Process killed with signal ${signal}`));
      }
      this.process = null;
    });

    // Add stderr logging
    if (this.process.stderr) {
      const stderrRl = createInterface({ input: this.process.stderr });
      stderrRl.on('line', (line) => {
        console.error('Python bridge stderr:', line);
      });
    }

    if (this.process.stdout === null) {
      this.process = null;  // Clean up partial state
      return Promise.reject(new Error('Python bridge process stdout is null'));
    }
    const rl = createInterface({ input: this.process.stdout });
    rl.on('line', (line) => {
      // Filter out non-JSON lines (crawl4ai verbose output)
      if (!line.trim().startsWith('{')) {
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const response = JSON.parse(line) as {
          id: string;
          error?: { message: string };
          result?: CrawlResult;
        };
        const pending = this.pending.get(response.id);
        if (pending !== undefined) {
          if (response.error !== undefined) {
            clearTimeout(pending.timeout);
            this.pending.delete(response.id);
            pending.reject(new Error(response.error.message));
          } else if (response.result !== undefined) {
            clearTimeout(pending.timeout);
            this.pending.delete(response.id);
            pending.resolve(response.result);
          }
          // If neither result nor error, leave pending (will timeout)
        }
      } catch (err) {
        console.error('Failed to parse JSON response from Python bridge:', err, 'Line:', line);
      }
    });

    return Promise.resolve();
  }

  async crawl(url: string, timeoutMs: number = 30000): Promise<CrawlResult> {
    if (!this.process) await this.start();

    const id = randomUUID();
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'crawl',
      params: { url },
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        const pending = this.pending.get(id);
        if (pending) {
          this.pending.delete(id);
          reject(new Error(`Crawl timeout after ${String(timeoutMs)}ms for URL: ${url}`));
        }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      if (this.process === null || this.process.stdin === null) {
        reject(new Error('Python bridge process not available'));
        return;
      }
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  stop(): Promise<void> {
    if (this.process) {
      this.rejectAllPending(new Error('Python bridge stopped'));
      this.process.kill();
      this.process = null;
    }
    return Promise.resolve();
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
