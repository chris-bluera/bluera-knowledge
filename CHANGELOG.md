# Changelog

All notable changes to this project will be documented in this file.

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
