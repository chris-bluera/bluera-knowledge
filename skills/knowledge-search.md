# Using Claude Knowledge Base (CKB)

CKB provides access to **definitive library sources** for your project dependencies.

## Purpose: Authoritative References, Not Project Search

**CKB is for**: Reference material and external sources
- **Library sources**: Clone Vue.js/Pydantic/Hono for authoritative API reference
- **Specifications**: Add project requirements, API specs, RFCs
- **Documentation**: Add design docs, architecture guides, research papers
- **Reference material**: Best practices, coding standards, examples

**CKB is NOT for**: Searching your current project code
- Use Grep/Read directly on project files
- CKB stores are for external reference material

## Two Ways to Access Library Sources

### 1. Vector Search (MCP or slash command)
Find concepts and patterns across library docs:
```
search_codebase("vue reactivity system")
/ckb:search "pydantic custom validators"
```

### 2. Direct File Access (Grep/Read)
Precise lookups in cloned library source:
```
Grep: pattern="defineReactive" path=".bluera/repos/vue/"
Read: .bluera/repos/pydantic/pydantic/validators.py
```

## Both Are Valid!

You can use **either or both** approaches on the same cloned repo:
- Vector search to discover relevant files
- Grep/Read to find specific functions/classes
- Or just Grep/Read if you know what you're looking for

## Example Workflow

User: "How does Vue's computed properties work internally?"

Claude:
1. Check stores: `list_stores` MCP tool → vue store exists
2. Vector search: `search_codebase("vue computed properties")` → finds computed.ts
3. Read file: `.bluera/repos/vue/packages/reactivity/src/computed.ts`
4. Grep for implementation: pattern="class ComputedRefImpl"
5. Explain with authoritative source code examples
