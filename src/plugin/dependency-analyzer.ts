import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface DependencySuggestion {
  name: string;
  url: string;
  reason: string;
  importance: 'critical' | 'high' | 'medium';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Map of important libraries to their repos
const KNOWN_REPOS: Record<string, { url: string; importance: 'critical' | 'high' | 'medium'; reason: string }> = {
  'vue': { url: 'https://github.com/vuejs/core', importance: 'critical', reason: 'Core framework - essential for Vue.js development' },
  'react': { url: 'https://github.com/facebook/react', importance: 'critical', reason: 'Core framework - essential for React development' },
  'pydantic': { url: 'https://github.com/pydantic/pydantic', importance: 'critical', reason: 'Core validation library - heavily used' },
  'fastapi': { url: 'https://github.com/tiangolo/fastapi', importance: 'critical', reason: 'Core web framework - central to this project' },
  'hono': { url: 'https://github.com/honojs/hono', importance: 'critical', reason: 'Core web framework - central to this project' },
  'express': { url: 'https://github.com/expressjs/express', importance: 'high', reason: 'Web framework - frequently referenced' },
  'pinia': { url: 'https://github.com/vuejs/pinia', importance: 'high', reason: 'State management - frequently used' },
  'pino': { url: 'https://github.com/pinojs/pino', importance: 'medium', reason: 'Logging library - commonly used' },
  'zod': { url: 'https://github.com/colinhacks/zod', importance: 'high', reason: 'Schema validation - frequently used' },
  'next': { url: 'https://github.com/vercel/next.js', importance: 'critical', reason: 'Core framework - essential for Next.js development' },
  'nuxt': { url: 'https://github.com/nuxt/nuxt', importance: 'critical', reason: 'Core framework - essential for Nuxt development' },
  'svelte': { url: 'https://github.com/sveltejs/svelte', importance: 'critical', reason: 'Core framework - essential for Svelte development' },
  'django': { url: 'https://github.com/django/django', importance: 'critical', reason: 'Core framework - essential for Django development' },
  'flask': { url: 'https://github.com/pallets/flask', importance: 'critical', reason: 'Core framework - essential for Flask development' },
  'prisma': { url: 'https://github.com/prisma/prisma', importance: 'high', reason: 'ORM - database interactions' },
};

export async function analyzeDependencies(
  projectRoot: string = process.cwd()
): Promise<DependencySuggestion[]> {
  const suggestions: DependencySuggestion[] = [];

  // Check Node.js projects
  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    const content = await readFile(packageJsonPath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (isRecord(parsed)) {
      suggestions.push(...analyzeNodeDependencies(parsed));
    }
  }

  // Check Python projects
  const reqPath = join(projectRoot, 'requirements.txt');
  if (existsSync(reqPath)) {
    const content = await readFile(reqPath, 'utf-8');
    suggestions.push(...analyzePythonDependencies(content));
  }

  // Check pyproject.toml
  const pyprojectPath = join(projectRoot, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    const content = await readFile(pyprojectPath, 'utf-8');
    suggestions.push(...analyzePyProjectDependencies(content));
  }

  // Remove duplicates and sort by importance
  const unique = Array.from(new Map(suggestions.map(s => [s.name, s])).values());
  return unique.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    return order[a.importance] - order[b.importance];
  });
}

function analyzeNodeDependencies(pkg: Record<string, unknown>): DependencySuggestion[] {
  const suggestions: DependencySuggestion[] = [];

  const deps = pkg['dependencies'];
  const devDeps = pkg['devDependencies'];

  const allDeps = {
    ...(isRecord(deps) ? deps : {}),
    ...(isRecord(devDeps) ? devDeps : {}),
  };

  for (const name of Object.keys(allDeps)) {
    const known = KNOWN_REPOS[name];
    if (known !== undefined) {
      suggestions.push({
        name,
        url: known.url,
        importance: known.importance,
        reason: known.reason
      });
    }
  }

  return suggestions;
}

function analyzePythonDependencies(content: string): DependencySuggestion[] {
  const suggestions: DependencySuggestion[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // Parse package name (before ==, >=, etc.)
    const match = /^([a-zA-Z0-9_-]+)/.exec(trimmed);
    if (match !== null && match[1] !== undefined) {
      const name = match[1].toLowerCase();
      const known = KNOWN_REPOS[name];
      if (known !== undefined) {
        suggestions.push({
          name,
          url: known.url,
          importance: known.importance,
          reason: known.reason
        });
      }
    }
  }

  return suggestions;
}

function analyzePyProjectDependencies(content: string): DependencySuggestion[] {
  const suggestions: DependencySuggestion[] = [];

  // Simple parsing - look for dependencies in [project.dependencies] or [tool.poetry.dependencies]
  const depMatches = content.matchAll(/"([a-zA-Z0-9_-]+)"/g);

  for (const match of depMatches) {
    if (match[1] !== undefined) {
      const name = match[1].toLowerCase();
      const known = KNOWN_REPOS[name];
      if (known !== undefined) {
        suggestions.push({
          name,
          url: known.url,
          importance: known.importance,
          reason: known.reason
        });
      }
    }
  }

  return suggestions;
}
