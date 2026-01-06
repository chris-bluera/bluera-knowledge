# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.9.16](https://github.com/blueraai/bluera-knowledge/compare/v0.9.14...v0.9.16) (2026-01-06)


### Features

* **ci:** add workflow_dispatch to auto-release for manual triggering ([4835c9c](https://github.com/blueraai/bluera-knowledge/commit/4835c9c698766999154ff217475b3f38718289d6))
* **crawl:** add Claude CLI availability detection for npm package mode ([9afaae5](https://github.com/blueraai/bluera-knowledge/commit/9afaae5b4b4da98ce787d966c9910004401756dd))
* **release:** add automatic changelog generation with commit-and-tag-version ([177c6a3](https://github.com/blueraai/bluera-knowledge/commit/177c6a35f0a965b701940b2f8fc72fe2e4645647))
* rename to @blueraai/bluera-knowledge and add npm publishing ([51a86cb](https://github.com/blueraai/bluera-knowledge/commit/51a86cb574fb9752224e724c1047a5000f4e898b))
* **skills:** add hybrid MCP + Skills enhancement ([9fbee1d](https://github.com/blueraai/bluera-knowledge/commit/9fbee1d90d02663dbda9646e244423c7840330a6))


### Bug Fixes

* **ci:** add model warm-up step to prevent race conditions ([4f5cc6a](https://github.com/blueraai/bluera-knowledge/commit/4f5cc6a6a33f4ab28e8daa2ee6a02e1cc81bf59b))
* **ci:** correct model cache location and test timeouts ([8ae7d9d](https://github.com/blueraai/bluera-knowledge/commit/8ae7d9dcd38ac7ccea3a5bae83ef07449adb693f))
* **ci:** use bun in release workflow and add concurrency controls ([659c4f8](https://github.com/blueraai/bluera-knowledge/commit/659c4f83c7d4f093a5d626c9e460db92e82e3c9c))
* **ci:** use check-regexp in update-marketplace and improve tag extraction ([a009d5f](https://github.com/blueraai/bluera-knowledge/commit/a009d5f90c6f5ddd3244a9f15fa228630dbd509d))
* **ci:** use check-regexp to wait for CI jobs that exist immediately ([34a4be2](https://github.com/blueraai/bluera-knowledge/commit/34a4be2fa4a64221efc84b66b16491bb0624701f))
* **cli:** resolve hanging subprocess by adding destroyServices cleanup ([36acc15](https://github.com/blueraai/bluera-knowledge/commit/36acc1560ed6ea999781e63614de701c7277c8d5))
* **docs:** remove nested code blocks breaking GitHub rendering ([11aef7a](https://github.com/blueraai/bluera-knowledge/commit/11aef7a433623c8831e235714a7c1382b146504d))
* **hooks:** make npm precommit script use smart git hook ([4a9f6b0](https://github.com/blueraai/bluera-knowledge/commit/4a9f6b0bddfd3d1d310b8dba40093c36cc3fa163))
* **package:** correct npm org from [@blueraai](https://github.com/blueraai) to [@bluera](https://github.com/bluera) ([7366ebd](https://github.com/blueraai/bluera-knowledge/commit/7366ebd14a406c36a3675bb8d64d57bf3732b2f1))
* **security:** address vulnerabilities from security audit ([4de8b46](https://github.com/blueraai/bluera-knowledge/commit/4de8b461268484dadccee86da42f96c6917e262d))
* **test:** remove flaky performance assertions from stress tests ([69a480b](https://github.com/blueraai/bluera-knowledge/commit/69a480ba00b6e4b5aace4ea1b732c0246552dc40))

## [0.9.15](https://github.com/blueraai/bluera-knowledge/compare/v0.9.14...v0.9.15) (2026-01-06)


### Features

* **crawl:** add Claude CLI availability detection for npm package mode ([9afaae5](https://github.com/blueraai/bluera-knowledge/commit/9afaae5b4b4da98ce787d966c9910004401756dd))
* **release:** add automatic changelog generation with commit-and-tag-version ([177c6a3](https://github.com/blueraai/bluera-knowledge/commit/177c6a35f0a965b701940b2f8fc72fe2e4645647))
* rename to @bluera/bluera-knowledge and add npm publishing ([51a86cb](https://github.com/blueraai/bluera-knowledge/commit/51a86cb574fb9752224e724c1047a5000f4e898b))
* **skills:** add hybrid MCP + Skills enhancement ([9fbee1d](https://github.com/blueraai/bluera-knowledge/commit/9fbee1d90d02663dbda9646e244423c7840330a6))


### Bug Fixes

* **ci:** add model warm-up step to prevent race conditions ([4f5cc6a](https://github.com/blueraai/bluera-knowledge/commit/4f5cc6a6a33f4ab28e8daa2ee6a02e1cc81bf59b))
* **ci:** correct model cache location and test timeouts ([8ae7d9d](https://github.com/blueraai/bluera-knowledge/commit/8ae7d9dcd38ac7ccea3a5bae83ef07449adb693f))
* **cli:** resolve hanging subprocess by adding destroyServices cleanup ([36acc15](https://github.com/blueraai/bluera-knowledge/commit/36acc1560ed6ea999781e63614de701c7277c8d5))
* **docs:** remove nested code blocks breaking GitHub rendering ([11aef7a](https://github.com/blueraai/bluera-knowledge/commit/11aef7a433623c8831e235714a7c1382b146504d))
* **hooks:** make npm precommit script use smart git hook ([4a9f6b0](https://github.com/blueraai/bluera-knowledge/commit/4a9f6b0bddfd3d1d310b8dba40093c36cc3fa163))
* **security:** address vulnerabilities from security audit ([4de8b46](https://github.com/blueraai/bluera-knowledge/commit/4de8b461268484dadccee86da42f96c6917e262d))
* **test:** remove flaky performance assertions from stress tests ([69a480b](https://github.com/blueraai/bluera-knowledge/commit/69a480ba00b6e4b5aace4ea1b732c0246552dc40))

## [0.9.11] - 2026-01-04

### Fixed
- CI automation: Use `workflow_run` trigger for marketplace updates (GitHub security prevents `GITHUB_TOKEN` workflows from triggering other workflows)

## [0.9.10] - 2026-01-04

### Added
- Automated marketplace updates via GitHub Actions workflow
- Update Marketplace workflow waits for CI to pass before updating `blueraai/bluera-marketplace`

### Changed
- Release workflow now automatically triggers marketplace update (no manual steps required)

## [0.9.9] - 2026-01-04

### Fixed
- MCP server auto-discovery: moved `.mcp.json` to plugin root (was incorrectly in `.claude-plugin/`)

## [0.9.8] - 2026-01-04

### Fixed
- Plugin installation failures caused by root `.mcp.json` conflicting with plugin structure

## [0.9.7] - 2026-01-03

### Added
- Claude Code perspective documentation explaining how to use bluera-knowledge effectively

### Changed
- Enhanced README with blockquote formatting, tables, and improved section organization
- Added table of contents for better navigation

## [0.9.6] - 2026-01-03

### Changed
- Clarified MCP configuration for local development vs distribution
- Documentation improvements for job status and search capabilities

## [0.9.5] - 2026-01-03

### Fixed
- SessionStart hook now installs node_modules on first session

### Added
- Marketplace update reminder in release workflow
- Version script improvements

## [0.9.4] - 2026-01-02

### Added
- MCP symlink setup documentation for local development
- `.mcp.json` in `.claude-plugin/` for marketplace installs
- `release:current` script for tagging existing versions

### Changed
- Improved CLAUDE.md with npm scripts reference

## [0.9.3] - 2026-01-02

### Added
- Multi-language support for dependency detection (Python, Go, Rust, Java)
- crates.io and Go module registry support for URL resolution

### Changed
- Expanded crawl command examples with natural language options
- Streamlined installation section in README

## [0.9.0-0.9.2] - 2026-01-02

### Added
- Automatic GitHub release workflow on tag push
- Release scripts (`npm run release:patch/minor/major`)

### Changed
- Plugin restructured for correct Claude Code plugin layout
- Repository moved to blueraai organization

### Fixed
- IndexService tests skipped in CI environment (coverage threshold adjusted)

## [0.7.0-0.8.0] - 2026-01-01

### Added
- LICENSE, NOTICE, and acknowledgments
- Plugin UI documentation for browsing/installing

### Changed
- Marketplace moved to dedicated repository
- Installation section moved to top of README

## [0.6.0] - 2026-01-01

### Added
- Headless browser support via crawl4ai for JavaScript-rendered sites (Next.js, React, Vue, etc.)
- `--headless` flag for crawl command to enable Playwright browser automation
- Python bridge method `fetchHeadless()` using crawl4ai's AsyncWebCrawler
- Automatic fallback to axios if headless fetch fails
- Mermaid sequence diagrams in README.md showing crawler architecture for both modes
- Comprehensive documentation for headless crawling in commands/crawl.md

### Changed
- `fetchHtml()` now accepts optional `useHeadless` parameter for browser automation
- `CrawlOptions` interface includes `useHeadless` field
- Updated Dependencies section in README with playwright installation instructions
- Extended `crawl` command with `--headless` option and updated TypeScript types

### Improved
- Crawler now handles JavaScript-rendered sites that require client-side rendering
- Preserves intelligent crawling with natural language instructions in both standard and headless modes

## [0.5.3] - 2026-01-01

### Changed
- Move Store to its own line for better vertical scannability

## [0.5.2] - 2026-01-01

### Changed
- Add text labels before all badges in search results (File:, Purpose:, Top Terms:, Imports:)

## [0.5.1] - 2026-01-01

### Changed
- Replace emoji badges with text labels for search methods: [Vector+FTS], [Vector], [Keyword]
- Add "Store:" prefix to search results for better clarity

## [0.5.0] - 2026-01-01

### Added
- Ranking attribution badges showing search method for each result (🎯 both, 🔍 vector, 📝 FTS)
- Search mode display in results header (vector/fts/hybrid)
- Performance metrics in search results footer (time in milliseconds)
- Ranking metadata preserved in search results (vectorRank, ftsRank, RRF scores, boost factors)

### Changed
- Renamed "Keywords" to "Top Terms (in this chunk)" for clarity about scope and methodology
- Updated "Imports" to "Imports (in this chunk)" to clarify chunk-level analysis
- Search results now show which ranking method(s) contributed to each result

### Improved
- Search result transparency - users can now see how each result was found
- Label clarity - all labels now explicitly state they analyze chunk content, not whole files

## [0.4.22] - 2026-01-01

### Changed
- Renamed "Related" to "Keywords" for clarity - these are the most frequent meaningful terms extracted from the code
- Restored default search limit from 5 to 10 results (user preference)
- Updated README with new search output format and current version badge

### Fixed
- Search result labels now accurately describe what they show (Keywords are top 5 frequent words, not related concepts)

## [0.4.21] - 2026-01-01

### Added
- Display related concepts and key imports in search results (from contextual detail)
- Actionable "Next Steps" footer with examples using actual result IDs and paths
- Richer context to help users decide which results to explore

### Changed
- Reduced default limit from 10 to 5 results (quality over quantity)
- Enhanced result format shows Related concepts (🔗) and Imports (📦)

## [0.4.20] - 2026-01-01

### Fixed
- Search results now display directly in conversation (not in verbose mode)
- Abandoned table formatting approach - Bash output is collapsed by default

### Changed
- Switched to clean list format with emoji icons for better readability
- Results display immediately without requiring ctrl+o to expand

## [0.4.19] - 2026-01-01

### Fixed
- Search command now uses Python formatter via Bash for deterministic table output
- Fixed broken table alignment in terminal (columns now properly aligned with fixed widths)

### Changed
- Updated search.md to pipe MCP results through format-search-results.py
- Command instructs Claude to execute Python formatter for proper table rendering

## [0.4.18] - 2026-01-01

### Fixed
- Search command now displays results correctly in conversation transcript
- Removed PostToolUse hook approach (output only visible in verbose mode)
- Claude now formats results directly with simpler markdown table syntax

### Changed
- Simplified search result formatting - removed fixed-width column requirements
- Updated command to use standard markdown tables instead of hook-based formatting

### Removed
- PostToolUse hook for search formatting (`format-search-results.py` retained for reference)

## [0.4.17] - 2026-01-01

### Fixed
- Fixed duplicate search output by instructing Claude not to generate tables
- PostToolUse hook now solely responsible for displaying formatted results

## [0.4.16] - 2026-01-01

### Changed
- Replaced prompt-based table formatting with deterministic PostToolUse hook
- Search results now formatted by Python script with precise column widths
- Simplified search.md command - formatting handled by hook

### Added
- `hooks/format-search-results.py` - deterministic table formatter for search output

## [0.4.15] - 2026-01-01

### Fixed
- Fixed search command table alignment by enforcing fixed-width columns with proper padding
- Separator row now uses exact cell widths (7/14/47/50 chars) for proper vertical alignment
- All column borders now align perfectly in terminal output

## [0.4.14] - 2026-01-01

### Fixed
- Enforced strict column width limits in search command output to prevent table formatting issues
- Added explicit truncation rules (Store: 12 chars, File: 45 chars, Purpose: 48 chars)
- Improved command documentation with clear examples of text truncation

## [0.4.13] - 2026-01-01

### Fixed
- Fixed table separator alignment in search output
- Better visual formatting for search results

## [0.4.11-0.4.12] - 2026-01-01

### Changed
- Changed search output to table format
- Added store names to search results for clarity

## [0.4.10] - 2026-01-01

### Added
- Added store names to search results

### Removed
- Removed flaky stress tests

## [0.4.4] - 2025-12-31

### Changed
- Table formatting refinements (clean IDs, ~ for home paths)
- Improved readability of stores command output

## [0.4.3] - 2025-12-31

### Changed
- Store list outputs in beautiful table format
- Enhanced command output presentation

## [0.4.2] - 2025-12-30

### Changed
- Commands converted to use MCP tools instead of bash execution
- Improved architecture for command handling
- Better integration with Claude Code's tool system

## [0.4.1] - 2025-12-29

### Added
- Auto-install Python dependencies via SessionStart hook
- Seamless setup experience for web crawling features
- PEP 668 compliance for modern Python environments

## [0.3.0] - 2025-12-28

### Added
- Web crawling with crawl4ai integration
- Create and index web stores from documentation sites
- Markdown conversion of web content

## [0.2.0] - 2025-12-27

### Added
- Smart usage-based dependency suggestions
- Automatic repository URL resolution via package registries

### Changed
- Improved analysis performance

### Fixed
- Fixed command prefix inconsistencies

## [0.1.x] - 2025-12-26

### Added
- Initial release
- Repository cloning and indexing
- Local folder indexing
- Semantic vector search with embeddings
- MCP server integration
