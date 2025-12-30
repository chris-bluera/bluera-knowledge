---
name: suggest
description: Suggest important dependencies to add to knowledge stores
allowed-tools: [Read, Bash]
---

Analyzes project dependencies and suggests important libraries to clone and index.

Usage:
```
/ckb:suggest
```

Scans:
- `package.json` (Node.js projects)
- `requirements.txt` / `pyproject.toml` (Python projects)
- `Cargo.toml` (Rust projects)
- Other dependency manifests

Suggests adding **major dependencies** only - frameworks, core libraries, not every package.

Example output:
```
Suggested repositories to add:

vue - Core framework for this Vue.js project
  Command: /ckb:add-repo https://github.com/vuejs/core --name=vue

pinia - State management library (heavily used)
  Command: /ckb:add-repo https://github.com/vuejs/pinia --name=pinia

Not suggesting: 127 other dependencies (too minor/specific)
```
