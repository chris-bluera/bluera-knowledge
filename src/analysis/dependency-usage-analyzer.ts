import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { ASTParser } from './ast-parser.js';
import { ok, err } from '../types/result.js';
import type { SupportedLanguage } from './repo-url-resolver.js';
import type { Result } from '../types/result.js';

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.java',
  '.rs',
  '.php',
  '.md',
  '.txt',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
]);

export interface PackageUsage {
  packageName: string;
  importCount: number;
  fileCount: number;
  files: string[];
  isDevDependency: boolean;
  language: SupportedLanguage;
}

export interface DependencyAnalysisResult {
  usages: PackageUsage[];
  totalFilesScanned: number;
  skippedFiles: number;
  analysisTimeMs: number;
}

interface DeclaredDependency {
  name: string;
  isDev: boolean;
  language: SupportedLanguage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class DependencyUsageAnalyzer {
  private readonly astParser: ASTParser;

  constructor() {
    this.astParser = new ASTParser();
  }

  async analyze(
    projectRoot: string,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Result<DependencyAnalysisResult>> {
    const startTime = Date.now();

    try {
      // 1. Read declared dependencies from package.json/requirements.txt
      const declaredDeps = await this.readDeclaredDependencies(projectRoot);

      if (declaredDeps.size === 0) {
        return ok({
          usages: [],
          totalFilesScanned: 0,
          skippedFiles: 0,
          analysisTimeMs: Date.now() - startTime,
        });
      }

      // 2. Scan all source files
      const files = await this.scanDirectory(projectRoot);

      if (files.length === 0) {
        return ok({
          usages: [],
          totalFilesScanned: 0,
          skippedFiles: 0,
          analysisTimeMs: Date.now() - startTime,
        });
      }

      // 3. Count imports for each package
      const usageMap = new Map<string, PackageUsage>();
      let processedCount = 0;
      let skippedCount = 0;

      for (const filePath of files) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const imports = this.extractImportsForFile(filePath, content);

          for (const importInfo of imports) {
            const packageName = this.extractPackageName(importInfo.source);

            if (packageName !== null && declaredDeps.has(packageName)) {
              const dep = declaredDeps.get(packageName);
              if (dep !== undefined) {
                this.incrementUsage(usageMap, packageName, filePath, dep.isDev, dep.language);
              }
            }
          }

          processedCount++;
          if (onProgress !== undefined && processedCount % 10 === 0) {
            onProgress(
              processedCount,
              files.length,
              `Analyzed ${String(processedCount)}/${String(files.length)} files`
            );
          }
        } catch {
          // Skip files that can't be read or parsed
          skippedCount++;
        }
      }

      // 4. Sort by usage frequency
      const sortedUsages = Array.from(usageMap.values()).sort(
        (a, b) => b.importCount - a.importCount
      );

      return ok({
        usages: sortedUsages,
        totalFilesScanned: processedCount,
        skippedFiles: skippedCount,
        analysisTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      const errorObj = new Error(
        error instanceof Error ? error.message : 'Unknown error during analysis'
      );
      errorObj.name = 'ANALYSIS_ERROR';
      return err(errorObj);
    }
  }

  private extractPackageName(importSource: string): string | null {
    // Relative imports (./foo, ../bar, /absolute) -> null
    if (importSource.startsWith('.') || importSource.startsWith('/')) {
      return null;
    }

    // Node built-ins (node:fs, node:path) -> null
    if (importSource.startsWith('node:')) {
      return null;
    }

    // Scoped packages: @org/package/path -> @org/package
    if (importSource.startsWith('@')) {
      const parts = importSource.split('/');
      if (parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined) {
        return `${parts[0]}/${parts[1]}`;
      }
      return null;
    }

    // Regular packages: lodash/get -> lodash
    const firstPart = importSource.split('/')[0];
    return firstPart ?? null;
  }

  private extractImportsForFile(filePath: string, content: string): Array<{ source: string }> {
    const ext = extname(filePath);

    // JavaScript/TypeScript - use AST parser
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      try {
        return this.astParser.extractImports(content);
      } catch {
        // Fallback to regex for malformed files
        return this.extractImportsRegex(content, 'javascript');
      }
    }

    // Python - use regex
    if (ext === '.py') {
      return this.extractImportsRegex(content, 'python');
    }

    return [];
  }

  private extractImportsRegex(
    content: string,
    language: 'javascript' | 'python'
  ): Array<{ source: string }> {
    const imports: Array<{ source: string }> = [];

    if (language === 'javascript') {
      // Match: import ... from 'package'
      // Match: require('package')
      const importPattern = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
      const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

      for (const match of content.matchAll(importPattern)) {
        if (match[1] !== undefined) imports.push({ source: match[1] });
      }

      for (const match of content.matchAll(requirePattern)) {
        if (match[1] !== undefined) imports.push({ source: match[1] });
      }
    } else {
      // Match: import package
      // Match: from package import ...
      const importPattern = /^import\s+([a-zA-Z0-9_]+)/gm;
      const fromPattern = /^from\s+([a-zA-Z0-9_]+)/gm;

      for (const match of content.matchAll(importPattern)) {
        if (match[1] !== undefined) imports.push({ source: match[1] });
      }

      for (const match of content.matchAll(fromPattern)) {
        if (match[1] !== undefined) imports.push({ source: match[1] });
      }
    }

    return imports;
  }

  private incrementUsage(
    usageMap: Map<string, PackageUsage>,
    packageName: string,
    filePath: string,
    isDevDependency: boolean,
    language: SupportedLanguage
  ): void {
    const existing = usageMap.get(packageName);

    if (existing) {
      existing.importCount++;
      if (!existing.files.includes(filePath)) {
        existing.fileCount++;
        existing.files.push(filePath);
      }
    } else {
      usageMap.set(packageName, {
        packageName,
        importCount: 1,
        fileCount: 1,
        files: [filePath],
        isDevDependency,
        language,
      });
    }
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common ignored directories
          if (
            ![
              'node_modules',
              '.git',
              'dist',
              'build',
              'coverage',
              '__pycache__',
              '.venv',
              'venv',
            ].includes(entry.name)
          ) {
            files.push(...(await this.scanDirectory(fullPath)));
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (TEXT_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }

    return files;
  }

  private async readDeclaredDependencies(
    projectRoot: string
  ): Promise<Map<string, DeclaredDependency>> {
    const deps = new Map<string, DeclaredDependency>();

    // Read package.json (Node.js)
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const content = await readFile(packageJsonPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);

        if (isRecord(parsed)) {
          // Regular dependencies
          if (isRecord(parsed['dependencies'])) {
            for (const name of Object.keys(parsed['dependencies'])) {
              deps.set(name, { name, isDev: false, language: 'javascript' });
            }
          }

          // Dev dependencies
          if (isRecord(parsed['devDependencies'])) {
            for (const name of Object.keys(parsed['devDependencies'])) {
              deps.set(name, { name, isDev: true, language: 'javascript' });
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Read requirements.txt (Python)
    const reqPath = join(projectRoot, 'requirements.txt');
    if (existsSync(reqPath)) {
      try {
        const content = await readFile(reqPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed.startsWith('#')) continue;

          // Parse package name (before ==, >=, etc.)
          const match = /^([a-zA-Z0-9_-]+)/.exec(trimmed);
          if (match?.[1] !== undefined) {
            const name = match[1].toLowerCase();
            deps.set(name, { name, isDev: false, language: 'python' });
          }
        }
      } catch {
        // Ignore errors
      }
    }

    // Read pyproject.toml (Python)
    const pyprojectPath = join(projectRoot, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
      try {
        const content = await readFile(pyprojectPath, 'utf-8');
        // Simple regex extraction (good enough for dependency names)
        const depMatches = content.matchAll(/"([a-zA-Z0-9_-]+)"/g);

        for (const match of depMatches) {
          if (match[1] !== undefined) {
            const name = match[1].toLowerCase();
            deps.set(name, { name, isDev: false, language: 'python' });
          }
        }
      } catch {
        // Ignore errors
      }
    }

    // Read Cargo.toml (Rust)
    const cargoPath = join(projectRoot, 'Cargo.toml');
    if (existsSync(cargoPath)) {
      try {
        const content = await readFile(cargoPath, 'utf-8');
        // Match [dependencies] section entries like: serde = "1.0"
        // or serde = { version = "1.0", features = [...] }
        const inDepsSection = /\[dependencies\]([\s\S]*?)(?=\n\[|$)/;
        const depsMatch = inDepsSection.exec(content);
        if (depsMatch?.[1] !== undefined) {
          const depsSection = depsMatch[1];
          // Match crate names at start of lines
          const cratePattern = /^([a-zA-Z0-9_-]+)\s*=/gm;
          for (const match of depsSection.matchAll(cratePattern)) {
            if (match[1] !== undefined) {
              deps.set(match[1], { name: match[1], isDev: false, language: 'rust' });
            }
          }
        }

        // Also check [dev-dependencies]
        const inDevDepsSection = /\[dev-dependencies\]([\s\S]*?)(?=\n\[|$)/;
        const devDepsMatch = inDevDepsSection.exec(content);
        if (devDepsMatch?.[1] !== undefined) {
          const devDepsSection = devDepsMatch[1];
          const cratePattern = /^([a-zA-Z0-9_-]+)\s*=/gm;
          for (const match of devDepsSection.matchAll(cratePattern)) {
            if (match[1] !== undefined) {
              deps.set(match[1], { name: match[1], isDev: true, language: 'rust' });
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }

    // Read go.mod (Go)
    const goModPath = join(projectRoot, 'go.mod');
    if (existsSync(goModPath)) {
      try {
        const content = await readFile(goModPath, 'utf-8');
        // Match require blocks and single requires
        // require github.com/gorilla/mux v1.8.0
        // require (
        //   github.com/gorilla/mux v1.8.0
        // )
        const requirePattern = /^\s*([a-zA-Z0-9._/-]+)\s+v[\d.]+/gm;
        for (const match of content.matchAll(requirePattern)) {
          if (match[1] !== undefined && !match[1].startsWith('//')) {
            // Go modules use the full path as the name
            deps.set(match[1], { name: match[1], isDev: false, language: 'go' });
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return deps;
  }
}
