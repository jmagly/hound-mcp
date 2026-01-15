# Code Embeddings and Vector Search Research

**Research Date:** 2026-01-15
**Focus:** Semantic code search for MCP server
**Requirements:** Local/self-hosted, MIT/Apache licensed, Node.js/TypeScript compatible

## Executive Summary

**Recommendation:** Use **@xenova/transformers.js** with **jinaai/jina-embeddings-v2-base-code** model and **sqlite-vec** for vector storage.

**Rationale:**
- Transformers.js enables fully local embeddings with zero external dependencies
- Jina Code embeddings are specifically trained on 30+ programming languages
- sqlite-vec provides embedded vector search with no separate server required
- All components are MIT/Apache-2.0 licensed
- Complete solution runs in Node.js without cloud services

**Confidence:** High

---

## 1. Embedding Models for Code

### 1.1 Specialized Code Embedding Models

#### Jina Embeddings V2 Base Code (RECOMMENDED)

| Aspect | Details |
|--------|---------|
| **Model ID** | `jinaai/jina-embeddings-v2-base-code` |
| **Parameters** | 161M (0.2B) |
| **Languages** | English + 30 programming languages |
| **Context Length** | 8,192 tokens |
| **Dimensions** | 768 (typical for JinaBert) |
| **License** | Apache-2.0 |
| **Downloads** | Active usage on HuggingFace |

**Strengths:**
- Specifically trained for code understanding
- Supports Python, Java, JavaScript, C++, Rust, Go, and 25+ more languages
- Long context support (8,192 tokens) for large functions/classes
- Moderate size enables efficient local inference
- Works with transformers.js for Node.js deployment

**Weaknesses:**
- Larger than general-purpose models (161M vs 33M params)
- Requires more memory than smaller alternatives
- Not as widely deployed as CodeBERT

**Usage Example:**
```javascript
import { pipeline } from '@xenova/transformers';

const extractor = await pipeline(
  'feature-extraction',
  'jinaai/jina-embeddings-v2-base-code'
);

const code = `
function findDuplicates(arr) {
  return arr.filter((item, index) => arr.indexOf(item) !== index);
}`;

const embeddings = await extractor(code, {
  pooling: 'mean',
  normalize: true
});
```

---

#### CodeBERT

| Aspect | Details |
|--------|---------|
| **Model ID** | `microsoft/codebert-base` |
| **Parameters** | ~125M |
| **Languages** | Python, Java, JavaScript, PHP, Ruby, Go |
| **Dimensions** | 768 |
| **License** | MIT |
| **Maturity** | Production-ready, widely adopted |

**Strengths:**
- Pioneer in code embeddings (proven track record)
- MIT license (highly permissive)
- Strong performance on code search benchmarks
- Pre-trained on natural language + programming language pairs

**Weaknesses:**
- Limited to 6 programming languages
- Older architecture (2020)
- Less support for long context
- Requires ONNX conversion for transformers.js

**Recommendation:** Good fallback if Jina Code embeddings have issues, but Jina is more comprehensive.

---

### 1.2 General-Purpose Models (Suitable for Code)

#### BAAI BGE Series

| Model | Parameters | Dimensions | Use Case |
|-------|-----------|-----------|----------|
| `bge-small-en-v1.5` | 33.4M | 384 | Lightweight, fast inference |
| `bge-base-en-v1.5` | 109M | 768 | Balanced performance |
| `bge-large-en-v1.5` | 335M | 1024 | Highest quality |

**License:** Apache-2.0 (via model cards)
**Availability:** Xenova versions available for transformers.js

**Strengths:**
- Excellent general-purpose embeddings
- Very efficient (especially small variant)
- Strong community support
- Work well with transformers.js

**Weaknesses:**
- Not specifically trained for code
- May miss code-specific semantics
- Less effective for code-only queries

**When to Use:** If you need embeddings for mixed content (code + documentation + comments) or if code-specific models are too resource-intensive.

---

#### Nomic Embed Text v1.5

| Aspect | Details |
|--------|---------|
| **Model ID** | `nomic-ai/nomic-embed-text-v1.5` |
| **Parameters** | 137M |
| **Context Length** | 8,192 tokens |
| **Dimensions** | 768, 512, 256, 128 (Matryoshka) |
| **License** | Apache-2.0 |

**Strengths:**
- Matryoshka representation learning (flexible dimensions)
- Long context support
- Excellent for RAG applications
- Can run in transformers.js

**Weaknesses:**
- Not code-specific
- Requires task prefixes (`search_document:`, `search_query:`)
- Trained on general text, not code

**Recommendation:** Not ideal for code-only search, but good for mixed documentation/code retrieval.

---

### 1.3 Commercial/API-Only Options (NOT RECOMMENDED)

#### OpenAI Code Embeddings

**Status:** API-only, cannot be self-hosted
**Pricing:** ~$0.0001 per 1K tokens (text-embedding-3-small)
**License:** Proprietary, API terms apply

**Why Not:**
- Requires external API calls (not local)
- Ongoing costs per query
- Network dependency
- Data leaves your infrastructure

---

#### Voyage AI Code Embeddings

**Model:** `voyage-code-3`
**Status:** API-only (some AWS/Azure deployment options)
**Pricing:** Not publicly disclosed
**License:** Proprietary

**Why Not:**
- Not fully self-hosted
- Enterprise pricing required
- Limited to cloud deployment

---

## 2. Vector Databases for Storage

### 2.1 Embedded Options (No Server Required)

#### sqlite-vec (RECOMMENDED)

| Aspect | Details |
|--------|---------|
| **Type** | SQLite extension |
| **Language** | C (with Node.js bindings) |
| **Size** | ~200KB binary |
| **License** | MIT OR Apache-2.0 (dual licensed) |
| **npm Package** | `sqlite-vec` |
| **Version** | 0.1.7-alpha.2 (active development) |

**Key Features:**
- Pure C implementation, no external dependencies
- Works anywhere SQLite runs (Linux, macOS, Windows, WASM, mobile)
- Supports float, int8, and binary vectors
- Chunked storage for reduced RAM usage
- JSON and binary vector formats
- Built-in distance functions (L2, cosine, etc.)

**Performance Characteristics:**
- "Fast enough" philosophy (not optimized for billions of vectors)
- Currently uses exhaustive search (ANN/HNSW planned)
- Memory-mapped file support for acceleration
- Quantization support for efficiency

**API Usage (Node.js):**
```javascript
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const db = new Database('vectors.db');
sqliteVec.load(db);

// Create vector table
db.exec(`
  CREATE VIRTUAL TABLE code_embeddings USING vec0(
    file_path TEXT,
    function_name TEXT,
    embedding float[768]
  );
`);

// Insert vectors
const stmt = db.prepare(`
  INSERT INTO code_embeddings(file_path, function_name, embedding)
  VALUES (?, ?, ?)
`);
stmt.run('src/utils.ts', 'parseQuery', JSON.stringify(embedding));

// Search
const results = db.prepare(`
  SELECT file_path, function_name, distance
  FROM code_embeddings
  WHERE embedding MATCH ?
  ORDER BY distance
  LIMIT 10
`).all(JSON.stringify(queryEmbedding));
```

**Strengths:**
- Single-file database (easy backup/distribution)
- No separate server process
- Tight integration with SQLite's ACID properties
- Minimal resource footprint
- Cross-platform (including WASM)

**Weaknesses:**
- Alpha stage (API may change)
- No ANN indexing yet (only exhaustive search)
- Performance degrades with millions of vectors
- Limited compared to specialized vector DBs

**Recommendation:** Excellent choice for MCP server use case (thousands to tens of thousands of code chunks).

---

#### USearch

| Aspect | Details |
|--------|---------|
| **Type** | Standalone vector search library |
| **Algorithm** | HNSW (Hierarchical Navigable Small World) |
| **License** | Apache-2.0 |
| **npm Package** | `usearch` |
| **Languages** | 10+ (including JavaScript/Node.js) |

**Key Features:**
- Faster than FAISS (10x indexing speed claimed)
- Supports billions of vectors
- User-defined distance metrics
- Multiple data types (f64, f32, f16, i8, binary)
- Minimal dependencies

**Strengths:**
- Production-ready ANN search
- Excellent performance at scale
- Small codebase (~3,000 lines)
- Native bindings for Node.js

**Weaknesses:**
- More complex than sqlite-vec
- Requires separate index management
- No built-in persistence (need to save/load index)
- Larger dependency footprint

**When to Use:** If you need ANN search now or expect to scale beyond 100K vectors.

---

### 2.2 Server-Based Options (Not Ideal for MCP)

#### Chroma

| Aspect | Details |
|--------|---------|
| **Type** | Embedding database |
| **License** | Apache-2.0 |
| **npm Package** | `chromadb` |
| **Architecture** | Client-server (can run in-memory) |

**Strengths:**
- Simple API (4 core functions)
- Built-in embedding support
- Good documentation
- Active development

**Weaknesses:**
- Requires server process (even for "embedded" mode)
- Heavier than SQLite-based solutions
- JavaScript client talks to Python server
- More complex deployment

**Recommendation:** Not ideal for MCP server (adds deployment complexity).

---

#### Qdrant (JavaScript Client)

| Aspect | Details |
|--------|---------|
| **npm Package** | `@qdrant/js-client-rest` |
| **License** | Apache-2.0 |
| **Type** | Client for Qdrant server |

**Why Not:** Requires separate Qdrant server instance (not embedded).

---

## 3. Integration Approaches

### 3.1 Combining Tree-sitter with Embeddings

**Concept:** Use tree-sitter to parse code into AST nodes, then generate embeddings for semantic units (functions, classes, methods) rather than arbitrary text chunks.

**Tree-sitter npm Package:**
- `tree-sitter`: Node.js bindings (MIT license)
- `web-tree-sitter`: WebAssembly version

**Chunking Strategy:**

```javascript
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

const parser = new Parser();
parser.setLanguage(JavaScript);

const tree = parser.parse(sourceCode);

// Extract semantic units
const functions = tree.rootNode
  .descendantsOfType('function_declaration')
  .map(node => ({
    name: node.childForFieldName('name').text,
    code: node.text,
    startByte: node.startIndex,
    endByte: node.endIndex
  }));

// Generate embeddings for each function
for (const func of functions) {
  const embedding = await extractor(func.code, {
    pooling: 'mean',
    normalize: true
  });

  // Store in sqlite-vec
  insertEmbedding(func.name, func.code, embedding);
}
```

**Benefits:**
- Semantic chunking (functions/classes vs arbitrary splits)
- Preserves code structure
- Better search relevance
- Language-aware parsing

**Challenges:**
- Requires language-specific grammars
- Large files need splitting strategy
- Functions may exceed token limits

---

### 3.2 Hybrid Search: Hound + Embeddings

**Strategy:** Combine Hound's regex/literal search with semantic embeddings.

**Use Cases:**
1. **Exact match fallback:** Use Hound when query looks like regex/identifier
2. **Semantic expansion:** Use embeddings to find conceptually similar code
3. **Re-ranking:** Use Hound for initial candidates, embeddings for relevance scoring

**Implementation:**
```javascript
async function hybridSearch(query) {
  // Detect query type
  const isExact = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(query);

  if (isExact) {
    // Use Hound for exact symbol search
    return await houndSearch(query);
  }

  // Generate query embedding
  const queryEmbedding = await extractor(query, {
    pooling: 'mean',
    normalize: true
  });

  // Semantic search in sqlite-vec
  const semanticResults = await vectorSearch(queryEmbedding, limit: 20);

  // Optional: Re-rank with Hound exact matches
  return combineResults(semanticResults);
}
```

---

## 4. Comparison Matrix

### 4.1 Embedding Models Comparison

| Model | Size | Languages | Context | License | Code-Specific | Local | Recommendation |
|-------|------|-----------|---------|---------|--------------|-------|----------------|
| **Jina Code v2** | 161M | 30+ | 8,192 | Apache-2.0 | YES | YES | BEST for code |
| CodeBERT | 125M | 6 | 512 | MIT | YES | YES | Good fallback |
| BGE-small | 33M | English | 512 | Apache-2.0 | NO | YES | Fast, general |
| BGE-base | 109M | English | 512 | Apache-2.0 | NO | YES | Balanced |
| Nomic v1.5 | 137M | Multilingual | 8,192 | Apache-2.0 | NO | YES | RAG-optimized |
| OpenAI | N/A | Many | 8,191 | Proprietary | Partial | NO | Not recommended |
| Voyage Code | N/A | Many | 16,000 | Proprietary | YES | NO | Not recommended |

**Legend:**
- Size: Model parameters
- Languages: Programming languages supported
- Context: Maximum token length
- Code-Specific: Trained specifically for code understanding

---

### 4.2 Vector Database Comparison

| Database | Type | License | Server | Size | ANN | Persistence | Node.js | Recommendation |
|----------|------|---------|--------|------|-----|-------------|---------|----------------|
| **sqlite-vec** | Extension | MIT/Apache | NO | ~200KB | NO (planned) | SQLite file | YES | BEST for MCP |
| USearch | Library | Apache-2.0 | NO | Medium | YES (HNSW) | Manual | YES | For scale |
| Chroma | Embedded DB | Apache-2.0 | YES | Large | YES | Files | Client only | Too complex |
| Qdrant | Vector DB | Apache-2.0 | YES | Large | YES | RocksDB | Client only | Too complex |

**Legend:**
- Type: Architecture approach
- Server: Requires separate server process
- Size: Binary/dependency footprint
- ANN: Approximate nearest neighbor search
- Persistence: How data is stored

---

## 5. Licensing Considerations

### 5.1 Free to Use Models

| Model | License | Commercial Use | Attribution | Restrictions |
|-------|---------|----------------|-------------|--------------|
| Jina Code v2 | Apache-2.0 | YES | Required | None significant |
| CodeBERT | MIT | YES | Required | None significant |
| BGE Series | Apache-2.0 | YES | Required | None significant |
| Nomic v1.5 | Apache-2.0 | YES | Required | None significant |

**All recommended open-source models:**
- Allow commercial use
- Require attribution in notices
- No per-query costs
- No rate limits

---

### 5.2 Rate Limits and Costs

#### Local Models (Recommended)
- **Cost:** $0 per query (after initial compute)
- **Rate Limits:** None (only limited by local compute)
- **Privacy:** Data never leaves your infrastructure

#### API Models (Not Recommended)
- **OpenAI:** ~$0.0001 per 1K tokens + rate limits
- **Voyage:** Enterprise pricing, contact sales
- **Privacy:** Data sent to third-party servers

**For MCP Server Use Case:**
- Initial indexing: One-time compute cost
- Query-time: Minimal cost (single embedding generation)
- No ongoing API fees
- Complete privacy

---

## 6. Implementation Recommendations

### 6.1 Recommended Stack

```
Code → Tree-sitter → Chunks → Transformers.js → Embeddings → sqlite-vec
                                (Jina Code v2)              (Vector Search)
```

**Dependencies:**
```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.2",
    "sqlite-vec": "^0.1.7-alpha.2",
    "better-sqlite3": "^11.0.0",
    "tree-sitter": "^0.25.0",
    "tree-sitter-javascript": "^0.21.0",
    "tree-sitter-typescript": "^0.21.0",
    "tree-sitter-python": "^0.21.0"
  }
}
```

**Total Package Size:** ~50-100MB (mostly models)
**License Compatibility:** All MIT or Apache-2.0

---

### 6.2 Architecture

```
┌─────────────────────────────────────────────────────┐
│  MCP Server (mcp-hound)                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐        ┌─────────────────┐       │
│  │ Query        │───────▶│ Hybrid Router   │       │
│  └──────────────┘        └─────────────────┘       │
│                                 │                    │
│                  ┌──────────────┴──────────────┐    │
│                  ▼                              ▼    │
│          ┌──────────────┐             ┌─────────────┐│
│          │ Hound Search │             │ Semantic    ││
│          │ (Exact Match)│             │ Search      ││
│          └──────────────┘             │             ││
│                                       │ ┌─────────┐ ││
│                                       │ │Embed    │ ││
│                                       │ │Query    │ ││
│                                       │ └────┬────┘ ││
│                                       │      │      ││
│                                       │ ┌────▼────┐ ││
│                                       │ │sqlite-  │ ││
│                                       │ │vec      │ ││
│                                       │ └─────────┘ ││
│                                       └─────────────┘│
│                                                      │
│  Indexing Pipeline:                                 │
│  ┌────────────┐  ┌───────────┐  ┌───────────┐     │
│  │ Tree-      │─▶│ Chunk     │─▶│ Embed     │     │
│  │ sitter     │  │ Code      │  │ (Jina)    │     │
│  └────────────┘  └───────────┘  └─────┬─────┘     │
│                                        │            │
│                                   ┌────▼─────┐     │
│                                   │ Store in │     │
│                                   │sqlite-vec│     │
│                                   └──────────┘     │
└─────────────────────────────────────────────────────┘
```

---

### 6.3 Chunking Strategy

**Recommended Approach:** AST-based semantic chunking

```javascript
// Chunk by semantic units
const chunkStrategies = {
  // Top-level declarations
  function_declaration: (node) => ({
    type: 'function',
    name: node.childForFieldName('name').text,
    code: node.text,
    docstring: findDocstring(node)
  }),

  class_declaration: (node) => ({
    type: 'class',
    name: node.childForFieldName('name').text,
    code: node.text,
    methods: node.descendantsOfType('method_definition')
  }),

  // Large functions: split by logical sections
  method_definition: (node) => {
    if (node.text.length > 2000) {
      return splitLargeFunction(node);
    }
    return { type: 'method', code: node.text };
  }
};
```

**Chunk Metadata:**
```javascript
{
  id: 'uuid',
  file_path: 'src/utils/parser.ts',
  chunk_type: 'function',
  name: 'parseQuery',
  start_line: 42,
  end_line: 67,
  language: 'typescript',
  embedding: [0.123, 0.456, ...], // 768-dim vector
  code: 'function parseQuery(query: string) { ... }',
  docstring: '// Parses a search query into AST'
}
```

---

### 6.4 Performance Considerations

**Initial Indexing:**
- Small repo (1K files): ~5-10 minutes
- Medium repo (10K files): ~30-60 minutes
- Large repo (100K files): ~3-5 hours

**Query Performance:**
- Embedding generation: ~50-100ms (CPU)
- Vector search (10K chunks): ~10-50ms
- Total query time: ~100-200ms

**Optimization Strategies:**
1. **Cache embeddings:** Don't re-embed unchanged files
2. **Incremental indexing:** Only index changed files
3. **Quantization:** Use int8 for smaller vectors (75% size reduction)
4. **Batch processing:** Embed multiple chunks in parallel

---

## 7. Risk Assessment and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Model incompatibility | Low | High | Test with Jina Code model early, fallback to BGE |
| sqlite-vec API changes | Medium | Medium | Pin version, monitor releases |
| Poor search quality | Medium | High | Hybrid approach with Hound, tuning |
| Performance issues | Medium | Medium | Incremental indexing, caching |
| Token limit exceeded | High | Low | Chunk large functions, truncate |
| Memory usage | Medium | Medium | Quantization, streaming |

**Critical Dependencies:**
- `@xenova/transformers`: Stable (v2.17.2, active maintenance)
- `sqlite-vec`: Alpha stage (monitor for breaking changes)
- `better-sqlite3`: Production-ready
- `tree-sitter`: Mature, stable

---

## 8. Implementation Roadmap

### Phase 1: Proof of Concept (1-2 weeks)
1. Set up transformers.js with Jina Code model
2. Generate embeddings for sample repository
3. Store in sqlite-vec
4. Basic semantic search API
5. Performance benchmarking

**Deliverable:** Working prototype with 100-1000 code chunks

---

### Phase 2: Production Ready (2-3 weeks)
1. Tree-sitter integration for AST-based chunking
2. Incremental indexing system
3. Hybrid search with Hound integration
4. Caching and optimization
5. Error handling and logging

**Deliverable:** MCP server with semantic search tool

---

### Phase 3: Optimization (1-2 weeks)
1. Quantization for reduced storage
2. Parallel embedding generation
3. Query result ranking
4. Performance tuning
5. Documentation and examples

**Deliverable:** Production-ready, optimized implementation

---

## 9. Alternative Approaches

### 9.1 If Local Embeddings Too Slow

**Option:** Use lighter model initially, upgrade later
- Start with BGE-small (33M params, 384-dim)
- 3x faster than Jina Code
- Still good quality for general code search
- Upgrade to Jina Code when performance acceptable

---

### 9.2 If sqlite-vec Immature

**Option:** Use USearch for production-ready ANN
- More complex setup
- Better performance at scale
- Requires manual persistence management
- HNSW indexing available now (not in sqlite-vec yet)

---

### 9.3 If Tree-sitter Too Complex

**Option:** Simple sliding window chunking
- Split by newlines and token count
- Overlap chunks by 20%
- Faster implementation
- Lower quality boundaries (may split functions)

---

## 10. Existing Implementations to Reference

### context-whisper MCP Server

**Repository:** `nicolas-costa/context_whisper`
**Stack:**
- Embeddings: `@xenova/transformers` with MiniLM-L6-v2 (384-dim)
- Vector DB: `sqlite-vec`
- Use case: Technical notes repository

**Key Learnings:**
- Demonstrates sqlite-vec integration in production MCP
- Shows transformers.js embedding pipeline
- Proves concept works for semantic search
- Similar architecture to our needs

**Differences:**
- Uses general-purpose model (not code-specific)
- Simpler chunking (document-level vs function-level)
- No tree-sitter integration

---

### memori-js

**npm Package:** `memori-js`
**Stack:** sqlite-vec + Google GenAI
**Use case:** AI memory fabric

**Key Learnings:**
- Shows sqlite-vec usage patterns
- Demonstrates RAG with sqlite
- Not code-specific (general memory)

---

## 11. References

### Models
- [Jina Embeddings V2 Base Code](https://huggingface.co/jinaai/jina-embeddings-v2-base-code)
- [CodeBERT](https://github.com/microsoft/CodeBERT)
- [BGE Embeddings](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [Transformers.js](https://github.com/xenova/transformers.js)

### Vector Databases
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [USearch](https://github.com/unum-cloud/usearch)
- [sqlite-vec blog post](https://alexgarcia.xyz/blog/2024/building-new-vector-search-sqlite/)

### Tools
- [Tree-sitter](https://tree-sitter.github.io/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

### Example Implementations
- [context-whisper](https://github.com/nicolas-costa/context_whisper)
- [MCP Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)

---

## 12. Next Steps

1. **Immediate Actions:**
   - Install `@xenova/transformers` and test Jina Code model
   - Set up sqlite-vec with sample data
   - Benchmark embedding generation speed
   - Test vector search quality

2. **Week 1 Goals:**
   - Working end-to-end prototype
   - Embed 1000 code snippets
   - Basic search functionality
   - Performance metrics

3. **Decision Points:**
   - [ ] Jina Code model quality acceptable?
   - [ ] sqlite-vec API stability acceptable?
   - [ ] Performance meets requirements (<500ms query)?
   - [ ] Need tree-sitter or simple chunking sufficient?

4. **Success Metrics:**
   - Embedding generation: <100ms per chunk (CPU)
   - Search latency: <200ms for top-10 results
   - Search quality: Relevant results in top 5
   - Memory usage: <500MB for 10K chunks

---

## Appendix A: Quick Start Code

### Install Dependencies
```bash
npm install @xenova/transformers sqlite-vec better-sqlite3 tree-sitter
```

### Generate Embeddings
```javascript
import { pipeline } from '@xenova/transformers';

// Initialize model (downloads on first run)
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/jina-embeddings-v2-base-code', // or use BGE-small for faster
  { quantized: true } // Use quantized model for speed
);

// Generate embedding
const code = `function hello() { console.log("world"); }`;
const result = await extractor(code, {
  pooling: 'mean',
  normalize: true
});

const embedding = Array.from(result.data);
console.log(`Generated ${embedding.length}-dim vector`);
```

### Store in sqlite-vec
```javascript
import Database from 'better-sqlite3';
import { load } from 'sqlite-vec';

const db = new Database('code_vectors.db');
load(db);

// Create table
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS code_embeddings USING vec0(
    file_path TEXT,
    chunk_id TEXT,
    embedding float[768]
  );
`);

// Insert
const insert = db.prepare(`
  INSERT INTO code_embeddings(file_path, chunk_id, embedding)
  VALUES (?, ?, ?)
`);
insert.run('src/hello.js', 'func_hello', JSON.stringify(embedding));

// Search
const search = db.prepare(`
  SELECT file_path, chunk_id, distance
  FROM code_embeddings
  WHERE embedding MATCH ?
  ORDER BY distance
  LIMIT 10
`);
const results = search.all(JSON.stringify(queryEmbedding));
```

---

## Appendix B: Model Download Sizes

| Model | Download Size | On-Disk Size | First Load Time |
|-------|--------------|--------------|-----------------|
| Jina Code v2 | ~160MB | ~640MB | 10-20s |
| BGE-small | ~30MB | ~130MB | 2-5s |
| BGE-base | ~110MB | ~440MB | 5-10s |
| CodeBERT | ~125MB | ~500MB | 5-10s |

**Note:** Transformers.js caches models in `~/.cache/huggingface/`, only downloads once.

---

**End of Research Report**
