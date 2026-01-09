/**
 * ZIL Special Forms and Builtins
 *
 * These are NOT treated as function calls when building the call graph.
 * Special forms are control flow, assignment, and predicates.
 * Builtins are runtime primitives.
 */

/**
 * Special forms - language-level constructs, not function calls
 */
export const ZIL_SPECIAL_FORMS = new Set([
  // Conditionals
  'COND',
  'AND',
  'OR',
  'NOT',
  'IF',
  'ELSE',

  // Assignment
  'SET',
  'SETG',
  'BIND',
  'PROG',

  // Loops
  'REPEAT',
  'DO',
  'MAP',
  'MAPF',
  'MAPR',
  'MAPRET',
  'MAPLEAVE',

  // Output
  'TELL',
  'PRINT',
  'PRINTN',
  'PRINTD',
  'PRINTC',
  'PRINTR',
  'CRLF',

  // Control flow
  'RETURN',
  'AGAIN',
  'RTRUE',
  'RFALSE',
  'QUIT',

  // Predicates (end with ?)
  'EQUAL?',
  'ZERO?',
  'LESS?',
  'GRTR?',
  'FSET?',
  'IN?',
  'VERB?',
  'PRSO?',
  'PRSI?',
  'HELD?',
  'HERE?',
  'ACCESSIBLE?',
  'VISIBLE?',
  'FIRST?',
  'NEXT?',
  'PROB?',
  'RANDOM',

  // Property/flag manipulation
  'FSET',
  'FCLEAR',
  'GETP',
  'PUTP',
  'GETPT',
  'PTSIZE',

  // Object manipulation
  'MOVE',
  'REMOVE',
  'LOC',
  'FIRST',
  'NEXT',

  // Arithmetic
  'ADD',
  'SUB',
  'MUL',
  'DIV',
  'MOD',
  'BAND',
  'BOR',
  'BCOM',
  'LSH',

  // Table operations
  'GET',
  'PUT',
  'GETB',
  'PUTB',
  'TABLE',
  'ITABLE',
  'LTABLE',
  'PTABLE',

  // Stack operations
  'PUSH',
  'POP',
  'FSTACK',

  // Input
  'READ',
  'INPUT',
  'READLINE',

  // Definition forms (handled separately for symbol extraction)
  'ROUTINE',
  'OBJECT',
  'ROOM',
  'GLOBAL',
  'CONSTANT',
  'SYNTAX',
  'INSERT-FILE',

  // Misc builtins
  'VERSION?',
  'ASCII',
  'USL',
  'APPLY',
  'EVAL',
  'FORM',
  'REST',
  'LENGTH',
  'NTH',
  'ZGET',
  'ZPUT',
  'ZWSTR',
  'DIROUT',
  'DIRIN',
  'BUFOUT',
  'HLIGHT',
  'COLOR',
  'FONT',
  'SPLIT',
  'SCREEN',
  'WINGET',
  'WINPUT',
  'WINATTR',
  'PICINF',
  'DISPLAY',
  'DCLEAR',
  'SOUND',
  'INTBL?',
  'CATCH',
  'THROW',
  'LEGAL?',
  'COPYT',
  'VALUE',
  'GASSIGNED?',
  'ASSIGNED?',
  'DEFINE',
  'DEFMAC',
]);

/**
 * Check if a form head is a special form or builtin
 */
export function isSpecialForm(name: string): boolean {
  return ZIL_SPECIAL_FORMS.has(name.toUpperCase());
}

/**
 * Definition forms that create symbols
 */
export const ZIL_DEFINITION_FORMS = new Set([
  'ROUTINE',
  'OBJECT',
  'ROOM',
  'GLOBAL',
  'CONSTANT',
  'SYNTAX',
  'VERB',
  'DEFINE',
  'DEFMAC',
]);

/**
 * Check if a form head is a definition form
 */
export function isDefinitionForm(name: string): boolean {
  return ZIL_DEFINITION_FORMS.has(name.toUpperCase());
}
