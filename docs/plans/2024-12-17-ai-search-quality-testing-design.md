# AI-Powered Search Quality Testing

## Overview

A two-phase evaluation system where Claude CLI both generates test queries and judges search result quality, producing structured feedback to drive search improvements.

## Goals

- **Comprehensive evaluation**: Score relevance, ranking, coverage, and snippet quality
- **Actionable feedback**: Detailed analysis and specific improvement suggestions
- **Trend tracking**: JSONL output for monitoring quality over time
- **Self-evolving**: AI generates queries from actual indexed content

## Execution Flow

```
npm run test:search-quality
    │
    ├─► Phase 1: Query Generation
    │   └─► Claude explores tests/fixtures/ directory
    │   └─► Generates 10-15 diverse test queries
    │
    ├─► Phase 2: Search & Evaluation
    │   └─► For each query:
    │       ├─► Run bkbsearch
    │       └─► Claude evaluates results (scores + analysis + suggestions)
    │
    └─► Output: tests/quality-results/2024-12-17T10-30-00.jsonl
```

## File Structure

```
tests/
├── quality-config.json          # Configuration
├── quality-results/             # JSONL output files
│   └── .gitkeep
└── scripts/
    └── search-quality.ts        # Main test runner
```

## Configuration

`tests/quality-config.json`:
```json
{
  "queryCount": 15,
  "searchLimit": 10,
  "searchMode": "hybrid",
  "stores": null
}
```

- `queryCount`: Number of queries Claude generates (default: 15)
- `searchLimit`: Max results per search (default: 10)
- `searchMode`: vector | fts | hybrid (default: hybrid)
- `stores`: Specific stores to test, or null for all

## Output Format

Each line in the JSONL file represents one query evaluation:

```json
{
  "timestamp": "2024-12-17T10:30:00.000Z",
  "query": "JWT token refresh implementation",
  "queryIntent": "Find code handling JWT refresh token logic",
  "searchMode": "hybrid",
  "resultCount": 10,
  "scores": {
    "relevance": 0.85,
    "ranking": 0.70,
    "coverage": 0.90,
    "snippetQuality": 0.75,
    "overall": 0.80
  },
  "analysis": {
    "relevance": "8/10 results directly relate to JWT tokens. Results #6 and #9 are about general auth headers, not JWT specifically.",
    "ranking": "Top result is OAuth flow, not JWT refresh. jwt-auth.ts with refreshToken function should rank #1 but is #3.",
    "coverage": "Found the main JWT implementation. Minor gap: didn't surface the token expiry handling in error-handling.ts.",
    "snippetQuality": "Snippets are readable but some cut off mid-function. Result #4 snippet doesn't show the most relevant code section."
  },
  "suggestions": [
    "Improve semantic distinction between 'refresh token' (JWT concept) vs 'OAuth refresh' (flow type)",
    "Consider boosting exact function name matches - 'refreshToken' function exists but ranks below partial matches",
    "Chunk boundaries may be splitting functions - review chunking strategy for code files"
  ],
  "results": [
    {"rank": 1, "source": "oauth-flow.ts", "score": -0.23, "relevant": true},
    {"rank": 2, "source": "jwt-auth.ts", "score": -0.31, "relevant": true}
  ]
}
```

**End-of-file summary** (last line):
```json
{
  "type": "summary",
  "timestamp": "2024-12-17T10:30:45.000Z",
  "totalQueries": 15,
  "averageScores": {
    "relevance": 0.82,
    "ranking": 0.68,
    "coverage": 0.85,
    "snippetQuality": 0.71,
    "overall": 0.77
  },
  "topIssues": ["Ranking of exact matches", "Code chunk boundaries", "Semantic disambiguation"],
  "recommendedFocus": "Ranking algorithm - exact and function name matches consistently rank lower than expected"
}
```

## Implementation Approach

### Phase 1: Query Generation

```bash
claude -p --output-format json --json-schema '...' \
  "Explore tests/fixtures/ to understand the indexed content,
   then generate ${queryCount} diverse search queries..."
```

Claude uses Glob/Read tools to browse fixtures, understands content types (auth code, API docs, READMEs), and generates queries that meaningfully test search.

### Phase 2: Per-Query Evaluation

```bash
bkbsearch "JWT refresh" --include-content | \
  claude -p --output-format json --json-schema '...' \
  "Evaluate these search results for the query 'JWT refresh'..."
```

Pipes actual search results to Claude for evaluation against the JSON schema.

### npm Script

```json
{
  "scripts": {
    "test:search-quality": "npx tsx tests/scripts/search-quality.ts"
  }
}
```

## Error Handling

### Claude CLI Failures
- **Rate limits**: Retry with exponential backoff (max 3 retries)
- **Invalid JSON**: Log raw response to stderr, skip query, continue
- **Timeout**: 60s per CLI call, `--max-budget-usd 0.50` safety cap

### Search Failures
- **Empty results**: Evaluate as valid feedback (coverage = 0)
- **Store not found**: Fail fast with clear error
- **Malformed output**: Log, skip, include in summary as "evaluation failed"

### Output Handling
- **Directory missing**: Create automatically
- **Partial run (Ctrl+C)**: Write completed evaluations immediately
- **Duplicate timestamps**: Append milliseconds suffix

### AI Evaluation Edge Cases
- **Ambiguous queries**: Flag in analysis ("query could mean X or Y")
- **All results relevant**: Valid outcome, high scores
- **No fixtures indexed**: Detect early, abort with helpful message

## Console Output

```
🔍 Generating test queries from tests/fixtures/...
✓ Generated 15 queries

📊 Evaluating search quality...
  [1/15] "JWT token refresh" - overall: 0.80
  [2/15] "error handling middleware" - overall: 0.85
  ...
  [15/15] "database repository pattern" - overall: 0.72

✓ Results written to tests/quality-results/2024-12-17T10-30-00.jsonl
📈 Average overall score: 0.77
```

## Score Dimensions

| Dimension | Description |
|-----------|-------------|
| **Relevance** | Do results actually relate to the query intent? |
| **Ranking** | Are the most relevant results at the top? |
| **Coverage** | Did the search find all expected matches? |
| **Snippet Quality** | Are snippets readable and showing relevant sections? |
| **Overall** | Weighted combination of all dimensions |

## Usage for Improvements

The detailed feedback enables:

1. **Identify patterns**: Run multiple times, aggregate `topIssues` across runs
2. **Track regressions**: Compare `averageScores` between runs after changes
3. **Prioritize work**: `recommendedFocus` highlights highest-impact improvements
4. **Debug specific issues**: `analysis` explains exactly why scores are low
5. **Validate fixes**: Re-run after changes to confirm improvements
