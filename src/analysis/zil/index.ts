/**
 * ZIL (Zork Implementation Language) Support
 *
 * Provides full graph support for ZIL source files:
 * - Lexer: Tokenizes ZIL syntax
 * - Parser: Extracts symbols, imports, and calls
 * - Adapter: Implements LanguageAdapter interface
 *
 * @example
 * ```typescript
 * import { ZilAdapter } from './zil/index.js';
 * import { AdapterRegistry } from './adapter-registry.js';
 *
 * // Register ZIL support
 * const registry = AdapterRegistry.getInstance();
 * registry.register(new ZilAdapter());
 * ```
 */

export { ZilLexer, TokenType, type Token } from './zil-lexer.js';
export {
  ZilParser,
  type ZilForm,
  type ZilNode,
  type ZilSymbol,
  type ZilCall,
} from './zil-parser.js';
export { ZilAdapter } from './zil-adapter.js';
export {
  ZIL_SPECIAL_FORMS,
  ZIL_DEFINITION_FORMS,
  isSpecialForm,
  isDefinitionForm,
} from './zil-special-forms.js';
