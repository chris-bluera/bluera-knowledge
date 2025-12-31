---
description: Suggest important dependencies to add to knowledge stores
allowed-tools: ["Glob", "Read", "mcp__bluera-knowledge__list_stores", "WebSearch"]
---

# Suggest Dependencies to Index

Analyze project dependencies and suggest important libraries to add to knowledge stores.

## Steps

1. **Find dependency files** using Glob tool:
   - `**/package.json` (JavaScript/TypeScript projects)
   - `**/requirements.txt` (Python projects)
   - `**/go.mod` (Go projects)
   - `**/Cargo.toml` (Rust projects)

2. **Read and parse dependencies**:
   - Use Read tool to read each dependency file
   - Extract package names and usage patterns
   - For package.json: dependencies and devDependencies
   - For requirements.txt: all packages
   - For go.mod: require statements
   - For Cargo.toml: dependencies section

3. **Scan for import statements** using Glob + Read:
   - Find all source files (*.js, *.ts, *.py, *.go, *.rs)
   - Count imports/requires for each dependency
   - Rank dependencies by frequency of use

4. **Get existing stores** using mcp__bluera-knowledge__list_stores:
   - Filter out dependencies already in stores
   - Focus on new suggestions

5. **Find repository URLs** using WebSearch:
   - For top 5 most-used dependencies
   - Search for official GitHub/GitLab repositories
   - Prefer official repos over forks

6. **Display suggestions**:

```
## Dependency Analysis

Scanned 342 source files and found 24 dependencies.

### Top Dependencies by Usage

1. **react** (147 imports across 52 files)
   Repository: https://github.com/facebook/react

   Add with:
   ```
   /bluera-knowledge:add-repo https://github.com/facebook/react --name=react
   ```

2. **lodash** (89 imports across 31 files)
   Repository: https://github.com/lodash/lodash

   Add with:
   ```
   /bluera-knowledge:add-repo https://github.com/lodash/lodash --name=lodash
   ```

[Continue for top 5...]

---

Already indexed: typescript, express, jest
```

## If No Dependencies Found

```
No external dependencies found in this project.

Make sure you have a dependency manifest file:
- package.json (JavaScript/TypeScript)
- requirements.txt or pyproject.toml (Python)
- go.mod (Go)
- Cargo.toml (Rust)
```
