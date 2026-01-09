import path from 'node:path';
import { AdapterRegistry } from './adapter-registry.js';
import { ASTParser, type CodeNode } from './ast-parser.js';
import { GoASTParser } from './go-ast-parser.js';
import { PythonASTParser } from './python-ast-parser.js';
import { RustASTParser } from './rust-ast-parser.js';
import type { PythonBridge } from '../crawl/bridge.js';

export class ParserFactory {
  constructor(private readonly pythonBridge?: PythonBridge) {}

  async parseFile(filePath: string, code: string): Promise<CodeNode[]> {
    const ext = path.extname(filePath);

    if (['.ts', '.tsx'].includes(ext)) {
      const parser = new ASTParser();
      return parser.parse(code, 'typescript');
    }

    if (['.js', '.jsx'].includes(ext)) {
      const parser = new ASTParser();
      return parser.parse(code, 'javascript');
    }

    if (ext === '.py') {
      if (!this.pythonBridge) {
        throw new Error('Python bridge not available for parsing Python files');
      }
      const parser = new PythonASTParser(this.pythonBridge);
      return parser.parse(code, filePath);
    }

    if (ext === '.rs') {
      const parser = new RustASTParser();
      return parser.parse(code, filePath);
    }

    if (ext === '.go') {
      const parser = new GoASTParser();
      return parser.parse(code, filePath);
    }

    // Check for registered language adapters
    const registry = AdapterRegistry.getInstance();
    const adapter = registry.getByExtension(ext);
    if (adapter !== undefined) {
      return adapter.parse(code, filePath);
    }

    return [];
  }
}
