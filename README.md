# 🧠 Bluera Knowledge

[![CI](https://github.com/blueraai/bluera-knowledge/actions/workflows/ci.yml/badge.svg)](https://github.com/blueraai/bluera-knowledge/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-0.9.11-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Python](https://img.shields.io/badge/python-%3E%3D3.8-blue)

> 🚀 **Build a local knowledge base for your AI coding agent—library source code, crawled docs, and your own files, all instantly searchable.**

When Claude helps you code, it needs context: how does this library work? What does that API do? Instead of slow web searches or outdated training data, Bluera Knowledge gives your agent instant local access to:

- **Library source code** — Clone and search the repos of dependencies you actually use
- **Documentation** — Crawl, index, and search any docs site
- **Your files** — Index and search local folders for project-specific knowledge

All searchable in milliseconds, no rate limits, fully offline.

## 📑 Table of Contents

- [Installation](#-installation)
- [Why Clone Your Dependencies?](#-why-clone-your-dependencies)
- [Quick Start](#-quick-start)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [User Interface](#-user-interface)
- [Background Jobs](#-background-jobs)
- [Commands](#-commands)
- [Crawler Architecture](#-crawler-architecture)
- [Use Cases](#-use-cases)
- [Dependencies](#-dependencies)
- [Troubleshooting](#-troubleshooting)
- [MCP Integration](#-mcp-integration)
- [Data Storage](#-data-storage)
- [Development](#-development)
- [Technologies](#-technologies)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📦 Installation

```bash
# Add the Bluera marketplace (one-time setup)
/plugin marketplace add blueraai/bluera-marketplace

# Install the plugin (or use /plugin to browse the UI)
/plugin install bluera-knowledge@bluera
```

> [!NOTE]
> **First launch may appear to hang** while the plugin installs Python dependencies (crawl4ai). This is normal—subsequent launches are instant.

---

## ✨ Why Clone Your Dependencies?

When you ask Claude "how do I handle errors in Express middleware?", it can:

1. **Guess from training data** — might be outdated or wrong
2. **Search the web** — slow, rate-limited, often returns blog posts instead of source
3. **Read the actual Express source code** — authoritative, complete, instant ✅

Bluera Knowledge enables option 3. By cloning the repositories of libraries you actually use, your AI agent has:

| Capability | Without | With Bluera Knowledge |
|------------|---------|----------------------|
| Response time | 2-5 seconds (web) | ~100ms (local) |
| Accuracy | Uncertain | Authoritative (source code) |
| Completeness | Partial docs | Full implementation + tests |
| Rate limits | Yes | None |

**Plus:** Crawl any documentation site and index your own project files for a complete local knowledge base.

---

## 🚀 Quick Start

Follow these steps to set up knowledge stores for your project:

- [ ] **📦 Add a library**: `/bluera-knowledge:add-repo https://github.com/lodash/lodash`
- [ ] **📁 Index your docs**: `/bluera-knowledge:add-folder ./docs --name=project-docs`
- [ ] **🔍 Test search**: `/bluera-knowledge:search "deep clone object"`
- [ ] **📋 View stores**: `/bluera-knowledge:stores`

> [!TIP]
> Not sure which libraries to index? Use `/bluera-knowledge:suggest` to analyze your project's dependencies.

---

## ✨ Features

### 🎯 Core Features

- **🔬 Smart Dependency Analysis** - Automatically scans your project to identify which libraries are most heavily used by counting import statements across all source files
- **📊 Usage-Based Suggestions** - Ranks dependencies by actual usage frequency, showing you the top 5 most-imported packages with import counts and file counts
- **🔍 Automatic Repository Discovery** - Queries package registries (NPM, PyPI, crates.io, Go modules) to automatically find GitHub repository URLs
- **📦 Git Repository Indexing** - Clones and indexes library source code for both semantic search and direct file access
- **📁 Local Folder Indexing** - Indexes any local content - documentation, standards, reference materials, or custom content
- **🌐 Web Crawling** - Crawl and index web pages using `crawl4ai` - convert documentation sites to searchable markdown

### 🔍 Search Modes

- **🧠 Vector Search** - AI-powered semantic search with relevance ranking
- **📂 File Access** - Direct Grep/Glob operations on cloned source files

### 🗺️ Code Graph Analysis

- **📊 Code Graph Analysis** - During indexing, builds a graph of code relationships (calls, imports, extends) to provide usage context in search results - shows how many callers/callees each function has
- **🌐 Multi-Language Support** - Full AST parsing for JavaScript, TypeScript, Python, Rust, and Go; indexes code in any language
- **🔌 MCP Integration** - Exposes all functionality as Model Context Protocol tools for AI coding agents

### 🌍 Language-Specific Features

While bluera-knowledge indexes and searches code in any language, certain advanced features are language-specific:

| Language | Code Graph | Call Analysis | Import Tracking | Method Tracking |
|----------|------------|---------------|-----------------|-----------------|
| **TypeScript/JavaScript** | ✅ Full Support | ✅ Functions & Methods | ✅ Full | ✅ Class Methods |
| **Python** | ✅ Full Support | ✅ Functions & Methods | ✅ Full | ✅ Class Methods |
| **Rust** | ✅ Full Support | ✅ Functions & Methods | ✅ Full | ✅ Struct/Trait Methods |
| **Go** | ✅ Full Support | ✅ Functions & Methods | ✅ Full | ✅ Struct/Interface Methods |
| **Other Languages** | ⚠️ Basic Support | ❌ | ❌ | ❌ |

> [!NOTE]
> Code graph features enhance search results by showing usage context (e.g., "this function is called by 15 other functions"), but all languages benefit from vector search and full-text search capabilities.

---

## 🎯 How It Works

The plugin provides AI agents with **four complementary search capabilities**:

### 🔍 1. Semantic Vector Search
**AI-powered search across all indexed content**

- Searches by meaning and intent, not just keywords
- Uses embeddings to find conceptually similar content
- Ideal for discovering patterns and related concepts

### 📝 2. Full-Text Search (FTS)
**Fast keyword and pattern matching**

- Traditional text search with exact matching
- Supports regex patterns and boolean operators
- Best for finding specific terms or identifiers

### ⚡ 3. Hybrid Mode (Recommended)
**Combines vector and FTS search**

- Merges results from both search modes with weighted ranking
- Balances semantic understanding with exact matching
- Provides best overall results for most queries

### 📂 4. Direct File Access
**Traditional file operations on cloned sources**

- Provides file paths to cloned repositories
- Enables Grep, Glob, and Read operations on source files
- Supports precise pattern matching and code navigation
- Full access to complete file trees

<details>
<summary>💡 <b>How Commands Work</b></summary>

When you use `/bluera-knowledge:` commands, here's what happens:

1. **You issue a command** - Type `/bluera-knowledge:stores` or similar in Claude Code
2. **Claude receives instructions** - The command provides step-by-step instructions for Claude
3. **Claude executes MCP tools** - Behind the scenes, Claude uses `mcp__bluera-knowledge__*` tools
4. **Results are formatted** - Claude formats and displays the output directly to you

**Example Flow:**
```
You: /bluera-knowledge:stores
  ↓
Command file instructs Claude to use list_stores tool
  ↓
MCP tool queries LanceDB for store metadata
  ↓
Claude formats results as a table
  ↓
You see: Beautiful table of all your knowledge stores
```

This architecture means commands provide a clean user interface while MCP tools handle the backend operations.
</details>

---

## 🎨 User Interface

### 👤 User Commands
**You manage knowledge stores through `/bluera-knowledge:` commands:**

- 🔬 Analyze your project to find important dependencies
- 📦 Add Git repositories (library source code)
- 📁 Add local folders (documentation, standards, etc.)
- 🌐 Crawl web pages and documentation
- 🔍 Search across all indexed content
- 🔄 Manage and re-index stores

### 🤖 MCP Tools
**AI agents access knowledge through Model Context Protocol:**

| Tool | Purpose |
|------|---------|
| `search` | 🔍 Semantic vector search across all stores |
| `get_store_info` | 📂 Get file paths for direct Grep/Glob access |
| `list_stores` | 📋 View available knowledge stores |
| `create_store` | ➕ Add new knowledge sources |
| `index_store` | 🔄 Re-index existing stores |
| `delete_store` | 🗑️ Delete a store and all associated data |
| `get_full_context` | 📖 Retrieve complete code context |
| `check_job_status` | ⏱️ Check background vector indexing job progress |
| `list_jobs` | 📊 List all background vector indexing jobs |
| `cancel_job` | ⛔ Cancel running operations |

---

## ⚙️ Background Jobs

> [!TIP]
> Long-running operations (git clone, indexing) run in the background, allowing you to continue working while they complete.

### 🔄 How It Works

When you add a repository or index content:

1. **⚡ Instant Response** - Operation starts immediately and returns a job ID
2. **🔄 Background Processing** - Indexing runs in a separate process
3. **📊 Progress Updates** - Check status anytime with `/bluera-knowledge:check-status`
4. **🔔 Auto-Notifications** - Active jobs appear automatically in context

### 📝 Example Workflow

```bash
# Add a large repository (returns immediately with job ID)
/bluera-knowledge:add-repo https://github.com/facebook/react

# Output:
# ✓ Created store: react (a1b2c3d4...)
# 🔄 Indexing started in background
#    Job ID: job_abc123def456
#
# Check status with: /bluera-knowledge:check-status job_abc123def456

# Check progress anytime
/bluera-knowledge:check-status job_abc123def456

# Output:
# Job Status: job_abc123def456
# Status:   running
# Progress: ███████████░░░░░░░░░ 45%
# Message:  Indexed 562/1,247 files

# View all active jobs
/bluera-knowledge:check-status

# Cancel if needed
/bluera-knowledge:cancel job_abc123def456
```

### 🚀 Performance

Background jobs include significant performance optimizations:

- **⚡ Parallel Embedding** - Processes 32 chunks simultaneously (~30x faster than sequential)
- **🔓 Non-Blocking** - Continue working while indexing completes
- **📊 Progress Tracking** - Real-time updates on files processed and progress percentage
- **🧹 Auto-Cleanup** - Completed jobs are cleaned up after 24 hours

---

## 📖 Quick Reference

| Command | Purpose | Arguments |
|---------|---------|-----------|
| 🔬 `/bluera-knowledge:suggest` | Analyze project dependencies | None |
| 📦 `/bluera-knowledge:add-repo` | Clone and index Git repository | `<url> [--name=<name>] [--branch=<branch>]` |
| 📁 `/bluera-knowledge:add-folder` | Index local folder | `<path> --name=<name>` |
| 🔍 `/bluera-knowledge:search` | Search knowledge stores | `"<query>" [--stores=<names>] [--limit=<N>]` |
| 📋 `/bluera-knowledge:stores` | List all stores | None |
| 🔄 `/bluera-knowledge:index` | Re-index a store | `<store-name-or-id>` |
| 🗑️ `/bluera-knowledge:remove-store` | Delete a store and all data | `<store-name-or-id>` |
| 🌐 `/bluera-knowledge:crawl` | Crawl web pages | `<url> <store-name> [--crawl "<instruction>"]` |

---

## 💻 Commands

### 🔬 `/bluera-knowledge:suggest`

**Analyze your project to suggest libraries worth indexing as knowledge stores**

```bash
/bluera-knowledge:suggest
```

Scans source files, counts import statements, and suggests the top 5 most-used dependencies with their repository URLs.

**Supported languages:**
| Language | Manifest File | Registry |
|----------|---------------|----------|
| JavaScript/TypeScript | `package.json` | NPM |
| Python | `requirements.txt`, `pyproject.toml` | PyPI |
| Rust | `Cargo.toml` | crates.io |
| Go | `go.mod` | Go modules |

<details>
<summary><b>📊 Expected Output</b></summary>

```
## Dependency Analysis

Scanned 342 source files and found 24 dependencies.

### Top Dependencies by Usage

1. **react** (156 imports across 87 files)
   Repository: https://github.com/facebook/react

   Add with:
   ```
   /bluera-knowledge:add-repo https://github.com/facebook/react --name=react
   ```

2. **vitest** (40 imports across 40 files)
   Repository: https://github.com/vitest-dev/vitest

   Add with:
   ```
   /bluera-knowledge:add-repo https://github.com/vitest-dev/vitest --name=vitest
   ```

3. **lodash** (28 imports across 15 files)
   Repository: https://github.com/lodash/lodash

   Add with:
   ```
   /bluera-knowledge:add-repo https://github.com/lodash/lodash --name=lodash
   ```

---

Already indexed: typescript, express
```
</details>

---

### 📦 `/bluera-knowledge:add-repo`

**Clone and index a Git repository**

```bash
/bluera-knowledge:add-repo <url> [--name=<name>] [--branch=<branch>]
```

**Examples:**
```bash
/bluera-knowledge:add-repo https://github.com/lodash/lodash
/bluera-knowledge:add-repo https://github.com/facebook/react --branch=main --name=react
```

<details>
<summary><b>✅ Expected Output</b></summary>

```
✓ Cloning https://github.com/facebook/react...
✓ Created store: react (a1b2c3d4...)
  Location: ~/.local/share/bluera-knowledge/stores/a1b2c3d4.../

✓ Indexing...
✓ Indexed 1,247 files

Store is ready for searching!
```
</details>

---

### 📁 `/bluera-knowledge:add-folder`

**Index a local folder**

```bash
/bluera-knowledge:add-folder <path> --name=<name>
```

**📚 Use cases:**
- 📖 Project documentation
- 📏 Coding standards
- 🎨 Design documents
- 🔌 API specifications
- 📚 Reference materials
- 📄 Any other content

**Examples:**
```bash
/bluera-knowledge:add-folder ./docs --name=project-docs
/bluera-knowledge:add-folder ./architecture --name=design-docs
```

<details>
<summary><b>✅ Expected Output</b></summary>

```
✓ Adding folder: ~/my-project/docs...
✓ Created store: project-docs (e5f6g7h8...)
  Location: ~/.local/share/bluera-knowledge/stores/e5f6g7h8.../

✓ Indexing...
✓ Indexed 342 files

Store is ready for searching!
```
</details>

---

### 🔍 `/bluera-knowledge:search`

**Search across indexed knowledge stores**

```bash
/bluera-knowledge:search "<query>" [--stores=<names>] [--limit=<number>]
```

**Examples:**
```bash
# Search all stores
/bluera-knowledge:search "how to invalidate queries"

# Search specific store
/bluera-knowledge:search "useState implementation" --stores=react

# Search multiple stores (comma-separated)
/bluera-knowledge:search "deep clone" --stores=react,lodash

# Limit results
/bluera-knowledge:search "testing patterns" --limit=5
```

<details>
<summary><b>📊 Expected Output</b></summary>

```
## Search Results for "button component"

| Score | Store        | File                                          | Purpose                                            |
|------:|--------------|-----------------------------------------------|---------------------------------------------------|
|  0.95 | react        | src/components/Button.tsx                     | Reusable button component with variants           |
|  0.87 | react        | src/hooks/useButton.ts                        | Custom hook for button state management           |
|  0.81 | react        | src/components/IconButton.tsx                 | Button component with icon support                |

**Found**: 3 results
```
</details>

---

### 📋 `/bluera-knowledge:stores`

**List all indexed knowledge stores**

```bash
/bluera-knowledge:stores
```

Shows store name, type, ID, and source location in a clean table format.

<details>
<summary><b>📊 Expected Output</b></summary>

```
| Name | Type | ID | Source |
|------|------|----|--------------------|
| react | repo | 459747c7 | https://github.com/facebook/react |
| crawl4ai | repo | b5a72a94 | https://github.com/unclecode/crawl4ai.git |
| project-docs | file | 70f6309b | ~/repos/my-project/docs |
| claude-docs | web | 9cc62018 | https://code.claude.com/docs |

**Total**: 4 stores
```
</details>

---

### 🔄 `/bluera-knowledge:index`

**Re-index an existing store to update the search index**

```bash
/bluera-knowledge:index <store-name-or-id>
```

**🔄 When to re-index:**
- The source repository has been updated (for repo stores)
- Files have been added or modified (for file stores)
- Search results seem out of date

**Example:**
```bash
/bluera-knowledge:index react
```

<details>
<summary><b>✅ Expected Output</b></summary>

```
✓ Indexing store: react...
✓ Indexed 1,247 documents in 3,421ms

Store search index is up to date!
```
</details>

---

### 🗑️ `/bluera-knowledge:remove-store`

**Delete a knowledge store and all associated data**

```bash
/bluera-knowledge:remove-store <store-name-or-id>
```

**🗑️ What gets deleted:**
- Store registry entry
- LanceDB search index (vector embeddings)
- Cloned repository files (for repo stores created from URLs)

**Example:**
```bash
/bluera-knowledge:remove-store react
```

<details>
<summary><b>✅ Expected Output</b></summary>

```
Store "react" deleted successfully.

Removed:
- Store registry entry
- LanceDB search index
- Cloned repository files
```
</details>

---

### 🌐 `/bluera-knowledge:crawl`

**Crawl web pages with natural language control**

```bash
/bluera-knowledge:crawl <url> <store-name> [options]
```

**Options:**
- `--crawl "<instruction>"` - Natural language instruction for which pages to crawl
- `--extract "<instruction>"` - Natural language instruction for what content to extract
- `--simple` - Use simple BFS mode instead of intelligent crawling
- `--max-pages <n>` - Maximum pages to crawl (default: 50)
- `--headless` - Use headless browser for JavaScript-rendered sites (Next.js, React, Vue)

**⚙️ Requirements:**
- 🐍 Python 3 with `crawl4ai` package installed
- 📦 A web store must be created first

**Examples:**
```bash
# Basic crawl
/bluera-knowledge:crawl https://docs.example.com/guide my-docs

# Intelligent crawl with custom strategy
/bluera-knowledge:crawl https://react.dev react-docs --crawl "all API reference pages"

# Extract specific content from pages
/bluera-knowledge:crawl https://example.com/pricing pricing --extract "pricing tiers and features"

# Combine crawl strategy + extraction
/bluera-knowledge:crawl https://docs.python.org python-docs \
  --crawl "standard library modules" \
  --extract "function signatures and examples"

# JavaScript-rendered sites (Next.js, React, etc.)
/bluera-knowledge:crawl https://nextjs.org/docs nextjs-docs --headless --max-pages 30

# Simple BFS mode (no AI guidance)
/bluera-knowledge:crawl https://example.com/docs docs --simple --max-pages 100
```

The crawler converts pages to markdown and indexes them for semantic search.

---

## 🕷️ Crawler Architecture

The crawler supports two modes: **standard mode** for static sites (fast) and **headless mode** for JavaScript-rendered sites (powerful).

### ⚡ Standard Mode (Static Sites)

For static HTML sites, the crawler uses axios for fast HTTP requests:

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant IntelligentCrawler
    participant Axios
    participant Claude

    User->>CLI: crawl URL --crawl "instruction"
    CLI->>IntelligentCrawler: crawl(url, options)
    IntelligentCrawler->>Axios: fetchHtml(url)
    Axios-->>IntelligentCrawler: Static HTML
    IntelligentCrawler->>Claude: determineCrawlUrls(html, instruction)
    Claude-->>IntelligentCrawler: [urls to crawl]
    loop For each URL
        IntelligentCrawler->>Axios: fetchHtml(url)
        Axios-->>IntelligentCrawler: HTML
        IntelligentCrawler->>IntelligentCrawler: Convert to markdown & index
    end
```

### 🎭 Headless Mode (JavaScript-Rendered Sites)

For JavaScript-rendered sites (Next.js, React, Vue), use `--headless` to render content with Playwright:

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant IntelligentCrawler
    participant PythonBridge
    participant crawl4ai
    participant Playwright
    participant Claude

    User->>CLI: crawl URL --crawl "instruction" --headless
    CLI->>IntelligentCrawler: crawl(url, {useHeadless: true})
    IntelligentCrawler->>PythonBridge: fetchHeadless(url)
    PythonBridge->>crawl4ai: AsyncWebCrawler.arun(url)
    crawl4ai->>Playwright: Launch browser & render JS
    Playwright-->>crawl4ai: Rendered HTML
    crawl4ai-->>PythonBridge: {html, markdown, links}
    PythonBridge-->>IntelligentCrawler: Rendered HTML
    IntelligentCrawler->>Claude: determineCrawlUrls(html, instruction)
    Note over Claude: Natural language instruction<br/>STILL FULLY ACTIVE
    Claude-->>IntelligentCrawler: [urls to crawl]
    loop For each URL
        IntelligentCrawler->>PythonBridge: fetchHeadless(url)
        PythonBridge->>crawl4ai: Render JS
        crawl4ai-->>PythonBridge: HTML
        PythonBridge-->>IntelligentCrawler: HTML
        IntelligentCrawler->>IntelligentCrawler: Convert to markdown & index
    end
```

### 🔑 Key Points

- **🧠 Intelligent crawling preserved** - Claude CLI analyzes pages and selects URLs based on natural language instructions in both modes
- **🎭 crawl4ai role** - ONLY renders JavaScript to get HTML - doesn't replace Claude's intelligent URL selection
- **⚡ Hybrid approach** - Fast axios for static sites, Playwright for JS-rendered sites
- **🔄 Automatic fallback** - If headless fetch fails, automatically falls back to axios

---

## 🔧 Troubleshooting

<details>
<summary><b>❌ Command not found or not recognized</b></summary>

Ensure the plugin is installed and enabled:

```bash
/plugin list
/plugin enable bluera-knowledge
```

If the plugin isn't listed, install it:

```bash
/plugin marketplace add blueraai/bluera-marketplace
/plugin install bluera-knowledge@bluera
```
</details>

<details>
<summary><b>🌐 Web crawling fails</b></summary>

Check Python dependencies:

```bash
python3 --version  # Should be 3.8+
pip install crawl4ai
```

The plugin attempts to auto-install `crawl4ai` on first use, but manual installation may be needed in some environments.
</details>

<details>
<summary><b>🔍 Search returns no results</b></summary>

1. Verify store exists: `/bluera-knowledge:stores`
2. Check store is indexed: `/bluera-knowledge:index <store-name>`
3. Try broader search terms
4. Verify you're searching the correct store with `--stores=<name>`
</details>

<details>
<summary><b>❓ "Store not found" error</b></summary>

List all stores to see available names and IDs:

```bash
/bluera-knowledge:stores
```

Use the exact store name or ID shown in the table.
</details>

<details>
<summary><b>⏱️ Indexing is slow or fails</b></summary>

Large repositories (10,000+ files) take longer to index. If indexing fails:

1. Check available disk space
2. Ensure the source repository/folder is accessible
3. For repo stores, verify git is installed: `git --version`
4. Check for network connectivity (for repo stores)
</details>

---

## 🎯 Use Cases

### 📦 Library Source Code

Provide AI agents with canonical library implementation details:

```bash
/bluera-knowledge:suggest
/bluera-knowledge:add-repo https://github.com/expressjs/express

# AI agents can now:
# - Semantic search: "middleware error handling"
# - Direct access: Grep/Glob through the cloned express repo
```

### 📚 Project Documentation

Make project-specific documentation available:

```bash
/bluera-knowledge:add-folder ./docs --name=project-docs
/bluera-knowledge:add-folder ./architecture --name=architecture

# AI agents can search across all documentation or access specific files
```

### 📏 Coding Standards

Provide definitive coding standards and best practices:

```bash
/bluera-knowledge:add-folder ./company-standards --name=standards
/bluera-knowledge:add-folder ./api-specs --name=api-docs

# AI agents reference actual company standards, not generic advice
```

### 🔀 Mixed Sources

Combine canonical library code with project-specific patterns:

```bash
/bluera-knowledge:add-repo https://github.com/facebook/react --name=react
/bluera-knowledge:add-folder ./docs/react-patterns --name=react-patterns

# Search across both library source and team patterns
```

---

## 💭 What Claude Code Says About Bluera Knowledge

> ### *As an AI coding assistant, here's what I've discovered using this plugin*
>
> ---
>
> #### ⚡ The Immediate Impact
>
> **The difference is immediate.** When a user asks "how does React's useEffect cleanup work?", I can search the actual React source code indexed locally instead of relying on my training data or making web requests. The results include the real implementation, related functions, and usage patterns—all in ~100ms.
>
> **Code graph analysis changes the game.** The plugin doesn't just index files—it builds a relationship graph showing which functions call what, import dependencies, and class hierarchies. When I search for a function, I see how many places call it and what it calls. This context makes my suggestions dramatically more accurate.
>
> ---
>
> #### 🔀 Multi-Modal Search Power
>
> I can combine three search approaches in a single workflow:
>
> | Mode | Use Case | Example |
> |------|----------|---------|
> | 🧠 **Semantic** | Conceptual queries | "authentication flow with JWT validation" |
> | 📂 **Direct Access** | Pattern matching | Grep for specific identifiers in cloned repos |
> | 📝 **Full-Text** | Exact matches | Find precise function names or imports |
>
> This flexibility means I can start broad (semantic) and narrow down (exact file access) seamlessly.
>
> ---
>
> #### 🕷️ Intelligent Crawling
>
> **The `--crawl` instruction isn't marketing**—it actually uses Claude API to analyze each page and intelligently select which links to follow. I can tell it "crawl all API reference pages but skip blog posts" and it understands the intent.
>
> For JavaScript-rendered sites (Next.js, React docs), the `--headless` mode renders pages with Playwright while I still control the crawl strategy with natural language.
>
> ---
>
> #### ✨ What Makes It Valuable
>
> | Benefit | Impact |
> |---------|--------|
> | ✅ **No guessing** | I read actual source code, not blog interpretations |
> | 🔌 **Offline first** | Works without internet, zero rate limits |
> | 🎯 **Project-specific** | Index your team's standards, not generic advice |
> | ⚡ **Speed** | Sub-100ms searches vs 2-5 second web lookups |
> | 📚 **Completeness** | Tests, implementation details, edge cases—all indexed |
>
> ---
>
> #### 🌟 When It Shines Most
>
> 1. **Deep library questions** - "how does this internal method handle edge cases?"
> 2. **Version-specific answers** - your indexed version is what you're actually using
> 3. **Private codebases** - your docs, your standards, your patterns
> 4. **Complex workflows** - combining semantic search + direct file access + code graph
>
> ---
>
> The plugin essentially gives me a **photographic memory** of your dependencies and documentation.
>
> Instead of *"I think based on training data"*, I can say *"I searched the indexed React v18.2.0 source and found this in `ReactFiberWorkLoop.js:1247`"*.
>
> **That's the difference between helpful and authoritative.**

---

## 🔧 Dependencies

The plugin automatically checks for and attempts to install Python dependencies on first use:

**Required:**
- **🐍 Python 3.8+** - Required for all functionality
- **🕷️ crawl4ai** - Required for web crawling features (auto-installed via SessionStart hook)
- **🎭 playwright** - Required for headless browser crawling (manual install needed for browser binaries)

If auto-installation fails, you can install manually:

```bash
pip install crawl4ai playwright
playwright install  # Install browser binaries for headless mode
```

> [!WARNING]
> The plugin will work without crawl4ai/playwright, but web crawling features (`/bluera-knowledge:crawl`) will be unavailable. For JavaScript-rendered sites (Next.js, React, Vue), use the `--headless` flag which requires playwright browser binaries.

**Update Plugin:**
```bash
/plugin update bluera-knowledge
```

---

## 🔌 MCP Integration

The plugin includes a Model Context Protocol server that exposes search tools. This is configured in `.mcp.json`:

> [!IMPORTANT]
> **Commands vs MCP Tools**: You interact with the plugin using `/bluera-knowledge:` slash commands. Behind the scenes, these commands instruct Claude to use MCP tools (`mcp__bluera-knowledge__*`) which handle the actual operations. Commands provide the user interface, while MCP tools are the backend that AI agents use to access your knowledge stores.

```json
{
  "bluera-knowledge": {
    "command": "node",
    "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js"],
    "env": {
      "PWD": "${PWD}",
      "DATA_DIR": "${PWD}/.bluera/bluera-knowledge/data",
      "CONFIG_PATH": "${PWD}/.bluera/bluera-knowledge/config.json"
    }
  }
}
```

### 🛠️ Available MCP Tools

#### `search`
🔍 Semantic vector search across all indexed stores. Returns structured code units with relevance ranking.

**Parameters:**
- `query` - Search query (natural language, patterns, or type signatures)
- `intent` - Search intent: find-pattern, find-implementation, find-usage, find-definition, find-documentation
- `detail` - Context level: minimal, contextual, or full
- `limit` - Maximum results (default: 10)
- `stores` - Array of specific store IDs to search (optional, searches all stores if not specified)

#### `get_store_info`
📂 Get detailed information about a store including its file path for direct Grep/Glob access.

**Returns:**
- Store metadata
- File path to cloned repository or indexed folder
- Enables direct file operations on source

#### `list_stores`
📋 List all indexed knowledge stores.

**Parameters:**
- `type` - Filter by type: file, repo, or web (optional)

#### `create_store`
➕ Create a new knowledge store from Git URL or local path.

#### `index_store`
🔄 Index or re-index a knowledge store to make it searchable.

#### `get_full_context`
📖 Retrieve complete code and context for a specific search result.

---

## 💾 Data Storage

Knowledge stores are stored in your project root:

```
<project-root>/.bluera/bluera-knowledge/
├── data/
│   ├── repos/<store-id>/       # Cloned Git repositories
│   ├── documents_*.lance/      # Vector indices (Lance DB)
│   └── stores.json             # Store registry
└── config.json                 # Configuration
```

> [!CAUTION]
> **Important**: Add `.bluera/` to your `.gitignore` to avoid committing large repositories and vector indices to version control.

---

## 🛠️ Development

### 🚀 Setup

```bash
git clone https://github.com/blueraai/bluera-knowledge.git
cd bluera-knowledge
npm install
npm run build
npm test
```

### 🔌 MCP Server

**`.mcp.json`** (Plugin distribution)
- Located at plugin root (auto-discovered by Claude Code)
- Uses `${CLAUDE_PLUGIN_ROOT}` and points to compiled `dist/mcp/server.js`
- Committed to git and distributed with the plugin

**For local development/dogfooding:**

To enable live development without rebuilding, add a user-level MCP server config to `~/.claude.json`:

```json
{
  "mcpServers": {
    "bluera-knowledge-dev": {
      "command": "npx",
      "args": ["tsx", "/Users/yourname/repos/bluera-knowledge/src/mcp/server.ts"],
      "env": {
        "PWD": "${PWD}",
        "DATA_DIR": "${PWD}/.bluera/bluera-knowledge/data",
        "CONFIG_PATH": "${PWD}/.bluera/bluera-knowledge/config.json"
      }
    }
  }
}
```

Replace the path with your actual repo location. This creates a separate `bluera-knowledge-dev` MCP server that:
- Runs the source TypeScript directly via `tsx`
- Updates immediately when you modify MCP server code
- Doesn't interfere with the production plugin version

### 📜 NPM Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run build` | 🏗️ Compile TypeScript to dist/ | Before testing CLI, after code changes |
| `npm run dev` | 👀 Watch mode compilation | During active development |
| `npm start` | ▶️ Run the CLI | Execute CLI commands directly |
| `npm test` | 🧪 Run tests in watch mode | During TDD/active development |
| `npm run test:run` | ✅ Run tests once | Quick verification |
| `npm run test:coverage` | 📊 Run tests with coverage | Before committing, CI checks |
| `npm run lint` | 🔍 Run ESLint | Check code style issues |
| `npm run typecheck` | 🔒 Run TypeScript type checking | Verify type safety |
| `npm run precommit` | ✨ Full validation suite | Before committing (runs automatically via husky) |
| `npm run version:patch` | 🔢 Bump patch version (0.0.x) | Bug fixes, minor updates |
| `npm run version:minor` | 🔢 Bump minor version (0.x.0) | New features, backwards compatible |
| `npm run version:major` | 🔢 Bump major version (x.0.0) | Breaking changes |

### 🚀 Releasing

Use npm scripts to create releases:

```bash
# Bump version, commit, tag, and push (triggers GitHub Actions release)
npm run release:patch   # Bug fixes (0.0.x)
npm run release:minor   # New features (0.x.0)
npm run release:major   # Breaking changes (x.0.0)

# If version already bumped but not tagged
npm run release:current
```

**Workflow:**
1. Make changes and commit normally
2. When ready to release: `npm run release:patch` (or minor/major)
3. GitHub Actions creates the release **and automatically updates the marketplace**
4. Verify in Actions tab: CI passes → Release created → Marketplace updated

### 🧪 Testing Locally

```bash
/plugin marketplace add /path/to/bluera-knowledge
/plugin install bluera-knowledge@bluera-knowledge
```

### 📂 Project Structure

```
.claude-plugin/
└── plugin.json          # Plugin metadata

.mcp.json                # MCP server configuration (auto-discovered)
commands/                # Slash commands (auto-discovered)
skills/                  # Agent skills (auto-discovered)
dist/                    # Built MCP server (committed for distribution)

src/
├── analysis/            # Dependency analysis & URL resolution
├── crawl/               # Web crawling with Python bridge
├── services/            # Index, store, and search services
├── mcp/                 # MCP server source
└── cli/                 # CLI entry point

tests/
├── integration/         # Integration tests
└── fixtures/            # Test infrastructure
```

---

## 🔬 Technologies

- **🔌 Claude Code Plugin System** with MCP server
- **✅ Runtime Validation** - [Zod](https://github.com/colinhacks/zod) schemas for Python-TypeScript boundary
- **🌳 AST Parsing** - [@babel/parser](https://github.com/babel/babel) for JS/TS, Python AST module, [tree-sitter](https://github.com/tree-sitter/tree-sitter) for Rust and Go
- **🗺️ Code Graph** - Static analysis of function calls, imports, and class relationships
- **🧠 Semantic Search** - AI-powered vector embeddings with [LanceDB](https://github.com/lancedb/lancedb)
- **📦 Git Operations** - Native git clone
- **💻 CLI** - [Commander.js](https://github.com/tj/commander.js)
- **🕷️ Web Crawling** - [crawl4ai](https://github.com/unclecode/crawl4ai) with [Playwright](https://github.com/microsoft/playwright) (headless browser)

---

## 🤝 Contributing

Contributions welcome! Please:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch
3. ✅ Add tests
4. 📬 Submit a pull request

---

## 📄 License

MIT - See [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

This project includes software developed by third parties. See [NOTICE](./NOTICE) for full attribution.

Key dependencies:
- **[Crawl4AI](https://github.com/unclecode/crawl4ai)** - Web crawling (Apache-2.0). *This product includes software developed by UncleCode ([@unclecode](https://x.com/unclecode)) as part of the Crawl4AI project.*
- **[LanceDB](https://github.com/lancedb/lancedb)** - Vector database (Apache-2.0)
- **[Hugging Face Transformers](https://github.com/huggingface/transformers.js)** - Embeddings (Apache-2.0)
- **[Playwright](https://github.com/microsoft/playwright)** - Browser automation (Apache-2.0)

---

## 💬 Support

- **🐛 Issues**: [GitHub Issues](https://github.com/blueraai/bluera-knowledge/issues)
- **📚 Documentation**: [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- **📝 Changelog**: [CHANGELOG.md](./CHANGELOG.md)
