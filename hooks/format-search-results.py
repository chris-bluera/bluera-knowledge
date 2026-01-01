#!/usr/bin/env python3
"""
PostToolUse hook to format mcp__bluera-knowledge__search results
into a fixed-width table with deterministic output.
"""

import json
import sys
import os

# Column widths (content only, not including | separators)
SCORE_WIDTH = 6   # Right-aligned: " 1.00 "
STORE_WIDTH = 12  # Left-aligned: "store       "
FILE_WIDTH = 45   # Left-aligned: "path/to/file..."
PURPOSE_WIDTH = 48  # Left-aligned: "Purpose text..."


def truncate(text: str, max_len: int) -> str:
    """Truncate text with ellipsis if needed."""
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def format_score(score: float) -> str:
    """Format score as right-aligned fixed-width string."""
    return f"{score:5.2f}".rjust(SCORE_WIDTH)


def format_store(store_name: str) -> str:
    """Format store name as left-aligned fixed-width string."""
    truncated = truncate(store_name, STORE_WIDTH)
    return truncated.ljust(STORE_WIDTH)


def format_file(location: str, repo_root: str) -> str:
    """Format file path as left-aligned fixed-width string."""
    # Strip repo root prefix
    if repo_root and location.startswith(repo_root):
        path = location[len(repo_root):].lstrip("/")
    else:
        path = location
    truncated = truncate(path, FILE_WIDTH)
    return truncated.ljust(FILE_WIDTH)


def format_purpose(purpose: str) -> str:
    """Format purpose as left-aligned fixed-width string."""
    # Clean up purpose text
    clean = purpose.replace("\n", " ").strip()
    truncated = truncate(clean, PURPOSE_WIDTH)
    return truncated.ljust(PURPOSE_WIDTH)


def format_table(results: list, query: str) -> str:
    """Format search results into a fixed-width markdown table."""
    lines = []

    # Header
    lines.append(f"## Search Results for \"{query}\"")
    lines.append("")

    if not results:
        lines.append(f"No results found for \"{query}\"")
        lines.append("")
        lines.append("Try:")
        lines.append("- Broadening your search terms")
        lines.append("- Checking if the relevant stores are indexed")
        lines.append("- Using /bluera-knowledge:stores to see available stores")
        return "\n".join(lines)

    # Table header
    header = f"| {'Score'.rjust(SCORE_WIDTH)} | {'Store'.ljust(STORE_WIDTH)} | {'File'.ljust(FILE_WIDTH)} | {'Purpose'.ljust(PURPOSE_WIDTH)} |"
    # Separator: Score is right-aligned (colon at end), others are left-aligned
    # The +2 accounts for the spaces around content, -1 for the colon on Score column
    separator = f"|{'-' * (SCORE_WIDTH + 1)}:|{'-' * (STORE_WIDTH + 2)}|{'-' * (FILE_WIDTH + 2)}|{'-' * (PURPOSE_WIDTH + 2)}|"

    lines.append(header)
    lines.append(separator)

    # Data rows
    for result in results:
        score = result.get("score", 0)
        summary = result.get("summary", {})
        store_name = summary.get("storeName", "unknown")
        location = summary.get("location", "")
        repo_root = summary.get("repoRoot", "")
        purpose = summary.get("purpose", "")

        row = f"| {format_score(score)} | {format_store(store_name)} | {format_file(location, repo_root)} | {format_purpose(purpose)} |"
        lines.append(row)

    lines.append("")
    lines.append(f"**Found**: {len(results)} results")

    return "\n".join(lines)


def main():
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)

        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_result = input_data.get("tool_result", {})

        # Only process search results
        if tool_name != "mcp__bluera-knowledge__search":
            sys.exit(0)

        # Extract results and query
        results = tool_result.get("results", [])
        query = tool_input.get("query", "")

        # Format the table
        formatted = format_table(results, query)

        # Output the formatted table
        # For PostToolUse, stdout is shown in the transcript
        print(formatted)

    except json.JSONDecodeError as e:
        print(f"Error parsing hook input: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error formatting results: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
