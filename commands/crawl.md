---
description: Crawl web pages and add content to a web store
argument-hint: "[url] [store-name]"
allowed-tools: [Bash(${CLAUDE_PLUGIN_ROOT}/dist/index.js:*)]
---

Crawling $ARGUMENTS

!`node ${CLAUDE_PLUGIN_ROOT}/dist/index.js crawl $ARGUMENTS`

The web page will be crawled, converted to markdown, and indexed for searching.
