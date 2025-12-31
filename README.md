# Bluera Knowledge

A Claude Code plugin for providing canonical, definitive source information to AI coding agents.

## Overview

Bluera Knowledge creates local, searchable knowledge stores from any authoritative source - library source code, project documentation, coding standards, reference materials, or any other content you need.

Instead of relying on:
- **Outdated training data** - Claude's knowledge cutoff may be months or years old
- **Web search** - Slow, rate-limited, and incomplete
- **Web fetch** - Slow, rate-limited, and often blocked or paywalled

This plugin provides:
- **Instant local access** - All content indexed and ready
- **Complete source code** - Full repository clones, not just documentation
- **Web crawling** - Crawl and index web documentation automatically
- **Fast vector search** - Semantic search with relevance ranking
- **Direct file access** - Grep/Glob operations on complete source trees

### How It Works

The plugin provides AI agents with three complementary search capabilities:

**1. Semantic Vector Search** - AI-powered search across all indexed content:
- Searches by meaning and intent, not just keywords
- Uses embeddings to find conceptually similar content
- Ideal for discovering patterns and related concepts

**2. Full-Text Search (FTS)** - Fast keyword and pattern matching:
- Traditional text search with exact matching
- Supports regex patterns and boolean operators
- Best for finding specific terms or identifiers

**3. Hybrid Mode (Recommended)** - Combines vector and FTS search:
- Merges results from both search modes with weighted ranking
- Balances semantic understanding with exact matching
- Provides best overall results for most queries

**4. Direct File Access** - Traditional file operations on cloned sources:
- Provides file paths to cloned repositories
- Enables Grep, Glob, and Read operations on source files
- Supports precise pattern matching and code navigation
- Full access to complete file trees

---

**User Commands** - You manage knowledge stores through `/bluera-knowledge:` commands:
- Analyze your project to find important dependencies
- Add Git repositories (library source code)
- Add local folders (documentation, standards, etc.)
- Crawl web pages and documentation
- Search across all indexed content
- Manage and re-index stores

**MCP Tools** - AI agents access knowledge through Model Context Protocol:
- `search` - Semantic vector search across all stores
- `get_store_info` - Get file paths for direct Grep/Glob access
- `list_stores` - View available knowledge stores
- `create_store` - Add new knowledge sources
- `index_store` - Re-index existing stores
- `get_full_context` - Retrieve complete code context

## Features

- **Smart Dependency Analysis**: Automatically scans your project to identify which libraries are most heavily used by counting import statements across all source files
- **Usage-Based Suggestions**: Ranks dependencies by actual usage frequency, showing you the top 5 most-imported packages with import counts and file counts
- **Automatic Repository Discovery**: Queries NPM and PyPI package registries to automatically find GitHub repository URLs for any package
- **Git Repository Indexing**: Clones and indexes library source code for both semantic search and direct file access
- **Local Folder Indexing**: Indexes any local content - documentation, standards, reference materials, or custom content
- **Web Crawling**: Crawl and index web pages using `crawl4ai` - convert documentation sites to searchable markdown
- **Dual Search Modes**:
  - **Vector Search**: AI-powered semantic search with relevance ranking
  - **File Access**: Direct Grep/Glob operations on cloned source files
- **Multi-Language Support**: Analyzes JavaScript, TypeScript, and Python imports; indexes code in any language
- **MCP Integration**: Exposes all functionality as Model Context Protocol tools for AI coding agents

## Installation

Install the plugin directly from GitHub in Claude Code:

```
/plugin install https://github.com/bluera/bluera-knowledge
```

The plugin is immediately available with the `/bluera-knowledge:` command prefix.

### Dependencies

The plugin automatically checks for and attempts to install Python dependencies on first use:

**Required:**
- **Python 3.8+** - Required for all functionality
- **crawl4ai** - Required for web crawling features (auto-installed via SessionStart hook)

If auto-installation fails, you can install manually:
```bash
pip install crawl4ai
```

**Note:** The plugin will work without crawl4ai, but web crawling features (`/bluera-knowledge:crawl`) will be unavailable.

### Update Plugin

```
/plugin update bluera-knowledge
```

## Quick Start

```bash
# 1. Analyze your project to find important dependencies
/bluera-knowledge:suggest

# 2. Add suggested libraries
/bluera-knowledge:add-repo https://github.com/tanstack/query --name=tanstack-query

# 3. Add your project documentation
/bluera-knowledge:add-folder ./docs --name=project-docs

# 4. Search your knowledge stores
/bluera-knowledge:search "how to invalidate queries"

# 5. View all stores
/bluera-knowledge:stores
```

## Commands

### `/bluera-knowledge:suggest`

Analyze your project to suggest libraries worth indexing as knowledge stores:

```bash
/bluera-knowledge:suggest
```

Scans all source files, counts import statements, and suggests the top 5 most-used dependencies as indexing targets with their GitHub URLs.

**Example output:**
```
Top dependencies by usage in this project:

1. react
   156 imports across 87 files

2. vitest
   40 imports across 40 files

✔ react: https://github.com/facebook/react
  /bluera-knowledge:add-repo https://github.com/facebook/react --name=react
```

### `/bluera-knowledge:add-repo`

Clone and index a Git repository:

```bash
/bluera-knowledge:add-repo <url> [--name=<name>] [--branch=<branch>]
```

**Examples:**
```bash
/bluera-knowledge:add-repo https://github.com/tanstack/query --name=tanstack-query
/bluera-knowledge:add-repo https://github.com/facebook/react --branch=main --name=react
```

### `/bluera-knowledge:add-folder`

Index a local folder:

```bash
/bluera-knowledge:add-folder <path> --name=<name>
```

**Use cases:**
- Project documentation
- Coding standards
- Design documents
- API specifications
- Reference materials
- Any other content

**Examples:**
```bash
/bluera-knowledge:add-folder ./docs --name=project-docs
/bluera-knowledge:add-folder ./architecture --name=design-docs
```

### `/bluera-knowledge:search`

Search across indexed knowledge stores:

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
/bluera-knowledge:search "authentication" --stores=react,tanstack-query

# Limit results
/bluera-knowledge:search "testing patterns" --limit=5
```

### `/bluera-knowledge:stores`

List all indexed knowledge stores:

```bash
/bluera-knowledge:stores
```

Shows store name, type, source location, size, and last indexed date.

### `/bluera-knowledge:index`

Re-index an existing store:

```bash
/bluera-knowledge:index <store-name>
```

**Example:**
```bash
cd .bluera/bluera-knowledge/data/repos/react
git pull
/bluera-knowledge:index react
```

### `/bluera-knowledge:crawl`

Crawl web pages and add content to a web store:

```bash
/bluera-knowledge:crawl <url> <store-name>
```

**Requirements:**
- Python 3 with `crawl4ai` package installed
- A web store must be created first

**Examples:**
```bash
# Create a web store (via MCP)
# Then crawl pages into it
/bluera-knowledge:crawl https://docs.example.com/guide my-docs-store
```

The web page will be crawled, converted to markdown, and indexed for semantic search.

## Use Cases

### Library Source Code

Provide AI agents with canonical library implementation details:

```bash
/bluera-knowledge:suggest
/bluera-knowledge:add-repo https://github.com/tanstack/query --name=tanstack-query

# AI agents can now:
# - Semantic search: "query invalidation implementation"
# - Direct access: Grep/Glob through the cloned tanstack/query repo
```

### Project Documentation

Make project-specific documentation available:

```bash
/bluera-knowledge:add-folder ./docs --name=project-docs
/bluera-knowledge:add-folder ./architecture --name=architecture

# AI agents can search across all documentation or access specific files
```

### Coding Standards

Provide definitive coding standards and best practices:

```bash
/bluera-knowledge:add-folder ./company-standards --name=standards
/bluera-knowledge:add-folder ./api-specs --name=api-docs

# AI agents reference actual company standards, not generic advice
```

### Mixed Sources

Combine canonical library code with project-specific patterns:

```bash
/bluera-knowledge:add-repo https://github.com/facebook/react --name=react
/bluera-knowledge:add-folder ./docs/react-patterns --name=react-patterns

# Search across both library source and team patterns
```

## MCP Integration

The plugin includes a Model Context Protocol server that exposes search tools. This is configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "bluera-knowledge": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js"],
      "env": {
        "DATA_DIR": "${PWD}/.bluera/bluera-knowledge"
      }
    }
  }
}
```

### Available MCP Tools

#### `search`
Semantic vector search across all indexed stores. Returns structured code units with relevance ranking.

**Parameters:**
- `query` - Search query (natural language, patterns, or type signatures)
- `intent` - Search intent: find-pattern, find-implementation, find-usage, find-definition, find-documentation
- `detail` - Context level: minimal, contextual, or full
- `limit` - Maximum results (default: 10)
- `stores` - Array of specific store IDs to search (optional, searches all stores if not specified)

#### `get_store_info`
Get detailed information about a store including its file path for direct Grep/Glob access.

**Returns:**
- Store metadata
- File path to cloned repository or indexed folder
- Enables direct file operations on source

#### `list_stores`
List all indexed knowledge stores.

**Parameters:**
- `type` - Filter by type: file, repo, or web (optional)

#### `create_store`
Create a new knowledge store from Git URL or local path.

#### `index_store`
Index or re-index a knowledge store to make it searchable.

#### `get_full_context`
Retrieve complete code and context for a specific search result.

## Data Storage

Knowledge stores are stored in your project root:

```
<project-root>/.bluera/bluera-knowledge/
├── data/
│   ├── repos/<store-id>/       # Cloned Git repositories
│   ├── documents_*.lance/      # Vector indices (Lance DB)
│   └── stores.json             # Store registry
└── config.json                 # Configuration
```

**Important**: Add `.bluera/` to your `.gitignore` to avoid committing large repositories and vector indices to version control.

## Development

### Setup

```bash
git clone https://github.com/bluera/bluera-knowledge.git
cd bluera-knowledge
npm install
npm run build
npm test
```

### Testing Locally

```bash
/plugin install /path/to/bluera-knowledge
```

### Project Structure

```
.claude-plugin/          # Plugin configuration
├── plugin.json
├── marketplace.json
└── commands/

.mcp.json               # MCP server configuration

src/
├── analysis/           # Dependency analysis & URL resolution
├── services/           # Index, store, and search services
├── plugin/             # Plugin commands
├── mcp/                # MCP server
└── cli/                # CLI entry point
```

## Technologies

- **Claude Code Plugin System** with MCP server
- **AST Parsing**: @babel/parser, @babel/traverse
- **Semantic Search**: AI-powered vector embeddings
- **Git Operations**: Native git clone
- **CLI**: Commander.js

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests
4. Submit a pull request

## License

MIT

## Support

- **Issues**: [GitHub Issues](https://github.com/bluera/bluera-knowledge/issues)
- **Documentation**: [Claude Code Plugins](https://code.claude.com/docs/en/plugins)

## Version History

### v0.2.0 (Current)
- Smart usage-based dependency suggestions
- Automatic repository URL resolution via package registries
- Improved analysis performance
- Fixed command prefix inconsistencies

### v0.1.x
- Initial release
- Repository cloning and indexing
- Local folder indexing
- Semantic search
- MCP server integration
