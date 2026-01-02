import { parse, type ParserPlugin } from '@babel/parser';
import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

// Handle both ESM and CJS module formats
type TraverseFunction = (ast: t.File, visitor: Record<string, unknown>) => void;
function getTraverse(mod: unknown): TraverseFunction {
  if (typeof mod === 'function') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return mod as TraverseFunction;
  }
  if (mod !== null && typeof mod === 'object' && 'default' in mod) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const withDefault = mod as { default: unknown };
    if (typeof withDefault.default === 'function') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return withDefault.default as TraverseFunction;
    }
  }
  throw new Error('Invalid traverse module export');
}
const traverse = getTraverse(traverseModule);

export interface CodeNode {
  type: 'function' | 'class' | 'interface' | 'type' | 'const';
  name: string;
  exported: boolean;
  async?: boolean;
  startLine: number;
  endLine: number;
  signature?: string;
  methods?: Array<{
    name: string;
    async: boolean;
    signature: string;
    startLine: number;
    endLine: number;
  }>;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isType: boolean;
}

export class ASTParser {
  parse(code: string, language: 'typescript' | 'javascript'): CodeNode[] {
    try {
      const plugins: ParserPlugin[] = ['jsx'];
      if (language === 'typescript') {
        plugins.push('typescript');
      }

      const ast = parse(code, {
        sourceType: 'module',
        plugins
      });

      const nodes: CodeNode[] = [];

      traverse(ast, {
        FunctionDeclaration: (path: NodePath<t.FunctionDeclaration>) => {
          const node = path.node;
          if (!node.id) return;

          const exported = path.parent.type === 'ExportNamedDeclaration' ||
                          path.parent.type === 'ExportDefaultDeclaration';

          nodes.push({
            type: 'function',
            name: node.id.name,
            exported,
            async: node.async,
            startLine: node.loc?.start.line ?? 0,
            endLine: node.loc?.end.line ?? 0,
            signature: this.extractFunctionSignature(node)
          });
        },

        ClassDeclaration: (path: NodePath<t.ClassDeclaration>) => {
          const node = path.node;
          if (!node.id) return;

          const exported = path.parent.type === 'ExportNamedDeclaration' ||
                          path.parent.type === 'ExportDefaultDeclaration';

          const methods: CodeNode['methods'] = [];

          for (const member of node.body.body) {
            if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
              methods.push({
                name: member.key.name,
                async: member.async,
                signature: this.extractMethodSignature(member),
                startLine: member.loc?.start.line ?? 0,
                endLine: member.loc?.end.line ?? 0
              });
            }
          }

          nodes.push({
            type: 'class',
            name: node.id.name,
            exported,
            startLine: node.loc?.start.line ?? 0,
            endLine: node.loc?.end.line ?? 0,
            methods
          });
        },

        TSInterfaceDeclaration: (path: NodePath<t.TSInterfaceDeclaration>) => {
          const node = path.node;

          const exported = path.parent.type === 'ExportNamedDeclaration';

          nodes.push({
            type: 'interface',
            name: node.id.name,
            exported,
            startLine: node.loc?.start.line ?? 0,
            endLine: node.loc?.end.line ?? 0
          });
        }
      });

      return nodes;
    } catch {
      // Return empty array for malformed code
      return [];
    }
  }

  extractImports(code: string): ImportInfo[] {
    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      const imports: ImportInfo[] = [];

      traverse(ast, {
        ImportDeclaration: (path: NodePath<t.ImportDeclaration>) => {
          const node = path.node;
          const specifiers: string[] = [];

          for (const spec of node.specifiers) {
            if (t.isImportDefaultSpecifier(spec)) {
              specifiers.push(spec.local.name);
            } else if (t.isImportSpecifier(spec)) {
              specifiers.push(spec.local.name);
            } else if (t.isImportNamespaceSpecifier(spec)) {
              specifiers.push(spec.local.name);
            }
          }

          imports.push({
            source: node.source.value,
            specifiers,
            isType: node.importKind === 'type'
          });
        }
      });

      return imports;
    } catch {
      // Return empty array for malformed code
      return [];
    }
  }

  private extractFunctionSignature(node: t.FunctionDeclaration): string {
    const params = node.params.map(p => {
      if (t.isIdentifier(p)) return p.name;
      return 'param';
    }).join(', ');

    return `${node.id?.name ?? 'anonymous'}(${params})`;
  }

  private extractMethodSignature(node: t.ClassMethod): string {
    const params = node.params.map(p => {
      if (t.isIdentifier(p)) return p.name;
      return 'param';
    }).join(', ');

    const name = t.isIdentifier(node.key) ? node.key.name : 'method';
    return `${name}(${params})`;
  }
}
