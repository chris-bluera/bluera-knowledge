# When to Query CKB vs Current Project

## Query CKB When:

**Questions about libraries/dependencies:**
- "How does Vue's reactivity system work?"
- "What are Pydantic's built-in validators?"
- "How should I use Pino's child loggers?"
- "What middleware does Hono provide?"

**Reference material questions:**
- "What does the API spec say about authentication?"
- "What are the project requirements for error handling?"
- "How does the architecture doc describe the data flow?"
- "What coding standards apply to this project?"

**Learning library APIs:**
- Discovering available options/configs
- Finding usage examples from library itself
- Understanding internal implementation

**Verifying specifications:**
- Checking exact requirements
- Finding edge cases in specs
- Understanding design decisions

## Query Current Project (Grep/Read) When:

**Working on YOUR code:**
- "Where is the authentication middleware?"
- "Find all API endpoints"
- "Show me the database models"

**Debugging YOUR code:**
- Reading error traces
- Following call stacks
- Checking variable usage

## Setup First: Add Important Dependencies

Before CKB is useful, you need to add library sources:

```
/ckb:suggest                  # Get recommendations
/ckb:add-repo <url> --name=<lib>   # Add important libs
/ckb:stores                   # Verify what's indexed
```

## Mental Model

```
Current Project Files → Grep/Read directly
           vs
Library Sources (Vue, Pydantic, etc.) → CKB (vector search OR Grep/Read)
```

CKB gives you both ways to access library sources:
1. Semantic search for discovery
2. Grep/Read for precision

Use whichever works best for your question!
