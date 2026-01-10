import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { ASTParser } from '../analysis/ast-parser.js';
import { CodeGraph, type GraphNode } from '../analysis/code-graph.js';
import { GoASTParser } from '../analysis/go-ast-parser.js';
import { ParserFactory } from '../analysis/parser-factory.js';
import { RustASTParser } from '../analysis/rust-ast-parser.js';
import type { PythonBridge } from '../crawl/bridge.js';
import type { StoreId } from '../types/brands.js';

interface SerializedGraph {
  nodes: Array<{
    id: string;
    file: string;
    type: string;
    name: string;
    exported: boolean;
    startLine: number;
    endLine: number;
    signature?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    confidence: number;
  }>;
}

/**
 * Service for building, persisting, and querying code graphs.
 * Code graphs track relationships between code elements (functions, classes, etc.)
 * for enhanced search context.
 */
export class CodeGraphService {
  private readonly dataDir: string;
  private readonly parser: ASTParser;
  private readonly parserFactory: ParserFactory;
  private readonly graphCache: Map<string, CodeGraph>;

  constructor(dataDir: string, pythonBridge?: PythonBridge) {
    this.dataDir = dataDir;
    this.parser = new ASTParser();
    this.parserFactory = new ParserFactory(pythonBridge);
    this.graphCache = new Map();
  }

  /**
   * Build a code graph from source files.
   */
  async buildGraph(files: Array<{ path: string; content: string }>): Promise<CodeGraph> {
    const graph = new CodeGraph();

    for (const file of files) {
      const ext = file.path.split('.').pop() ?? '';
      if (!['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go'].includes(ext)) continue;

      // Parse nodes (functions, classes, etc.) using the factory
      const nodes = await this.parserFactory.parseFile(file.path, file.content);
      graph.addNodes(nodes, file.path);

      // Parse imports and add edges
      if (ext === 'rs') {
        // Use RustASTParser for Rust imports
        const rustParser = new RustASTParser();
        const imports = rustParser.extractImports(file.content);
        for (const imp of imports) {
          if (!imp.isType) {
            graph.addImport(file.path, imp.source, imp.specifiers);
          }
        }
      } else if (ext === 'go') {
        // Use GoASTParser for Go imports
        const goParser = new GoASTParser();
        const imports = goParser.extractImports(file.content);
        for (const imp of imports) {
          if (!imp.isType) {
            graph.addImport(file.path, imp.source, imp.specifiers);
          }
        }
      } else if (ext !== 'py') {
        // Use ASTParser for JS/TS imports (Python imports handled by Python parser)
        const imports = this.parser.extractImports(file.content);
        for (const imp of imports) {
          if (!imp.isType) {
            graph.addImport(file.path, imp.source, imp.specifiers);
          }
        }
      }

      // Analyze call relationships for each function/method
      for (const node of nodes) {
        const lines = file.content.split('\n');

        if (node.type === 'function') {
          // Extract the function body for call analysis
          const functionCode = lines.slice(node.startLine - 1, node.endLine).join('\n');
          graph.analyzeCallRelationships(functionCode, file.path, node.name);
        } else if (node.type === 'class' && node.methods !== undefined) {
          // For classes, analyze each method separately
          for (const method of node.methods) {
            const methodCode = lines.slice(method.startLine - 1, method.endLine).join('\n');
            graph.analyzeCallRelationships(methodCode, file.path, `${node.name}.${method.name}`);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Save a code graph for a store.
   */
  async saveGraph(storeId: StoreId, graph: CodeGraph): Promise<void> {
    const graphPath = this.getGraphPath(storeId);
    await mkdir(dirname(graphPath), { recursive: true });

    const serialized = graph.toJSON();
    await writeFile(graphPath, JSON.stringify(serialized, null, 2));
  }

  /**
   * Delete the code graph file for a store.
   * Silently succeeds if the file doesn't exist.
   */
  async deleteGraph(storeId: StoreId): Promise<void> {
    const graphPath = this.getGraphPath(storeId);
    await rm(graphPath, { force: true });
    this.graphCache.delete(storeId);
  }

  /**
   * Load a code graph for a store.
   * Returns undefined if no graph exists.
   */
  async loadGraph(storeId: StoreId): Promise<CodeGraph | undefined> {
    // Check cache first
    const cached = this.graphCache.get(storeId);
    if (cached) return cached;

    const graphPath = this.getGraphPath(storeId);

    try {
      const content = await readFile(graphPath, 'utf-8');
      const parsed: unknown = JSON.parse(content);

      // Validate structure
      if (!this.isSerializedGraph(parsed)) {
        return undefined;
      }

      const serialized = parsed;
      const graph = new CodeGraph();

      // Restore nodes
      for (const node of serialized.nodes) {
        const nodeType = this.validateNodeType(node.type);
        if (!nodeType) continue;

        // Method nodes are added directly to the graph since they're already separate nodes
        if (nodeType === 'method') {
          const graphNode: GraphNode = {
            id: node.id,
            file: node.file,
            type: 'method',
            name: node.name,
            exported: node.exported,
            startLine: node.startLine,
            endLine: node.endLine,
          };
          if (node.signature !== undefined) {
            graphNode.signature = node.signature;
          }
          graph.addGraphNode(graphNode);
          continue;
        }

        const codeNode: {
          type: 'function' | 'class' | 'interface' | 'type' | 'const';
          name: string;
          exported: boolean;
          startLine: number;
          endLine: number;
          signature?: string;
        } = {
          type: nodeType,
          name: node.name,
          exported: node.exported,
          startLine: node.startLine,
          endLine: node.endLine,
        };
        if (node.signature !== undefined) {
          codeNode.signature = node.signature;
        }
        graph.addNodes([codeNode], node.file);
      }

      // Restore edges
      for (const edge of serialized.edges) {
        const edgeType = this.validateEdgeType(edge.type);
        if (!edgeType) continue;

        graph.addEdge({
          from: edge.from,
          to: edge.to,
          type: edgeType,
          confidence: edge.confidence,
        });
      }

      this.graphCache.set(storeId, graph);
      return graph;
    } catch {
      return undefined;
    }
  }

  /**
   * Get usage stats for a code element.
   */
  getUsageStats(
    graph: CodeGraph,
    filePath: string,
    symbolName: string
  ): { calledBy: number; calls: number } {
    const nodeId = `${filePath}:${symbolName}`;
    return {
      calledBy: graph.getCalledByCount(nodeId),
      calls: graph.getCallsCount(nodeId),
    };
  }

  /**
   * Get related code (callers and callees) for a code element.
   */
  getRelatedCode(
    graph: CodeGraph,
    filePath: string,
    symbolName: string
  ): Array<{ id: string; relationship: string }> {
    const nodeId = `${filePath}:${symbolName}`;
    const related: Array<{ id: string; relationship: string }> = [];

    // Get callers (incoming call edges)
    const incoming = graph.getIncomingEdges(nodeId);
    for (const edge of incoming) {
      if (edge.type === 'calls') {
        related.push({ id: edge.from, relationship: 'calls this' });
      }
    }

    // Get callees (outgoing call edges)
    const outgoing = graph.getEdges(nodeId);
    for (const edge of outgoing) {
      if (edge.type === 'calls') {
        related.push({ id: edge.to, relationship: 'called by this' });
      }
    }

    return related;
  }

  /**
   * Clear cached graphs.
   */
  clearCache(): void {
    this.graphCache.clear();
  }

  private getGraphPath(storeId: StoreId): string {
    return join(this.dataDir, 'graphs', `${storeId}.json`);
  }

  /**
   * Type guard for SerializedGraph structure.
   */
  private isSerializedGraph(value: unknown): value is SerializedGraph {
    if (typeof value !== 'object' || value === null) return false;
    // Use 'in' operator for property checking
    if (!('nodes' in value) || !('edges' in value)) return false;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed via 'in' checks above
    const obj = value as { nodes: unknown; edges: unknown };
    return Array.isArray(obj.nodes) && Array.isArray(obj.edges);
  }

  /**
   * Type guard for valid node types.
   */
  private isValidNodeType(
    type: string
  ): type is 'function' | 'class' | 'interface' | 'type' | 'const' | 'method' {
    return ['function', 'class', 'interface', 'type', 'const', 'method'].includes(type);
  }

  /**
   * Validate and return a node type, or undefined if invalid.
   */
  private validateNodeType(
    type: string
  ): 'function' | 'class' | 'interface' | 'type' | 'const' | 'method' | undefined {
    if (this.isValidNodeType(type)) {
      return type;
    }
    return undefined;
  }

  /**
   * Type guard for valid edge types.
   */
  private isValidEdgeType(type: string): type is 'calls' | 'imports' | 'extends' | 'implements' {
    return ['calls', 'imports', 'extends', 'implements'].includes(type);
  }

  /**
   * Validate and return an edge type, or undefined if invalid.
   */
  private validateEdgeType(
    type: string
  ): 'calls' | 'imports' | 'extends' | 'implements' | undefined {
    if (this.isValidEdgeType(type)) {
      return type;
    }
    return undefined;
  }
}
