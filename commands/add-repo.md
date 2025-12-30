---
name: add-repo
description: Clone and index a library source repository
arguments:
  - name: url
    description: Git repository URL
    required: true
  - name: --name
    description: Store name (adds to existing if name matches)
    required: false
  - name: --branch
    description: Branch to clone
    required: false
allowed-tools: [Bash]
---

Clones a definitive library source repository for authoritative reference.

Usage:
```
/ckb:add-repo https://github.com/vuejs/core --name=vue
/ckb:add-repo https://github.com/pydantic/pydantic --name=pydantic --branch=main
```

**Use cases**:
- **Library sources**: Vue project → add Vue.js source, Pydantic project → add Pydantic
- **Documentation**: Add framework docs, design patterns, best practices
- **Reference repos**: Add example implementations, boilerplate projects

**Store behavior**:
- If `--name` matches existing store: Adds repo to that store
- If `--name` is new: Creates new store with that name
- If no `--name`: Uses repo name (e.g., "core" from vuejs/core)

Clones to `.bluera/claude-knowledge-base/repos/<store-name>/` making it accessible to both vector search and Grep/Read.
