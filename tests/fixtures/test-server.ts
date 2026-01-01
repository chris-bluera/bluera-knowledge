import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';

/**
 * Local HTTP server for testing crawl functionality.
 * Serves static HTML pages for deterministic, fast testing without network dependencies.
 */
export class TestHTMLServer {
  private server: Server | null = null;
  private port = 0;

  /**
   * Start the HTTP server on a random available port.
   * @returns Promise resolving to the base URL (e.g., "http://localhost:3000")
   */
  async start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(0, () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          resolve(`http://localhost:${String(this.port)}`);
        } else {
          throw new Error('Failed to get server port');
        }
      });
    });
  }

  /**
   * Stop the HTTP server.
   */
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => {
          resolve();
        });
      });
      this.server = null;
      this.port = 0;
    }
  }

  /**
   * Get the current server URL.
   * @returns The base URL or null if server is not running
   */
  getUrl(): string | null {
    if (this.port === 0) return null;
    return `http://localhost:${String(this.port)}`;
  }

  /**
   * Handle incoming HTTP requests and serve appropriate test content.
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? '/';

    // Home page with multiple links
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Home Page</title>
          </head>
          <body>
            <h1>Test Home Page</h1>
            <p>This is a test server for crawler integration tests.</p>
            <nav>
              <a href="/page1">Page 1</a>
              <a href="/page2">Page 2</a>
              <a href="/about">About</a>
            </nav>
          </body>
        </html>
      `);
      return;
    }

    // Sub-page 1
    if (url === '/page1') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Page 1</title>
          </head>
          <body>
            <h1>Page 1</h1>
            <p>This is page 1.</p>
            <a href="/">Home</a>
            <a href="/page2">Page 2</a>
          </body>
        </html>
      `);
      return;
    }

    // Sub-page 2
    if (url === '/page2') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Page 2</title>
          </head>
          <body>
            <h1>Page 2</h1>
            <p>This is page 2.</p>
            <a href="/">Home</a>
            <a href="/page1">Page 1</a>
          </body>
        </html>
      `);
      return;
    }

    // About page
    if (url === '/about') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>About</title>
          </head>
          <body>
            <h1>About</h1>
            <p>This is the about page.</p>
            <a href="/">Home</a>
          </body>
        </html>
      `);
      return;
    }

    // JavaScript-rendered content (for headless testing)
    if (url === '/js-rendered') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>JS Rendered</title>
          </head>
          <body>
            <div id="content">Loading...</div>
            <script>
              // Simulate JavaScript rendering
              document.getElementById('content').textContent = 'Content Rendered by JavaScript';

              // Add dynamic links
              const nav = document.createElement('nav');
              nav.innerHTML = '<a href="/">Home</a> <a href="/dynamic">Dynamic</a>';
              document.body.appendChild(nav);
            </script>
          </body>
        </html>
      `);
      return;
    }

    // Page with many links (for testing link extraction)
    if (url === '/many-links') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const links = Array.from({ length: 20 }, (_, i) =>
        `<a href="/link${String(i)}">Link ${String(i)}</a>`
      ).join('\n');
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Many Links</title>
          </head>
          <body>
            <h1>Page with Many Links</h1>
            ${links}
          </body>
        </html>
      `);
      return;
    }

    // Page with no links (leaf node)
    if (url === '/leaf') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Leaf Page</title>
          </head>
          <body>
            <h1>Leaf Page</h1>
            <p>This page has no links.</p>
          </body>
        </html>
      `);
      return;
    }

    // Page with external links (for domain filtering tests)
    if (url === '/external-links') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>External Links</title>
          </head>
          <body>
            <h1>Mixed Links</h1>
            <a href="/">Internal Home</a>
            <a href="/page1">Internal Page 1</a>
            <a href="https://example.com">External Example</a>
            <a href="https://google.com">External Google</a>
          </body>
        </html>
      `);
      return;
    }

    // Page with special characters
    if (url === '/special-chars') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Special Characters &amp; Symbols</title>
            <meta charset="utf-8">
          </head>
          <body>
            <h1>Special &amp; Characters &lt;&gt;</h1>
            <p>Testing: "quotes", 'apostrophes', &amp; ampersands</p>
            <p>Unicode: © ™ € £ ¥</p>
          </body>
        </html>
      `);
      return;
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>404 Not Found</title>
        </head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p>The requested URL ${url} was not found on this server.</p>
          <a href="/">Go Home</a>
        </body>
      </html>
    `);
  }
}
