import { describe, it, expect } from 'vitest';
import { CodeGraph } from '../../src/analysis/code-graph.js';
import type { CodeNode } from '../../src/analysis/ast-parser.js';

describe('CodeGraph', () => {
  it('should build graph from code nodes', () => {
    const nodes: CodeNode[] = [
      {
        type: 'function',
        name: 'validateToken',
        exported: true,
        startLine: 1,
        endLine: 5,
      },
      {
        type: 'function',
        name: 'parseToken',
        exported: false,
        startLine: 7,
        endLine: 10,
      },
    ];

    const graph = new CodeGraph();
    graph.addNodes(nodes, 'src/auth.ts');

    expect(graph.getNode('src/auth.ts:validateToken')).toBeDefined();
    expect(graph.getNode('src/auth.ts:parseToken')).toBeDefined();
  });

  it('should track import relationships', () => {
    const graph = new CodeGraph();

    graph.addImport('src/controllers/user.ts', './services/user.js', ['UserService']);

    const edges = graph.getEdges('src/controllers/user.ts');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.type).toBe('imports');
    expect(edges[0]?.to).toContain('UserService');
  });

  it('should detect call relationships from code', () => {
    const code = `
export function handler(req) {
  const valid = validateToken(req.token);
  if (!valid) return error();
  return success();
}
`;

    const graph = new CodeGraph();
    graph.analyzeCallRelationships(code, 'src/handler.ts', 'handler');

    const edges = graph.getEdges('src/handler.ts:handler');
    const callEdges = edges.filter((e) => e.type === 'calls');

    expect(callEdges.length).toBeGreaterThan(0);
    expect(callEdges.some((e) => e.to.includes('validateToken'))).toBe(true);
  });
});
