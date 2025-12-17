# Test Fixtures

This directory contains pre-downloaded fixtures used for integration testing of the bluera-knowledge CLI. Using static fixtures ensures consistent, reproducible tests that work offline.

## Directory Structure

```
fixtures/
├── README.md                 # This file
├── github-readmes/           # README files from popular repositories
├── code-snippets/            # Realistic code samples
│   ├── auth/                 # Authentication patterns
│   ├── api/                  # API patterns
│   └── database/             # Database patterns
└── documentation/            # Technical documentation samples
```

## Fixture Sources

### GitHub READMEs

| File | Source | Description |
|------|--------|-------------|
| typescript.md | microsoft/TypeScript | TypeScript compiler README |
| react.md | facebook/react | React library README |
| express.md | expressjs/express | Express.js framework README |
| nextjs.md | vercel/next.js | Next.js framework README |
| vite.md | vitejs/vite | Vite build tool README |

**Original URLs:**
- https://raw.githubusercontent.com/microsoft/TypeScript/main/README.md
- https://raw.githubusercontent.com/facebook/react/main/README.md
- https://raw.githubusercontent.com/expressjs/express/master/Readme.md
- https://raw.githubusercontent.com/vercel/next.js/canary/readme.md
- https://raw.githubusercontent.com/vitejs/vite/main/README.md

### Code Snippets

| File | Pattern | Description |
|------|---------|-------------|
| auth/jwt-auth.ts | JWT Authentication | Token generation, verification, middleware |
| auth/oauth-flow.ts | OAuth 2.0 | PKCE, state management, token exchange |
| api/error-handling.ts | Error Handling | Custom errors, middleware, formatting |
| api/rest-controller.ts | REST Controller | CRUD operations, validation, pagination |
| database/repository-pattern.ts | Repository Pattern | Data access abstraction, Unit of Work |

### Documentation

| File | Type | Description |
|------|------|-------------|
| architecture.md | Architecture | System design, components, data flow |
| api-reference.md | API Reference | Endpoints, authentication, error codes |
| deployment-guide.md | Operations | Deployment, Docker, Kubernetes, monitoring |

## Usage in Tests

```typescript
import { loadFixture, loadAllFixtures } from '../helpers/fixture-loader';

// Load a single fixture
const readme = await loadFixture('github-readmes/typescript.md');

// Load all fixtures from a directory
const codeSnippets = await loadAllFixtures('code-snippets');

// Load fixtures by pattern
const authFiles = await loadFixturesByPattern('code-snippets/auth/*.ts');
```

## Refreshing Fixtures

To update fixtures with the latest versions from their sources:

```bash
# Fetch latest README files
curl -o tests/fixtures/github-readmes/typescript.md \
  https://raw.githubusercontent.com/microsoft/TypeScript/main/README.md

curl -o tests/fixtures/github-readmes/react.md \
  https://raw.githubusercontent.com/facebook/react/main/README.md

# ... etc
```

**Note:** After refreshing, verify tests still pass as content changes may affect expected search results.

## Test Scenarios

These fixtures enable the following test scenarios:

### E2E Workflow Tests
- Index README fixtures and search for framework features
- Index code snippets and find authentication patterns
- Multi-store search across different content types

### Search Quality Tests
- Semantic search: "user authentication" finds auth code
- Mode comparison: vector vs FTS vs hybrid results
- Relevance scoring: exact matches rank higher
- Threshold filtering: configurable similarity cutoffs

### Stress Tests
- Index all fixtures plus generated files (150+)
- Performance benchmarks for large datasets
- Concurrent search operations

## Adding New Fixtures

When adding new fixtures:

1. Place files in the appropriate subdirectory
2. Update this README with source information
3. Ensure content is representative for search testing
4. Include diverse vocabulary for semantic search validation
