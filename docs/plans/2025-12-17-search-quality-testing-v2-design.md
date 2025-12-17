# Search Quality Testing v2 - Design

## Goal

Build a valid, reproducible search quality testing system that enables real-world performance tracking and drives actionable improvements over time.

## Core Requirements

- **Valid tests**: Real representative data, not synthetic placeholders
- **Regression tracking**: Stable queries against stable corpus to measure changes
- **Exploratory testing**: Generate fresh queries to discover new issues
- **Actionable output**: AI-judged with spot-checks for calibration

---

## Test Corpus

### Structure

```
tests/fixtures/corpus/           # Committed directly (no .git folders)
├── oss-repos/
│   ├── zod/                    # TypeScript schema validation
│   └── hono/                   # Lightweight web framework
├── documentation/
│   └── express-docs/           # Express.js guide excerpts
├── articles/                   # Technical blog posts, tutorials
├── papers/                     # Research papers (markdown)
└── VERSION.md                  # Corpus version documentation
```

### Selection Criteria

- Small but representative (~50-100 documents)
- Mix of content types: code + docs, articles, reference
- Pinned versions (cleaned snapshots, no .git)
- Reflects real usage: dev docs, documented codebases, articles

---

## Query Management

### Core Queries (`queries/core.json`)

```json
{
  "version": "1.0.0",
  "description": "Stable regression benchmark queries",
  "queries": [
    {
      "id": "auth-001",
      "query": "JWT token validation middleware",
      "intent": "Find authentication middleware implementations",
      "category": "code-pattern",
      "addedAt": "2025-12-17",
      "expectedSources": []
    }
  ]
}
```

### Query Categories

- `code-pattern` - Find implementation patterns
- `concept` - Explain a concept or approach
- `api-reference` - Look up specific API/function
- `troubleshooting` - Debug/error resolution
- `comparison` - Compare approaches or tools

### Generated Queries

- Saved to `queries/generated/YYYY-MM-DD-HH-MM.json`
- Same structure with `"source": "ai-generated"`
- Can promote good queries to core set manually

---

## Results & Tracking

### Structure

```
tests/quality-results/
├── runs/                           # Individual run outputs
│   └── 2025-12-17T16-23-58.jsonl
├── baseline.json                   # Current performance baseline
└── history.json                    # Score trends over time
```

### Baseline (`baseline.json`)

```json
{
  "updatedAt": "2025-12-17",
  "corpus": "v1.0.0",
  "querySet": "core@1.0.0",
  "scores": {
    "relevance": 0.72,
    "ranking": 0.68,
    "coverage": 0.65,
    "snippetQuality": 0.70,
    "overall": 0.69
  },
  "thresholds": {
    "regression": 0.05,
    "improvement": 0.03
  }
}
```

### Comparison Output

```
📊 Search Quality Results (vs baseline)

  Relevance:      0.75  (+0.03) ✅
  Ranking:        0.66  (-0.02)
  Coverage:       0.71  (+0.06) ✅
  Snippet:        0.68  (-0.02)
  Overall:        0.70  (+0.01)

  ✅ No regressions detected
```

---

## Test Execution

### Commands

| Command | Purpose |
|---------|---------|
| `npm run test:corpus:index` | Create store + index committed corpus |
| `npm run test:search-quality` | Regression check against baseline |
| `npm run test:search-quality -- --explore` | Generate fresh queries + run |
| `npm run test:search-quality -- --set <name>` | Re-run historical query set |
| `npm run test:search-quality -- --update-baseline` | Lock current scores as baseline |

### CI Integration

```yaml
- run: npm run test:corpus:index
- run: npm run test:search-quality
```

---

## AI Judgment Calibration

### Spot-Check Workflow

```bash
npm run test:search-quality -- --review
```

Interactive review of AI judgments to track agreement rate.

### Calibration Data (`queries/calibration.json`)

```json
{
  "judgments": [...],
  "stats": {
    "totalReviewed": 47,
    "agreementRate": 0.89,
    "lastReview": "2025-12-17"
  }
}
```

### When to Recalibrate

- Agreement rate drops below 85%
- After major prompt changes
- Quarterly as hygiene

---

## Implementation Priority

### Phase 1 - Foundation

1. Build corpus: clone Zod + Hono, clean .git dirs, commit
2. Add 5-10 articles/docs manually
3. Create `core.json` with 15-20 curated queries
4. Update script for committed corpus + named query sets
5. Add baseline comparison output

### Phase 2 - Tracking

1. Implement `baseline.json` and `history.json`
2. Add `--update-baseline` flag
3. Regression detection with threshold alerts
4. Before/after comparison in output

### Phase 3 - Calibration

1. Interactive `--review` command
2. `calibration.json` tracking
3. Agreement rate reporting

### Phase 4 - CI

1. GitHub Actions workflow
2. PR comments with score changes
3. Block merges on regression

### Out of Scope (YAGNI)

- PDF support (add later if needed)
- Visualization dashboards
- Automated query promotion
