# Search Quality Testing Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a valid, reproducible search quality testing system with real-world corpus and stable regression queries.

**Architecture:** Committed corpus (OSS repos + docs) indexed into dedicated test store, curated query sets in JSON, baseline comparison for regression detection.

**Tech Stack:** TypeScript, bkb CLI, Claude CLI for AI evaluation

---

### Task 1: Create Corpus Directory Structure

**Files:**
- Create: `tests/fixtures/corpus/VERSION.md`
- Create: `tests/fixtures/corpus/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p tests/fixtures/corpus/oss-repos
mkdir -p tests/fixtures/corpus/documentation
mkdir -p tests/fixtures/corpus/articles
```

**Step 2: Create VERSION.md**

Create `tests/fixtures/corpus/VERSION.md`:
```markdown
# Test Corpus Version

## Current Version: 1.0.0

## Contents
- **oss-repos/zod**: Zod v3.24.0 (TypeScript schema validation)
- **oss-repos/hono**: Hono v4.6.0 (lightweight web framework)
- **documentation/**: Express.js and Node.js excerpts
- **articles/**: Curated technical articles

## Last Updated
2025-12-17

## Maintenance
When updating corpus:
1. Update version number above
2. Update contents list
3. Run `npm run test:corpus:index` to rebuild index
4. Run `npm run test:search-quality -- --update-baseline` to set new baseline
```

**Step 3: Commit**

```bash
git add tests/fixtures/corpus/
git commit -m "chore: create corpus directory structure"
```

---

### Task 2: Add Zod Repository to Corpus

**Files:**
- Create: `tests/fixtures/corpus/oss-repos/zod/` (multiple files)

**Step 1: Clone and clean Zod**

```bash
cd tests/fixtures/corpus/oss-repos
git clone --depth 1 --branch v3.24.0 https://github.com/colinhacks/zod.git zod-temp
mv zod-temp zod
rm -rf zod/.git
rm -rf zod/node_modules
rm -rf zod/.github
rm -f zod/.gitignore zod/.gitattributes
```

**Step 2: Keep only relevant content**

```bash
cd zod
# Keep: README, docs, src (for code examples)
rm -rf playground deno vitest.config.ts logo.svg
# Remove test files (we want docs, not their tests)
find . -name "*.test.ts" -delete
find . -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
cd ../../../..
```

**Step 3: Verify content**

```bash
ls tests/fixtures/corpus/oss-repos/zod/
# Should show: README.md, src/, docs/ (if exists), package.json
find tests/fixtures/corpus/oss-repos/zod -name "*.md" | wc -l
# Should be at least 1 (README)
```

**Step 4: Commit**

```bash
git add tests/fixtures/corpus/oss-repos/zod/
git commit -m "feat(corpus): add Zod v3.24.0 to test corpus"
```

---

### Task 3: Add Hono Repository to Corpus

**Files:**
- Create: `tests/fixtures/corpus/oss-repos/hono/` (multiple files)

**Step 1: Clone and clean Hono**

```bash
cd tests/fixtures/corpus/oss-repos
git clone --depth 1 --branch v4.6.0 https://github.com/honojs/hono.git hono-temp
mv hono-temp hono
rm -rf hono/.git
rm -rf hono/node_modules
rm -rf hono/.github
rm -f hono/.gitignore hono/.gitattributes
```

**Step 2: Keep only relevant content**

```bash
cd hono
rm -rf runtime_tests benchmarks .vscode
find . -name "*.test.ts" -delete
find . -name "*.test.tsx" -delete
find . -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
cd ../../../..
```

**Step 3: Verify content**

```bash
ls tests/fixtures/corpus/oss-repos/hono/
find tests/fixtures/corpus/oss-repos/hono -name "*.md" | wc -l
```

**Step 4: Commit**

```bash
git add tests/fixtures/corpus/oss-repos/hono/
git commit -m "feat(corpus): add Hono v4.6.0 to test corpus"
```

---

### Task 4: Add Documentation Excerpts

**Files:**
- Create: `tests/fixtures/corpus/documentation/express-routing.md`
- Create: `tests/fixtures/corpus/documentation/express-middleware.md`
- Create: `tests/fixtures/corpus/documentation/node-streams.md`

**Step 1: Create Express routing doc**

Create `tests/fixtures/corpus/documentation/express-routing.md`:
```markdown
# Express Routing Guide

## Basic Routing

Routing refers to how an application's endpoints (URIs) respond to client requests.

```javascript
const express = require('express')
const app = express()

// respond with "hello world" when a GET request is made to the homepage
app.get('/', (req, res) => {
  res.send('hello world')
})

// POST method route
app.post('/', (req, res) => {
  res.send('POST request to the homepage')
})
```

## Route Methods

Express supports methods that correspond to all HTTP request methods: `get`, `post`, `put`, `delete`, `patch`, etc.

```javascript
app.get('/user/:id', (req, res) => {
  res.send(`User ${req.params.id}`)
})

app.put('/user/:id', (req, res) => {
  res.send(`Updated user ${req.params.id}`)
})

app.delete('/user/:id', (req, res) => {
  res.send(`Deleted user ${req.params.id}`)
})
```

## Route Parameters

Route parameters are named URL segments used to capture values at specific positions in the URL.

```javascript
// Route path: /users/:userId/books/:bookId
// Request URL: /users/34/books/8989
// req.params: { "userId": "34", "bookId": "8989" }

app.get('/users/:userId/books/:bookId', (req, res) => {
  res.send(req.params)
})
```

## Route Handlers

You can provide multiple callback functions that behave like middleware:

```javascript
app.get('/example/b', (req, res, next) => {
  console.log('the response will be sent by the next function ...')
  next()
}, (req, res) => {
  res.send('Hello from B!')
})
```

## express.Router

Use the `express.Router` class to create modular, mountable route handlers.

```javascript
const router = express.Router()

router.get('/', (req, res) => {
  res.send('Birds home page')
})

router.get('/about', (req, res) => {
  res.send('About birds')
})

module.exports = router
```
```

**Step 2: Create Express middleware doc**

Create `tests/fixtures/corpus/documentation/express-middleware.md`:
```markdown
# Express Middleware Guide

## What is Middleware?

Middleware functions are functions that have access to the request object (`req`), the response object (`res`), and the `next` function in the application's request-response cycle.

Middleware functions can:
- Execute any code
- Make changes to the request and response objects
- End the request-response cycle
- Call the next middleware in the stack

## Application-level Middleware

Bind application-level middleware to an instance of the app object using `app.use()` and `app.METHOD()`.

```javascript
const express = require('express')
const app = express()

// Middleware with no mount path - executed for every request
app.use((req, res, next) => {
  console.log('Time:', Date.now())
  next()
})

// Middleware mounted on /user/:id
app.use('/user/:id', (req, res, next) => {
  console.log('Request Type:', req.method)
  next()
})
```

## Error-handling Middleware

Error-handling middleware always takes four arguments:

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})
```

## Built-in Middleware

Express has built-in middleware functions:

- `express.static` - serves static assets
- `express.json` - parses JSON payloads
- `express.urlencoded` - parses URL-encoded payloads

```javascript
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
```

## Third-party Middleware

Common third-party middleware:

```javascript
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

app.use(cors())
app.use(helmet())
app.use(morgan('dev'))
```
```

**Step 3: Create Node streams doc**

Create `tests/fixtures/corpus/documentation/node-streams.md`:
```markdown
# Node.js Streams Guide

## What are Streams?

Streams are collections of data that might not be available all at once and don't have to fit in memory. They're ideal for working with large amounts of data or data from external sources.

## Types of Streams

1. **Readable** - streams from which data can be read (e.g., `fs.createReadStream()`)
2. **Writable** - streams to which data can be written (e.g., `fs.createWriteStream()`)
3. **Duplex** - streams that are both Readable and Writable (e.g., `net.Socket`)
4. **Transform** - Duplex streams that can modify data as it passes through

## Reading from Streams

```javascript
const fs = require('fs')

const readStream = fs.createReadStream('large-file.txt', 'utf8')

readStream.on('data', (chunk) => {
  console.log('Received chunk:', chunk.length, 'bytes')
})

readStream.on('end', () => {
  console.log('Finished reading')
})

readStream.on('error', (err) => {
  console.error('Error:', err)
})
```

## Writing to Streams

```javascript
const fs = require('fs')

const writeStream = fs.createWriteStream('output.txt')

writeStream.write('Hello, ')
writeStream.write('World!')
writeStream.end()

writeStream.on('finish', () => {
  console.log('Finished writing')
})
```

## Piping Streams

The `pipe()` method connects a readable stream to a writable stream:

```javascript
const fs = require('fs')

const readStream = fs.createReadStream('input.txt')
const writeStream = fs.createWriteStream('output.txt')

readStream.pipe(writeStream)
```

## Transform Streams

```javascript
const { Transform } = require('stream')

const upperCaseTransform = new Transform({
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase())
    callback()
  }
})

process.stdin
  .pipe(upperCaseTransform)
  .pipe(process.stdout)
```
```

**Step 4: Commit**

```bash
git add tests/fixtures/corpus/documentation/
git commit -m "feat(corpus): add Express and Node.js documentation"
```

---

### Task 5: Add Technical Articles

**Files:**
- Create: `tests/fixtures/corpus/articles/jwt-authentication.md`
- Create: `tests/fixtures/corpus/articles/typescript-generics.md`
- Create: `tests/fixtures/corpus/articles/react-hooks-patterns.md`

**Step 1: Create JWT authentication article**

Create `tests/fixtures/corpus/articles/jwt-authentication.md`:
```markdown
# JWT Authentication in Node.js: A Complete Guide

## What is JWT?

JSON Web Tokens (JWT) are an open standard (RFC 7519) for securely transmitting information between parties as a JSON object. JWTs are commonly used for authentication and authorization.

## Structure of a JWT

A JWT consists of three parts separated by dots:

```
header.payload.signature
```

- **Header**: Contains the token type and signing algorithm
- **Payload**: Contains claims (user data)
- **Signature**: Verifies the token hasn't been tampered with

## Implementing JWT Authentication

### Installation

```bash
npm install jsonwebtoken bcryptjs
```

### Creating Tokens

```javascript
const jwt = require('jsonwebtoken')

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  )
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  )
}
```

### Verifying Tokens

```javascript
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}
```

### Refresh Token Flow

```javascript
app.post('/token/refresh', (req, res) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' })
  }

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid refresh token' })
    }

    const accessToken = generateAccessToken({ id: user.userId })
    res.json({ accessToken })
  })
})
```

## Security Best Practices

1. **Use short expiration times** for access tokens (15 minutes)
2. **Store refresh tokens securely** (httpOnly cookies)
3. **Implement token revocation** for logout
4. **Use strong secrets** (at least 256 bits)
5. **Always use HTTPS** in production
```

**Step 2: Create TypeScript generics article**

Create `tests/fixtures/corpus/articles/typescript-generics.md`:
```markdown
# TypeScript Generics: From Basics to Advanced Patterns

## Why Generics?

Generics allow you to write reusable code that works with multiple types while maintaining type safety.

## Basic Generic Functions

```typescript
// Without generics - loses type information
function identity(arg: any): any {
  return arg
}

// With generics - preserves type
function identity<T>(arg: T): T {
  return arg
}

const str = identity<string>('hello') // string
const num = identity(42) // number (inferred)
```

## Generic Constraints

Constrain generics to types with specific properties:

```typescript
interface HasLength {
  length: number
}

function logLength<T extends HasLength>(arg: T): T {
  console.log(arg.length)
  return arg
}

logLength('hello') // OK
logLength([1, 2, 3]) // OK
logLength(123) // Error: number doesn't have length
```

## Generic Interfaces

```typescript
interface Repository<T> {
  find(id: string): Promise<T | null>
  findAll(): Promise<T[]>
  create(data: Omit<T, 'id'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}

interface User {
  id: string
  name: string
  email: string
}

class UserRepository implements Repository<User> {
  async find(id: string): Promise<User | null> {
    // implementation
  }
  // ... other methods
}
```

## Conditional Types

```typescript
type IsArray<T> = T extends any[] ? true : false

type A = IsArray<string[]> // true
type B = IsArray<number>   // false

// Extract element type from array
type ElementType<T> = T extends (infer E)[] ? E : never

type C = ElementType<string[]> // string
```

## Mapped Types

```typescript
type Readonly<T> = {
  readonly [K in keyof T]: T[K]
}

type Partial<T> = {
  [K in keyof T]?: T[K]
}

type Required<T> = {
  [K in keyof T]-?: T[K]
}
```

## Utility Type Patterns

```typescript
// Make specific keys optional
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Make specific keys required
type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Deep partial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
```
```

**Step 3: Create React hooks article**

Create `tests/fixtures/corpus/articles/react-hooks-patterns.md`:
```markdown
# React Hooks Patterns and Best Practices

## Custom Hooks

Custom hooks let you extract component logic into reusable functions.

### useLocalStorage

```typescript
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }

  return [storedValue, setValue] as const
}
```

### useDebounce

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Usage
function SearchComponent() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery) {
      searchAPI(debouncedQuery)
    }
  }, [debouncedQuery])
}
```

### useFetch

```typescript
interface FetchState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

function useFetch<T>(url: string): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    async function fetchData() {
      try {
        setState(prev => ({ ...prev, loading: true }))
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(response.statusText)
        const data = await response.json()
        setState({ data, loading: false, error: null })
      } catch (error) {
        if (error.name !== 'AbortError') {
          setState({ data: null, loading: false, error })
        }
      }
    }

    fetchData()
    return () => controller.abort()
  }, [url])

  return state
}
```

## Rules of Hooks

1. **Only call hooks at the top level** - not inside loops, conditions, or nested functions
2. **Only call hooks from React functions** - components or custom hooks
3. **Name custom hooks with "use" prefix** - enables linting rules

## Performance Patterns

### useMemo for expensive calculations

```typescript
const expensiveResult = useMemo(() => {
  return computeExpensiveValue(a, b)
}, [a, b])
```

### useCallback for stable function references

```typescript
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])
```
```

**Step 4: Commit**

```bash
git add tests/fixtures/corpus/articles/
git commit -m "feat(corpus): add technical articles on JWT, TypeScript, React"
```

---

### Task 6: Create Query Directory and Core Query Set

**Files:**
- Create: `tests/fixtures/queries/core.json`
- Create: `tests/fixtures/queries/generated/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p tests/fixtures/queries/generated
touch tests/fixtures/queries/generated/.gitkeep
```

**Step 2: Create core query set**

Create `tests/fixtures/queries/core.json`:
```json
{
  "version": "1.0.0",
  "description": "Stable regression benchmark queries for search quality testing",
  "queries": [
    {
      "id": "code-001",
      "query": "zod schema validation",
      "intent": "Find documentation or examples of Zod schema validation",
      "category": "api-reference"
    },
    {
      "id": "code-002",
      "query": "express middleware error handling",
      "intent": "Find how to handle errors in Express middleware",
      "category": "code-pattern"
    },
    {
      "id": "code-003",
      "query": "JWT token authentication",
      "intent": "Find JWT authentication implementation examples",
      "category": "code-pattern"
    },
    {
      "id": "code-004",
      "query": "TypeScript generics constraints",
      "intent": "Learn how to constrain generic types in TypeScript",
      "category": "concept"
    },
    {
      "id": "code-005",
      "query": "React custom hooks",
      "intent": "Find patterns for creating custom React hooks",
      "category": "code-pattern"
    },
    {
      "id": "code-006",
      "query": "hono web framework routing",
      "intent": "Find Hono framework routing documentation",
      "category": "api-reference"
    },
    {
      "id": "code-007",
      "query": "node streams pipe",
      "intent": "Learn how to pipe Node.js streams together",
      "category": "concept"
    },
    {
      "id": "code-008",
      "query": "express route parameters",
      "intent": "Find how to use route parameters in Express",
      "category": "api-reference"
    },
    {
      "id": "code-009",
      "query": "useEffect cleanup function",
      "intent": "Understand useEffect cleanup patterns in React",
      "category": "concept"
    },
    {
      "id": "code-010",
      "query": "refresh token rotation",
      "intent": "Find implementation of refresh token rotation for auth",
      "category": "code-pattern"
    },
    {
      "id": "code-011",
      "query": "zod infer type from schema",
      "intent": "Learn how to infer TypeScript types from Zod schemas",
      "category": "api-reference"
    },
    {
      "id": "code-012",
      "query": "middleware next function",
      "intent": "Understand how the next() function works in middleware",
      "category": "concept"
    },
    {
      "id": "code-013",
      "query": "transform stream node",
      "intent": "Find examples of Node.js Transform streams",
      "category": "code-pattern"
    },
    {
      "id": "code-014",
      "query": "useMemo vs useCallback",
      "intent": "Compare useMemo and useCallback hooks in React",
      "category": "comparison"
    },
    {
      "id": "code-015",
      "query": "hono middleware context",
      "intent": "Find how Hono handles middleware context",
      "category": "api-reference"
    }
  ]
}
```

**Step 3: Commit**

```bash
git add tests/fixtures/queries/
git commit -m "feat(corpus): add core query set for regression testing"
```

---

### Task 7: Create Corpus Index Script

**Files:**
- Create: `tests/scripts/corpus-index.ts`

**Step 1: Create the script**

Create `tests/scripts/corpus-index.ts`:
```typescript
#!/usr/bin/env npx tsx

import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');
const CORPUS_DIR = join(__dirname, '..', 'fixtures', 'corpus');

const STORE_NAME = 'bluera-test-corpus';

function run(command: string, description: string): void {
  console.log(`\n📌 ${description}...`);
  try {
    execSync(command, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    throw error;
  }
}

async function main() {
  console.log('🔧 Corpus Index Setup');
  console.log(`   Store: ${STORE_NAME}`);
  console.log(`   Corpus: ${CORPUS_DIR}`);

  // Verify corpus exists
  if (!existsSync(CORPUS_DIR)) {
    console.error(`❌ Corpus directory not found: ${CORPUS_DIR}`);
    process.exit(1);
  }

  // Check if store exists, delete if so
  try {
    execSync(`node dist/index.js store info ${STORE_NAME}`, {
      cwd: ROOT_DIR,
      stdio: 'pipe',
    });
    console.log(`\n⚠️  Store "${STORE_NAME}" exists, deleting...`);
    run(`node dist/index.js store delete ${STORE_NAME} --force`, 'Deleting existing store');
  } catch {
    // Store doesn't exist, that's fine
  }

  // Create store
  run(
    `node dist/index.js store create ${STORE_NAME} --type file --source "${CORPUS_DIR}" --description "Test corpus for search quality benchmarks"`,
    'Creating test store'
  );

  // Index the store
  run(
    `node dist/index.js index ${STORE_NAME}`,
    'Indexing corpus'
  );

  // Show store info
  run(
    `node dist/index.js store info ${STORE_NAME}`,
    'Verifying store'
  );

  console.log('\n✅ Corpus indexed successfully!');
  console.log(`   Run quality tests with: npm run test:search-quality`);
}

main().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add tests/scripts/corpus-index.ts
git commit -m "feat: add corpus indexing script"
```

---

### Task 8: Update Quality Config for Corpus Store

**Files:**
- Modify: `tests/quality-config.json`

**Step 1: Update config**

Replace `tests/quality-config.json`:
```json
{
  "queryCount": 15,
  "searchLimit": 10,
  "searchMode": "hybrid",
  "stores": ["bluera-test-corpus"],
  "maxRetries": 3,
  "timeoutMs": 60000,
  "querySet": "core",
  "corpusVersion": "1.0.0"
}
```

**Step 2: Commit**

```bash
git add tests/quality-config.json
git commit -m "chore: configure quality tests to use corpus store"
```

---

### Task 9: Update Search Quality Types for Query Sets

**Files:**
- Modify: `tests/scripts/search-quality.types.ts`

**Step 1: Add query set types**

Add to `tests/scripts/search-quality.types.ts` after the existing types:
```typescript
// Query set types
export interface CoreQuery {
  id: string;
  query: string;
  intent: string;
  category: 'code-pattern' | 'concept' | 'api-reference' | 'troubleshooting' | 'comparison';
  expectedSources?: string[];
}

export interface QuerySet {
  version: string;
  description: string;
  queries: CoreQuery[];
  source?: 'curated' | 'ai-generated';
  generatedAt?: string;
}

// Baseline types
export interface BaselineScores {
  relevance: number;
  ranking: number;
  coverage: number;
  snippetQuality: number;
  overall: number;
}

export interface Baseline {
  updatedAt: string;
  corpus: string;
  querySet: string;
  scores: BaselineScores;
  thresholds: {
    regression: number;
    improvement: number;
  };
}

// Updated config type
export interface QualityConfig {
  queryCount: number;
  searchLimit: number;
  searchMode: 'hybrid' | 'semantic' | 'keyword';
  stores: string[] | null;
  maxRetries: number;
  timeoutMs: number;
  querySet: 'core' | 'explore' | string;
  corpusVersion: string;
}
```

**Step 2: Commit**

```bash
git add tests/scripts/search-quality.types.ts
git commit -m "feat: add query set and baseline types"
```

---

### Task 10: Update Search Quality Script for Query Sets

**Files:**
- Modify: `tests/scripts/search-quality.ts`

**Step 1: Add imports and query loading**

Add after the existing imports in `tests/scripts/search-quality.ts`:
```typescript
import type {
  QualityConfig,
  QueryGenerationResult,
  EvaluationResult,
  QueryEvaluation,
  RunSummary,
  Scores,
  QuerySet,
  CoreQuery,
  Baseline,
} from './search-quality.types.js';
```

Add new constants after SCHEMAS_DIR:
```typescript
const QUERIES_DIR = join(__dirname, '..', 'fixtures', 'queries');
const BASELINE_PATH = join(__dirname, '..', 'quality-results', 'baseline.json');
```

Add new function after loadSchema:
```typescript
function loadQuerySet(name: string): QuerySet {
  if (name === 'explore') {
    throw new Error('Use generateQueries() for explore mode');
  }

  const queryPath = join(QUERIES_DIR, `${name}.json`);
  if (!existsSync(queryPath)) {
    throw new Error(`Query set not found: ${queryPath}`);
  }

  return JSON.parse(readFileSync(queryPath, 'utf-8')) as QuerySet;
}

function loadBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
}

function saveBaseline(scores: Scores, config: QualityConfig): void {
  const baseline: Baseline = {
    updatedAt: new Date().toISOString().split('T')[0],
    corpus: config.corpusVersion,
    querySet: `${config.querySet}@${loadQuerySet(config.querySet).version}`,
    scores,
    thresholds: {
      regression: 0.05,
      improvement: 0.03,
    },
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`\n✅ Baseline saved to ${BASELINE_PATH}`);
}
```

**Step 2: Update main function to support query sets**

Replace the main function query generation section:
```typescript
async function main() {
  const startTime = Date.now();
  const config = loadConfig();
  const runId = generateRunId();

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const isExplore = args.includes('--explore');
  const updateBaseline = args.includes('--update-baseline');
  const setArg = args.find(a => a.startsWith('--set='));
  const querySetName = setArg ? setArg.split('=')[1] : (isExplore ? 'explore' : config.querySet);

  console.log('🚀 AI Search Quality Testing');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Query set: ${querySetName}`);
  console.log(`   Search mode: ${config.searchMode}`);
  console.log(`   Stores: ${config.stores?.join(', ') || 'all'}\n`);

  // Load baseline for comparison
  const baseline = loadBaseline();
  if (baseline) {
    console.log(`📊 Baseline: ${baseline.querySet} (${baseline.updatedAt})`);
    console.log(`   Overall: ${baseline.scores.overall}\n`);
  }

  // Ensure results directory exists
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Generate output filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = join(RESULTS_DIR, `${timestamp}.jsonl`);

  // Get queries - either from file or generate
  let queries: Array<{ query: string; intent: string }>;

  if (isExplore) {
    console.log('🔍 Generating exploratory queries...');
    const generated = generateQueries(config);
    queries = generated.queries;

    // Save generated queries
    const generatedPath = join(QUERIES_DIR, 'generated', `${timestamp}.json`);
    const generatedSet: QuerySet = {
      version: '1.0.0',
      description: `AI-generated queries from ${timestamp}`,
      queries: queries.map((q, i) => ({
        id: `gen-${i + 1}`,
        query: q.query,
        intent: q.intent,
        category: 'code-pattern' as const,
      })),
      source: 'ai-generated',
      generatedAt: new Date().toISOString(),
    };
    writeFileSync(generatedPath, JSON.stringify(generatedSet, null, 2));
    console.log(`   Saved to: ${generatedPath}\n`);
  } else {
    const querySet = loadQuerySet(querySetName);
    console.log(`📋 Loaded ${querySet.queries.length} queries from ${querySetName}.json\n`);
    queries = querySet.queries.map(q => ({ query: q.query, intent: q.intent }));
  }

  // ... rest of main function continues with evaluation loop
```

**Step 3: Add baseline comparison to output**

Add after the summary generation in main():
```typescript
  // Compare to baseline
  if (baseline && !isExplore) {
    console.log('\n📊 Comparison to Baseline:');
    const dims = ['relevance', 'ranking', 'coverage', 'snippetQuality', 'overall'] as const;

    for (const dim of dims) {
      const current = summary.averageScores[dim];
      const base = baseline.scores[dim];
      const diff = current - base;
      const diffStr = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      const indicator = diff < -baseline.thresholds.regression ? '❌' :
                       diff > baseline.thresholds.improvement ? '✅' : '  ';
      console.log(`   ${dim.padEnd(15)} ${current.toFixed(2)}  (${diffStr}) ${indicator}`);
    }

    const hasRegression = dims.some(d =>
      summary.averageScores[d] - baseline.scores[d] < -baseline.thresholds.regression
    );

    if (hasRegression) {
      console.log('\n⚠️  REGRESSION DETECTED - scores dropped below threshold');
    } else {
      console.log('\n✅ No regressions detected');
    }
  }

  // Update baseline if requested
  if (updateBaseline) {
    saveBaseline(summary.averageScores, config);
  }
```

**Step 4: Add writeFileSync to imports**

Update the fs import at the top:
```typescript
import { readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
```

**Step 5: Commit**

```bash
git add tests/scripts/search-quality.ts
git commit -m "feat: add query set support and baseline comparison"
```

---

### Task 11: Add NPM Scripts

**Files:**
- Modify: `package.json`

**Step 1: Add new scripts**

Add to the scripts section of `package.json`:
```json
"test:corpus:index": "npx tsx tests/scripts/corpus-index.ts",
"test:search-quality": "npx tsx tests/scripts/search-quality.ts",
"test:search-quality:explore": "npx tsx tests/scripts/search-quality.ts --explore",
"test:search-quality:baseline": "npx tsx tests/scripts/search-quality.ts --update-baseline"
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add corpus and quality testing npm scripts"
```

---

### Task 12: Test the Full Pipeline

**Step 1: Build the project**

```bash
npm run build
```

**Step 2: Index the corpus**

```bash
npm run test:corpus:index
```

Expected output:
```
🔧 Corpus Index Setup
   Store: bluera-test-corpus
   Corpus: .../tests/fixtures/corpus

📌 Creating test store...
📌 Indexing corpus...
📌 Verifying store...

✅ Corpus indexed successfully!
```

**Step 3: Run quality tests**

```bash
npm run test:search-quality
```

Expected output:
```
🚀 AI Search Quality Testing
   Run ID: xxxxxxxx
   Query set: core
   Search mode: hybrid
   Stores: bluera-test-corpus

📋 Loaded 15 queries from core.json

📊 Evaluating search quality...
  [1/15] "zod schema validation" - overall: 0.XX
  ...

✓ Results written to tests/quality-results/YYYY-MM-DDTHH-MM-SS.jsonl
📈 Average overall score: X.XX
```

**Step 4: Set baseline**

```bash
npm run test:search-quality:baseline
```

**Step 5: Run again to see comparison**

```bash
npm run test:search-quality
```

Expected: Shows baseline comparison with +/- indicators.

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from integration testing"
```

---

### Task 13: Final Verification and Cleanup

**Step 1: Verify all files committed**

```bash
git status
```

Should show clean working tree.

**Step 2: Run full test suite**

```bash
npm run test:run
```

All existing tests should pass.

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: phase 1 search quality testing complete"
```
