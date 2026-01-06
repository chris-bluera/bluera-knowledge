---
description: Crawl web pages with natural language control and add to knowledge store
argument-hint: "[url] [store-name] [--crawl instruction] [--extract instruction]"
allowed-tools: [Bash(*)]
---

Crawling and indexing: $ARGUMENTS

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/index.js crawl $ARGUMENTS
```

The web pages will be crawled with intelligent link selection and optional natural language extraction, then indexed for searching.

**Note:** The web store is auto-created if it doesn't exist. No need to create the store first.

## Usage Examples

**Intelligent crawl strategy:**
```
/bluera-knowledge:crawl https://code.claude.com/docs/en/ claude-docs --crawl "all Getting Started pages"
```

**With extraction:**
```
/bluera-knowledge:crawl https://example.com/pricing pricing-store --extract "extract pricing and features"
```

**Both strategy and extraction:**
```
/bluera-knowledge:crawl https://docs.example.com my-docs --crawl "API reference pages" --extract "API endpoints and parameters"
```

**Simple BFS mode:**
```
/bluera-knowledge:crawl https://example.com/docs docs-store --simple
```

**Headless browser for JavaScript-rendered sites:**
```
/bluera-knowledge:crawl https://code.claude.com/docs claude-docs --headless --max-pages 20
```

## Options

- `--crawl <instruction>` - Natural language instruction for which pages to crawl (e.g., "all Getting Started pages")
- `--extract <instruction>` - Natural language instruction for what content to extract (e.g., "extract API references")
- `--simple` - Use simple BFS (breadth-first search) mode instead of intelligent crawling
- `--max-pages <number>` - Maximum number of pages to crawl (default: 50)
- `--headless` - Use headless browser (Playwright via crawl4ai) for JavaScript-rendered sites
  - Required for modern frameworks (Next.js, React, Vue, etc.) that render content via client-side JavaScript
  - Slower than default (axios) but handles client-side rendering
  - Falls back to axios if headless fetch fails
