# Bugs Found During API Testing (v0.9.30)

## Fix Status

| Bug | Status | Tests Added | Notes |
|-----|--------|-------------|-------|
| #1 | **FIXED** | ✅ | URL detection in store.ts |
| #2 | **PARTIAL** | ✅ | Mutex crash - CLI only, not affecting plugin |
| #3 | **FIXED** | ✅ | Empty name validation added |

---

## Bug #1: `store create --type repo --source <url>` doesn't clone repos

**Status:** FIXED

**File:** `src/cli/commands/store.ts:58-65`

**Fix:** Added URL detection to route to `url` parameter instead of `path`:
```typescript
const isUrl = options.source.startsWith('http://') || options.source.startsWith('https://');
```

---

## Bug #2: Non-existent store lookup causes mutex crash (CLI only)

**Status:** PARTIALLY FIXED - Does not affect Claude Code plugin

**Note:** This bug only affects the npm CLI package, not the Claude Code plugin. The MCP server is a long-running process that doesn't call `destroyServices()` on each request.

**Fixes applied:**
1. Added `close()` method to LanceStore that calls `connection.close()`
2. Added try-catch around cleanup in `destroyServices()`
3. Moved `process.exit()` after `finally` block

**Remaining issue:** Native code mutex crash still occurs during CLI cleanup. This appears to be a race condition in LanceDB's native code during process exit.

---

## Bug #3: Empty store name accepted

**Status:** FIXED

**File:** `src/services/store.service.ts:39-42`

**Fix:** Added validation at start of `create()`:
```typescript
if (!input.name || input.name.trim() === '') {
  return err(new Error('Store name cannot be empty'));
}
```

---

## Files Modified

1. `src/cli/commands/store.ts` - Bug #1 fix (URL detection)
2. `src/db/lance.ts` - Bug #2 fix (added close() method)
3. `src/services/index.ts` - Bug #2 fix (cleanup with try-catch)
4. `src/services/store.service.ts` - Bug #3 fix (empty name validation)

---

## Test Results After Fixes

| Feature | Status |
|---------|--------|
| `store create --type repo --source <url>` | **FIXED** - Now clones correctly |
| Empty store name validation | **FIXED** - Returns error |
| Mutex crash on error (CLI) | PARTIAL - Still crashes but doesn't affect plugin |
