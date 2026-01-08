import type { CodeNode } from './ast-parser.js';
import type { PythonBridge, ParsePythonResult } from '../crawl/bridge.js';

export class PythonASTParser {
  constructor(private readonly bridge: PythonBridge) {}

  async parse(code: string, filePath: string): Promise<CodeNode[]> {
    const result: ParsePythonResult = await this.bridge.parsePython(code, filePath);

    return result.nodes.map((node) => {
      const codeNode: CodeNode = {
        type: node.type,
        name: node.name,
        exported: node.exported,
        startLine: node.startLine,
        endLine: node.endLine,
      };

      if (node.async !== undefined) {
        codeNode.async = node.async;
      }

      if (node.signature !== undefined) {
        codeNode.signature = node.signature;
      }

      if (node.methods !== undefined) {
        codeNode.methods = node.methods;
      }

      return codeNode;
    });
  }
}
