import { describe, it, expect } from 'vitest';
import { ASTParser } from '../../src/analysis/ast-parser.js';

describe('ASTParser', () => {
  it('should extract functions from TypeScript code', () => {
    const code = `
export async function validateToken(token: string): Promise<boolean> {
  return token.length > 0;
}

function helperFunction() {
  return true;
}
`;

    const parser = new ASTParser();
    const nodes = parser.parse(code, 'typescript');

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.type).toBe('function');
    expect(nodes[0]?.name).toBe('validateToken');
    expect(nodes[0]?.exported).toBe(true);
    expect(nodes[0]?.async).toBe(true);
    expect(nodes[1]?.name).toBe('helperFunction');
    expect(nodes[1]?.exported).toBe(false);
  });

  it('should extract classes with methods', () => {
    const code = `
export class UserService {
  constructor(private repo: UserRepo) {}

  async create(data: CreateUserData): Promise<User> {
    return this.repo.save(data);
  }

  delete(id: string): void {
    this.repo.delete(id);
  }
}
`;

    const parser = new ASTParser();
    const nodes = parser.parse(code, 'typescript');

    const classNode = nodes.find((n) => n.type === 'class');
    expect(classNode).toBeDefined();
    expect(classNode?.name).toBe('UserService');
    expect(classNode?.methods).toHaveLength(3); // constructor + create + delete
  });

  it('should extract imports', () => {
    const code = `
import { User } from './models/user.js';
import type { Repository } from '../types.js';
import express from 'express';
`;

    const parser = new ASTParser();
    const imports = parser.extractImports(code);

    expect(imports).toHaveLength(3);
    expect(imports[0]?.source).toBe('./models/user.js');
    expect(imports[0]?.specifiers).toContain('User');
    expect(imports[2]?.specifiers).toContain('express');
  });

  it('should extract correct line numbers', () => {
    const code = `
export function foo() {
  return true;
}

class Bar {
  method() {}
}`;

    const parser = new ASTParser();
    const nodes = parser.parse(code, 'typescript');

    const fooNode = nodes.find((n) => n.name === 'foo');
    expect(fooNode?.startLine).toBe(2);
    expect(fooNode?.endLine).toBe(4);

    const barNode = nodes.find((n) => n.name === 'Bar');
    expect(barNode?.startLine).toBe(6);
    expect(barNode?.endLine).toBe(8);
  });

  it('should handle malformed code gracefully', () => {
    const code = 'function broken(';

    const parser = new ASTParser();
    const nodes = parser.parse(code, 'typescript');

    expect(nodes).toEqual([]);
  });
});
