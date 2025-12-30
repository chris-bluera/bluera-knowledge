---
name: add-folder
description: Index a local folder of reference material
arguments:
  - name: path
    description: Absolute or relative path
    required: true
  - name: --name
    description: Store name (adds to existing if name matches)
    required: false
allowed-tools: [Bash]
---

Indexes local documentation or reference material.

Usage:
```
/ckb:add-folder ~/docs/api-reference --name=docs
/ckb:add-folder ./local-libs/custom-framework --name=framework
```

**Use cases**:
- **Specifications**: Add requirements docs, API specs, RFC files
- **Documentation**: Add design docs, architecture guides, ADRs
- **Reference material**: Add coding standards, best practices, examples
- **Non-code content**: Add markdown docs, research papers, diagrams

**Store behavior**: Same as add-repo - adds to existing store if `--name` matches.

**Note**: Files/folders don't need to be code - CKB works with any text content (markdown, JSON, YAML, plain text, etc.).
