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
