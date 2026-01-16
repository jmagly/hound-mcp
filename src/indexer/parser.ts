/**
 * Tree-sitter parser wrapper for symbol extraction
 *
 * Uses web-tree-sitter (WASM) for cross-platform compatibility.
 * Downloads and caches grammar files on first use.
 */

import { Parser, Language, Query, type Node } from 'web-tree-sitter';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type SupportedLanguage,
  type Symbol,
  type SymbolKind,
  LANGUAGE_CONFIGS,
  getLanguageFromExtension,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Grammar WASM CDN URLs
 * Note: Some languages don't have prebuilt WASM on npm - marked as empty
 */
const GRAMMAR_CDN_URLS: Record<SupportedLanguage, string> = {
  typescript: 'https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-typescript.wasm',
  javascript: 'https://cdn.jsdelivr.net/npm/tree-sitter-javascript@0.23.1/tree-sitter-javascript.wasm',
  python: 'https://cdn.jsdelivr.net/npm/tree-sitter-python@0.23.5/tree-sitter-python.wasm',
  go: 'https://cdn.jsdelivr.net/npm/tree-sitter-go@0.23.4/tree-sitter-go.wasm',
  rust: 'https://cdn.jsdelivr.net/npm/tree-sitter-rust@0.23.2/tree-sitter-rust.wasm',
  solidity: 'https://cdn.jsdelivr.net/npm/tree-sitter-solidity@1.2.13/tree-sitter-solidity.wasm',
  csharp: 'https://cdn.jsdelivr.net/npm/tree-sitter-c-sharp@0.23.1/tree-sitter-c_sharp.wasm',
  fsharp: '', // No prebuilt WASM available on npm
  vue: '',    // No prebuilt WASM available on npm
  bash: 'https://cdn.jsdelivr.net/npm/tree-sitter-bash@0.23.3/tree-sitter-bash.wasm',
};

/**
 * Cache directory for downloaded grammars
 */
const CACHE_DIR = join(__dirname, '..', '..', '.cache', 'grammars');

/**
 * Initialize the parser
 */
let parserInitialized = false;
let initPromise: Promise<void> | null = null;

async function initParser(): Promise<void> {
  if (parserInitialized) return;
  if (initPromise) return initPromise;

  initPromise = Parser.init().then(() => {
    parserInitialized = true;
  });

  return initPromise;
}

/**
 * Loaded language parsers (cached after first load)
 */
const loadedLanguages = new Map<SupportedLanguage, Language>();

/**
 * Download a grammar WASM file if not cached
 */
async function downloadGrammar(language: SupportedLanguage): Promise<Uint8Array> {
  const config = LANGUAGE_CONFIGS[language];
  const cachePath = join(CACHE_DIR, config.wasmFile);

  // Check if this language has a WASM URL
  const url = GRAMMAR_CDN_URLS[language];
  if (!url) {
    throw new Error(`No prebuilt WASM available for ${language}`);
  }

  // Check cache first
  try {
    const buffer = await fs.readFile(cachePath);
    return new Uint8Array(buffer);
  } catch {
    // Not cached, download
  }

  // Ensure cache directory exists
  await fs.mkdir(CACHE_DIR, { recursive: true });

  // Try CDN
  console.error(`[parser] Downloading ${language} grammar from CDN...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${language} grammar: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(cachePath, buffer);
  console.error(`[parser] Cached ${language} grammar at ${cachePath}`);

  return new Uint8Array(arrayBuffer);
}

/**
 * Load a language grammar
 */
async function loadLanguage(language: SupportedLanguage): Promise<Language> {
  const cached = loadedLanguages.get(language);
  if (cached) return cached;

  await initParser();

  const wasmBuffer = await downloadGrammar(language);
  const lang = await Language.load(wasmBuffer);
  loadedLanguages.set(language, lang);

  return lang;
}

/**
 * Query patterns for extracting symbols from different languages
 */
interface SymbolPattern {
  query: string;
  kind: SymbolKind;
}

/**
 * Tree-sitter queries for JavaScript (subset that works in JS grammar)
 */
const JS_PATTERNS: SymbolPattern[] = [
  // Function declarations
  {
    query: '(function_declaration name: (identifier) @name) @func',
    kind: 'function',
  },
  // Arrow functions assigned to const
  {
    query: '(lexical_declaration (variable_declarator name: (identifier) @name value: (arrow_function))) @func',
    kind: 'function',
  },
  // Class declarations (JS uses identifier, not type_identifier)
  {
    query: '(class_declaration name: (identifier) @name) @class',
    kind: 'class',
  },
  // Method definitions
  {
    query: '(method_definition name: (property_identifier) @name) @method',
    kind: 'method',
  },
];

/**
 * Tree-sitter queries for TypeScript (includes TS-specific nodes)
 */
const TS_PATTERNS: SymbolPattern[] = [
  // Function declarations
  {
    query: '(function_declaration name: (identifier) @name) @func',
    kind: 'function',
  },
  // Arrow functions assigned to const
  {
    query: '(lexical_declaration (variable_declarator name: (identifier) @name value: (arrow_function))) @func',
    kind: 'function',
  },
  // Class declarations (TS uses type_identifier)
  {
    query: '(class_declaration name: (type_identifier) @name) @class',
    kind: 'class',
  },
  // Abstract class declarations
  {
    query: '(abstract_class_declaration name: (type_identifier) @name) @class',
    kind: 'class',
  },
  // Method definitions
  {
    query: '(method_definition name: (property_identifier) @name) @method',
    kind: 'method',
  },
  // Interface declarations
  {
    query: '(interface_declaration name: (type_identifier) @name) @interface',
    kind: 'interface',
  },
  // Type alias declarations
  {
    query: '(type_alias_declaration name: (type_identifier) @name) @type',
    kind: 'type',
  },
  // Enum declarations
  {
    query: '(enum_declaration name: (identifier) @name) @enum',
    kind: 'type',
  },
];

/**
 * Tree-sitter queries for Python
 */
const PYTHON_PATTERNS: SymbolPattern[] = [
  // Function definitions
  {
    query: '(function_definition name: (identifier) @name) @func',
    kind: 'function',
  },
  // Class definitions
  {
    query: '(class_definition name: (identifier) @name) @class',
    kind: 'class',
  },
];

/**
 * Tree-sitter queries for Go
 */
const GO_PATTERNS: SymbolPattern[] = [
  // Function declarations
  {
    query: '(function_declaration name: (identifier) @name) @func',
    kind: 'function',
  },
  // Method declarations
  {
    query: '(method_declaration name: (field_identifier) @name) @method',
    kind: 'method',
  },
  // Type declarations (struct)
  {
    query: '(type_declaration (type_spec name: (type_identifier) @name type: (struct_type))) @struct',
    kind: 'class',
  },
  // Type declarations (interface)
  {
    query: '(type_declaration (type_spec name: (type_identifier) @name type: (interface_type))) @interface',
    kind: 'interface',
  },
];

/**
 * Tree-sitter queries for Rust
 */
const RUST_PATTERNS: SymbolPattern[] = [
  // Function definitions
  {
    query: '(function_item name: (identifier) @name) @func',
    kind: 'function',
  },
  // Struct definitions
  {
    query: '(struct_item name: (type_identifier) @name) @struct',
    kind: 'class',
  },
  // Enum definitions
  {
    query: '(enum_item name: (type_identifier) @name) @enum',
    kind: 'type',
  },
  // Trait definitions
  {
    query: '(trait_item name: (type_identifier) @name) @trait',
    kind: 'interface',
  },
  // Impl blocks (methods)
  {
    query: '(impl_item (declaration_list (function_item name: (identifier) @name))) @method',
    kind: 'method',
  },
];

/**
 * Tree-sitter queries for Solidity
 */
const SOLIDITY_PATTERNS: SymbolPattern[] = [
  // Contract definitions
  {
    query: '(contract_declaration name: (identifier) @name) @contract',
    kind: 'class',
  },
  // Interface definitions
  {
    query: '(interface_declaration name: (identifier) @name) @interface',
    kind: 'interface',
  },
  // Function definitions
  {
    query: '(function_definition name: (identifier) @name) @func',
    kind: 'function',
  },
  // Event definitions
  {
    query: '(event_definition name: (identifier) @name) @event',
    kind: 'type',
  },
  // Struct definitions
  {
    query: '(struct_declaration name: (identifier) @name) @struct',
    kind: 'type',
  },
  // Modifier definitions
  {
    query: '(modifier_definition name: (identifier) @name) @modifier',
    kind: 'function',
  },
];

/**
 * Tree-sitter queries for C#
 */
const CSHARP_PATTERNS: SymbolPattern[] = [
  // Class declarations
  {
    query: '(class_declaration name: (identifier) @name) @class',
    kind: 'class',
  },
  // Interface declarations
  {
    query: '(interface_declaration name: (identifier) @name) @interface',
    kind: 'interface',
  },
  // Method declarations
  {
    query: '(method_declaration name: (identifier) @name) @method',
    kind: 'method',
  },
  // Struct declarations
  {
    query: '(struct_declaration name: (identifier) @name) @struct',
    kind: 'class',
  },
  // Enum declarations
  {
    query: '(enum_declaration name: (identifier) @name) @enum',
    kind: 'type',
  },
  // Property declarations
  {
    query: '(property_declaration name: (identifier) @name) @property',
    kind: 'variable',
  },
];

/**
 * Tree-sitter queries for F#
 */
const FSHARP_PATTERNS: SymbolPattern[] = [
  // Function definitions (let bindings)
  {
    query: '(function_or_value_defn (value_declaration_left (identifier_pattern (long_identifier (identifier) @name)))) @func',
    kind: 'function',
  },
  // Type definitions
  {
    query: '(type_definition (type_name (identifier) @name)) @type',
    kind: 'type',
  },
  // Module definitions
  {
    query: '(module_defn (identifier) @name) @module',
    kind: 'module',
  },
];

/**
 * Tree-sitter queries for Vue (extract script content)
 * Note: Vue files have script sections - we extract from those
 */
const VUE_PATTERNS: SymbolPattern[] = [
  // Function declarations in script
  {
    query: '(function_declaration name: (identifier) @name) @func',
    kind: 'function',
  },
  // Arrow functions
  {
    query: '(lexical_declaration (variable_declarator name: (identifier) @name value: (arrow_function))) @func',
    kind: 'function',
  },
  // Component definition (export default)
  {
    query: '(export_statement (object) @component) @export',
    kind: 'class',
  },
];

/**
 * Tree-sitter queries for Bash/Shell
 */
const BASH_PATTERNS: SymbolPattern[] = [
  // Function definitions
  {
    query: '(function_definition name: (word) @name) @func',
    kind: 'function',
  },
];

/**
 * Get query patterns for a language
 */
function getPatterns(language: SupportedLanguage): SymbolPattern[] {
  switch (language) {
    case 'typescript':
      return TS_PATTERNS;
    case 'javascript':
      return JS_PATTERNS;
    case 'python':
      return PYTHON_PATTERNS;
    case 'go':
      return GO_PATTERNS;
    case 'rust':
      return RUST_PATTERNS;
    case 'solidity':
      return SOLIDITY_PATTERNS;
    case 'csharp':
      return CSHARP_PATTERNS;
    case 'fsharp':
      return FSHARP_PATTERNS;
    case 'vue':
      return VUE_PATTERNS;
    case 'bash':
      return BASH_PATTERNS;
  }
}

/**
 * Extract symbols from source code
 */
export async function extractSymbols(
  sourceCode: string,
  filePath: string,
  repo: string,
  baseUrl?: string
): Promise<Symbol[]> {
  // Determine language from extension
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  const language = getLanguageFromExtension(ext);

  if (!language) {
    return []; // Unsupported language
  }

  // Load parser and language
  const lang = await loadLanguage(language);
  const parser = new Parser();
  parser.setLanguage(lang);

  // Parse source code
  const tree = parser.parse(sourceCode);
  if (!tree) {
    console.error(`[parser] Failed to parse ${filePath}`);
    return [];
  }

  const symbols: Symbol[] = [];

  // Extract symbols using patterns
  const patterns = getPatterns(language);

  for (const pattern of patterns) {
    try {
      const query = new Query(lang, pattern.query);
      const captures = query.captures(tree.rootNode);

      // Find name captures
      const nameCaptures = captures.filter((c) => c.name === 'name');

      for (const capture of nameCaptures) {
        const node = capture.node;
        const name = node.text;

        // Find the parent declaration node
        const parentNode = findParentDeclaration(node);

        // Extract signature from parent
        const signature = parentNode ? extractSignature(parentNode, language) : undefined;

        // Find parent class/module for scope
        const scope = findScope(node, language);

        // Build URL
        let url: string | undefined;
        if (baseUrl) {
          const line = node.startPosition.row + 1;
          url = `${baseUrl}/${repo}/src/branch/main/${filePath}#L${line}`;
        }

        symbols.push({
          name,
          kind: pattern.kind,
          line: node.startPosition.row + 1,
          endLine: (parentNode?.endPosition.row ?? node.endPosition.row) + 1,
          column: node.startPosition.column,
          file: filePath,
          repo,
          signature,
          scope,
          language,
          url,
        });
      }

      query.delete();
    } catch (err) {
      // Query pattern might not match this language version, skip
      console.error(`[parser] Query failed for ${pattern.kind}: ${err}`);
      continue;
    }
  }

  // Clean up
  tree.delete();
  parser.delete();

  return symbols;
}

/**
 * Find the parent declaration node
 */
function findParentDeclaration(node: Node): Node | null {
  let current: Node | null = node;
  while (current) {
    const type = current.type;
    if (
      type.includes('declaration') ||
      type.includes('definition') ||
      type === 'method_definition' ||
      type === 'type_spec'
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Extract a function/method signature
 */
function extractSignature(node: Node, language: SupportedLanguage): string | undefined {
  // Get first line of the node as signature
  const text = node.text;
  const firstLine = text.split('\n')[0];

  // Clean up the signature
  let sig = firstLine.trim();

  // For TS/JS, remove the body start
  if (language === 'typescript' || language === 'javascript') {
    sig = sig.replace(/\s*\{.*$/, '');
  }

  // For Python, remove the colon at end
  if (language === 'python') {
    sig = sig.replace(/:$/, '');
  }

  // Limit length
  if (sig.length > 100) {
    sig = sig.slice(0, 97) + '...';
  }

  return sig.length > 0 ? sig : undefined;
}

/**
 * Find the enclosing scope (class/module name)
 */
function findScope(node: Node, language: SupportedLanguage): string | undefined {
  let current: Node | null = node.parent;

  while (current) {
    // Check for class declaration
    if (current.type === 'class_declaration' || current.type === 'class_definition') {
      // Find the name child
      for (const child of current.children) {
        if (child.type === 'type_identifier' || child.type === 'identifier') {
          return child.text;
        }
      }
    }

    // Check for method receiver in Go
    if (language === 'go' && current.type === 'method_declaration') {
      const receiver = current.childForFieldName('receiver');
      if (receiver) {
        // Extract type from receiver
        const typeNodes = receiver.descendantsOfType('type_identifier');
        if (typeNodes.length > 0) {
          return typeNodes[0].text;
        }
      }
    }

    current = current.parent;
  }

  return undefined;
}

/**
 * Check if the parser is ready
 */
export function isParserReady(): boolean {
  return parserInitialized;
}

/**
 * Preload all language grammars
 */
export async function preloadGrammars(): Promise<void> {
  await initParser();

  const languages: SupportedLanguage[] = [
    'typescript',
    'javascript',
    'python',
    'go',
    'rust',
    'solidity',
    'csharp',
    'fsharp',
    'vue',
    'bash',
  ];

  for (const lang of languages) {
    // Skip languages without prebuilt WASM
    if (!GRAMMAR_CDN_URLS[lang]) {
      console.error(`[parser] Skipping ${lang} (no prebuilt WASM available)`);
      continue;
    }

    try {
      await loadLanguage(lang);
      console.error(`[parser] Loaded ${lang} grammar`);
    } catch (err) {
      console.error(`[parser] Failed to load ${lang} grammar: ${err}`);
    }
  }
}

export { getLanguageFromExtension };
