# Symbol-Aware Code Search: Research Synthesis & Solution Options

**Issue:** #16 - P1: Add symbol-aware search (functions, classes, definitions)
**Date:** 2026-01-15
**Status:** Awaiting Approval

---

## Executive Summary

After comprehensive research across 20+ tools and technologies, we've identified **3 viable implementation paths** for adding symbol-aware search. The key finding is that **modifying Hound is NOT feasible** - it's a monolithic trigram-only engine with no extension points.

**Recommendation:** Extend mcp-hound with tree-sitter-based symbol extraction.

---

## Research Findings

### 1. Hound Extensibility Assessment

| Criterion | Finding |
|-----------|---------|
| Plugin support | None - monolithic design |
| Index format | Trigram-only, no metadata fields |
| Extension points | Zero - hard-coded workflows |
| Maintenance status | Low activity (2 commits/year) |
| Modification effort | 6-9 weeks, 40% code rewrite |

**Verdict:** ❌ Not viable to extend Hound directly

### 2. Symbol Extraction Technologies

| Technology | License | Languages | Speed | Accuracy | Verdict |
|------------|---------|-----------|-------|----------|---------|
| **tree-sitter** | MIT | 50+ | Fast | Full AST | ✅ Best |
| universal-ctags | GPLv2 | 135+ | Fast | Good | ⚠️ OK |
| LSP servers | Various | Per-lang | Slow | Excellent | ❌ Complex |

**Winner:** Tree-sitter (MIT license, full AST, proven at scale)

### 3. Existing OSS Tools

| Tool | License | MCP-Native | Status | Viable? |
|------|---------|------------|--------|---------|
| Sourcegraph | Proprietary | No | Active | ❌ No |
| deepcontext-mcp | Apache 2.0 | Yes | Active | ✅ Yes |
| code-index-mcp | MIT | Yes | Active | ✅ Yes |
| ast-grep | MIT | Wrappable | Active | ✅ Yes |
| Zoekt | Apache 2.0 | Wrappable | Active | ✅ Yes |
| OpenGrok | CDDL 1.0 | No | Active | ⚠️ Heavy |

---

## Solution Options

### Option A: Extend mcp-hound (Recommended)

**Add `hound_search_symbol` tool to existing mcp-hound MCP server.**

```
mcp-hound
├── hound_search        (existing - text regex)
├── hound_repos         (existing - list repos)
├── hound_file_context  (existing - line context)
├── hound_repo_stats    (new - statistics)
└── hound_search_symbol (NEW - symbol search)
```

**Architecture:**
```
Hound Server ───────────► Text Search (trigram)
     │
mcp-hound ─┬─► HoundClient
           │
           └─► SymbolIndexer (tree-sitter)
                    │
                    └─► SQLite/JSON symbol index
```

**Technology:**
- Parser: tree-sitter (MIT, Node.js bindings)
- Storage: SQLite or in-memory JSON
- Languages: TypeScript, JavaScript, Python, Go, Rust, Java, C/C++

**Effort:** 2-3 weeks
**Complexity:** Medium

**Pros:**
- Single MCP server (no new infrastructure)
- Consistent API surface
- Shares authentication/config with existing tools
- MIT-licensed dependencies

**Cons:**
- Adds complexity to mcp-hound
- Symbol index separate from Hound's text index
- Dual indexing (Hound + symbols)

---

### Option B: Adopt Existing MCP Server

**Deploy `code-index-mcp` or `deepcontext-mcp` alongside mcp-hound.**

**deepcontext-mcp:**
- Apache 2.0 license
- Hybrid vector + BM25 search
- TypeScript/Python/JavaScript
- 254 GitHub stars

**code-index-mcp:**
- MIT license
- 50+ languages (tree-sitter + fallback)
- 675 GitHub stars
- Advanced search features

**Architecture:**
```
Claude ─┬─► mcp-hound (text search)
        │
        └─► code-index-mcp (symbol search)
```

**Effort:** 1-2 days (deployment only)
**Complexity:** Low

**Pros:**
- Minimal development effort
- Proven implementations
- Active maintenance

**Cons:**
- Two separate MCP servers
- Different APIs/configuration
- May not integrate with existing Hound index
- Limited customization

---

### Option C: New Standalone MCP Server

**Create `mcp-symbols` as a dedicated symbol search MCP server.**

**Architecture:**
```
mcp-symbols/
├── src/
│   ├── index.ts         # MCP server
│   ├── indexer/
│   │   ├── treesitter.ts # tree-sitter parsing
│   │   └── watcher.ts    # file system watcher
│   ├── storage/
│   │   └── sqlite.ts     # symbol storage
│   └── tools/
│       ├── search.ts     # symbol_search
│       ├── definition.ts # symbol_definition
│       └── references.ts # symbol_references
```

**Tools:**
```
symbol_search      - Find symbols by name/type
symbol_definition  - Go to definition
symbol_references  - Find usages
symbol_hierarchy   - Class/interface hierarchy
```

**Effort:** 3-4 weeks
**Complexity:** Medium-High

**Pros:**
- Clean separation of concerns
- Full control over implementation
- Can evolve independently
- Best long-term architecture

**Cons:**
- New repository to maintain
- Separate deployment
- Duplication with existing tools

---

## Comparison Matrix

| Criterion | Option A (Extend) | Option B (Adopt) | Option C (New MCP) |
|-----------|-------------------|------------------|-------------------|
| Development effort | 2-3 weeks | 1-2 days | 3-4 weeks |
| Maintenance burden | Medium | Low | High |
| Integration quality | High | Medium | Medium |
| Customization | Full | Limited | Full |
| License risk | None (MIT) | None | None |
| Long-term viability | Good | Depends on upstream | Excellent |
| Test coverage target | 70%+ achievable | N/A | 70%+ achievable |

---

## Recommendation

### **Option A: Extend mcp-hound** ⭐

**Rationale:**
1. **Unified experience** - Single MCP server for all code search
2. **Moderate effort** - 2-3 weeks, not over-engineered
3. **Full control** - Can customize for our specific needs
4. **Shared infrastructure** - Uses existing auth, config, deployment
5. **MIT licensing** - tree-sitter and all dependencies are MIT

**Implementation Plan:**

| Week | Tasks |
|------|-------|
| 1 | Tree-sitter integration, symbol extraction for top languages |
| 2 | Symbol storage (SQLite), search tool implementation |
| 3 | Testing (70%+ coverage), documentation, deployment |

**Deliverables:**
- `hound_search_symbol` tool
- Symbol index for TypeScript, JavaScript, Python, Go
- 70%+ test coverage
- Updated documentation

---

## Required Resources

### For Option A (Recommended)

**Dependencies (all MIT/Apache 2.0):**
- `tree-sitter` - Parser library
- `tree-sitter-typescript` - TS/JS grammar
- `tree-sitter-python` - Python grammar
- `tree-sitter-go` - Go grammar
- `better-sqlite3` - SQLite bindings

**No new repositories needed** - extends existing mcp-hound

**No new network resources** - uses existing Hound server

---

## Approval Request

Please approve one of the following:

- [ ] **Option A:** Extend mcp-hound with tree-sitter symbol search (Recommended)
- [ ] **Option B:** Deploy existing code-index-mcp alongside mcp-hound
- [ ] **Option C:** Create new mcp-symbols MCP server

---

## Appendix: Symbol Types to Support

| Symbol Type | Description | Priority |
|-------------|-------------|----------|
| function | Standalone functions | P1 |
| class | Class definitions | P1 |
| method | Class methods | P1 |
| interface | Interface definitions | P1 |
| type | Type aliases | P2 |
| variable | Module-level variables | P2 |
| constant | Constants/enums | P2 |
| module | Module/namespace | P3 |

## Appendix: Query API Design

```typescript
// Tool: hound_search_symbol
{
  name: string,           // Symbol name (supports wildcards)
  kind?: SymbolKind,      // function | class | method | ...
  repos?: string,         // Repository filter
  language?: string,      // Language filter
  limit?: number          // Max results (default: 20)
}

// Response
{
  results: [{
    repo: string,
    file: string,
    line: number,
    kind: SymbolKind,
    name: string,
    signature?: string,   // Function signature
    scope?: string,       // Parent class/module
    url: string           // Gitea deep link
  }]
}
```
