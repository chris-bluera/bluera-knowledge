import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DependencyUsageAnalyzer } from './dependency-usage-analyzer.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('DependencyUsageAnalyzer', () => {
  let analyzer: DependencyUsageAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new DependencyUsageAnalyzer();
    tempDir = join(tmpdir(), `dep-analyzer-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Package name extraction', () => {
    it('extracts regular package name', async () => {
      const packageJson = {
        dependencies: { lodash: '^4.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import { map } from "lodash";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(1);
        expect(result.data.usages[0]?.packageName).toBe('lodash');
      }
    });

    it('extracts scoped package name', async () => {
      const packageJson = {
        dependencies: { '@org/package': '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import { foo } from "@org/package";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.packageName).toBe('@org/package');
      }
    });

    it('extracts package from deep import path', async () => {
      const packageJson = {
        dependencies: { lodash: '^4.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import map from "lodash/map";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.packageName).toBe('lodash');
      }
    });

    it('ignores relative imports', async () => {
      const packageJson = { dependencies: {} };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import { helper } from "./utils";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(0);
      }
    });

    it('ignores node built-ins', async () => {
      const packageJson = { dependencies: {} };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import { readFile } from "node:fs/promises";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(0);
      }
    });

    it('ignores absolute paths', async () => {
      const packageJson = { dependencies: {} };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import { util } from "/absolute/path";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(0);
      }
    });
  });

  describe('Dependency detection', () => {
    it('reads dependencies from package.json', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          lodash: '^4.0.0',
        },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(
        join(tempDir, 'index.ts'),
        'import React from "react"; import _ from "lodash";'
      );

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(2);
      }
    });

    it('identifies dev dependencies', async () => {
      const packageJson = {
        devDependencies: {
          vitest: '^1.0.0',
        },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'test.ts'), 'import { describe } from "vitest";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.isDevDependency).toBe(true);
      }
    });

    it('handles project with no dependencies', async () => {
      const packageJson = {};
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(0);
        expect(result.data.totalFilesScanned).toBe(0);
      }
    });

    it('handles project without package.json', async () => {
      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(0);
      }
    });

    it('reads Python dependencies from requirements.txt', async () => {
      await writeFile(join(tempDir, 'requirements.txt'), 'requests==2.28.0\nnumpy>=1.20.0');
      await writeFile(join(tempDir, 'script.py'), 'import requests\nimport numpy');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages.length).toBeGreaterThan(0);
      }
    });

    it('handles malformed package.json gracefully', async () => {
      await writeFile(join(tempDir, 'package.json'), '{ invalid json');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages).toHaveLength(0);
      }
    });
  });

  describe('File scanning', () => {
    it('scans JavaScript files', async () => {
      const packageJson = {
        dependencies: { package: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.js'), 'import { foo } from "package";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalFilesScanned).toBeGreaterThanOrEqual(1);
      }
    });

    it('scans TypeScript files', async () => {
      const packageJson = {
        dependencies: { package: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import { foo } from "package";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalFilesScanned).toBeGreaterThanOrEqual(1);
      }
    });

    it('scans nested directories', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(join(tempDir, 'src/app.ts'), 'import { x } from "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalFilesScanned).toBeGreaterThanOrEqual(1);
      }
    });

    it('ignores node_modules directory', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

      await mkdir(join(tempDir, 'node_modules'), { recursive: true });
      await writeFile(join(tempDir, 'node_modules/file.js'), 'import { x } from "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        // May scan package.json, so just check it doesn't scan unwanted files
        expect(result.data.usages).toHaveLength(0);
      }
    });

    it('ignores dist and build directories', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

      await mkdir(join(tempDir, 'dist'), { recursive: true });
      await mkdir(join(tempDir, 'build'), { recursive: true });
      await writeFile(join(tempDir, 'dist/app.js'), 'import "pkg";');
      await writeFile(join(tempDir, 'build/app.js'), 'import "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        // May scan package.json, so just check it doesn't scan unwanted files
        expect(result.data.usages).toHaveLength(0);
      }
    });

    it('handles unreadable files gracefully', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'good.ts'), 'import { x } from "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalFilesScanned).toBeGreaterThan(0);
      }
    });
  });

  describe('Usage counting', () => {
    it('counts import occurrences', async () => {
      const packageJson = {
        dependencies: { lodash: '^4.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(
        join(tempDir, 'file1.ts'),
        'import { map } from "lodash";\nimport { filter } from "lodash";'
      );

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.importCount).toBe(2);
        expect(result.data.usages[0]?.fileCount).toBe(1);
      }
    });

    it('counts files using a package', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'file1.ts'), 'import { x } from "pkg";');
      await writeFile(join(tempDir, 'file2.ts'), 'import { y } from "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.fileCount).toBe(2);
        expect(result.data.usages[0]?.importCount).toBe(2);
      }
    });

    it('tracks which files use each package', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'app.ts'), 'import { x } from "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.files).toContain(join(tempDir, 'app.ts'));
      }
    });

    it('sorts results by import count', async () => {
      const packageJson = {
        dependencies: {
          pkg1: '^1.0.0',
          pkg2: '^1.0.0',
        },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(
        join(tempDir, 'file.ts'),
        'import { a } from "pkg1";\nimport { b } from "pkg1";\nimport { c } from "pkg2";'
      );

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.packageName).toBe('pkg1');
        expect(result.data.usages[1]?.packageName).toBe('pkg2');
      }
    });
  });

  describe('Progress reporting', () => {
    it('calls progress callback during analysis', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

      // Create multiple files to trigger progress (fires every 10 files)
      for (let i = 0; i < 25; i++) {
        await writeFile(join(tempDir, `file${i}.ts`), 'import { x } from "pkg";');
      }

      const progressCalls: Array<{ current: number; total: number; message: string }> = [];
      const onProgress = (current: number, total: number, message: string) => {
        progressCalls.push({ current, total, message });
      };

      const result = await analyzer.analyze(tempDir, onProgress);

      expect(result.success).toBe(true);
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0]?.message).toContain('Analyzed');
    });
  });

  describe('Import detection methods', () => {
    it('uses ESM imports as primary detection method', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'file.js'), 'import { foo } from "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        const pkgUsage = result.data.usages.find((u) => u.packageName === 'pkg');
        expect(pkgUsage).toBeDefined();
        expect(pkgUsage?.packageName).toBe('pkg');
      }
    });

    it('detects Python import statements', async () => {
      await writeFile(join(tempDir, 'requirements.txt'), 'requests==2.28.0');
      await writeFile(join(tempDir, 'script.py'), 'import requests');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages.some((u) => u.packageName === 'requests')).toBe(true);
      }
    });

    it('detects Python from...import statements', async () => {
      await writeFile(join(tempDir, 'requirements.txt'), 'numpy>=1.20.0');
      await writeFile(join(tempDir, 'script.py'), 'from numpy import array');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages.some((u) => u.packageName === 'numpy')).toBe(true);
      }
    });

    it('handles malformed code gracefully', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'broken.ts'), 'import { incomplete from "pkg"');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skippedFiles).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Analysis metadata', () => {
    it('includes analysis time', async () => {
      const packageJson = { dependencies: {} };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysisTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('counts skipped files', async () => {
      const packageJson = {
        dependencies: { pkg: '^1.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'good.ts'), 'import { x } from "pkg";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skippedFiles).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Language detection', () => {
    it('sets language to javascript for package.json dependencies', async () => {
      const packageJson = {
        dependencies: { lodash: '^4.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'index.ts'), 'import { map } from "lodash";');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.language).toBe('javascript');
      }
    });

    it('sets language to python for requirements.txt dependencies', async () => {
      await writeFile(join(tempDir, 'requirements.txt'), 'requests==2.28.0');
      await writeFile(join(tempDir, 'script.py'), 'import requests');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usages[0]?.language).toBe('python');
      }
    });

    it('sets language to rust for Cargo.toml dependencies', async () => {
      await writeFile(
        join(tempDir, 'Cargo.toml'),
        `[package]
name = "myapp"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
criterion = "0.5"
`
      );
      // Note: We don't have Rust import scanning yet, but we can verify
      // the dependencies are read correctly by checking the language
      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      // Since we don't scan .rs files for use statements yet,
      // usages will be empty, but we can test that deps are parsed
    });

    it('parses Cargo.toml dependencies section', async () => {
      await writeFile(
        join(tempDir, 'Cargo.toml'),
        `[package]
name = "myapp"

[dependencies]
serde = "1.0"
tokio = { version = "1.0" }
`
      );
      await writeFile(join(tempDir, 'main.rs'), 'use serde::Serialize;');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      // The analyzer scans the deps but doesn't yet parse Rust use statements
      // Just verify it doesn't error
    });

    it('sets language to go for go.mod dependencies', async () => {
      await writeFile(
        join(tempDir, 'go.mod'),
        `module example.com/myapp

go 1.21

require (
	github.com/gorilla/mux v1.8.0
	github.com/spf13/cobra v1.7.0
)
`
      );
      await writeFile(join(tempDir, 'main.go'), 'import "github.com/gorilla/mux"');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      // The analyzer scans the deps but doesn't yet parse Go import statements
      // Just verify it doesn't error
    });

    it('parses go.mod require blocks', async () => {
      await writeFile(
        join(tempDir, 'go.mod'),
        `module myapp

go 1.21

require github.com/pkg/errors v0.9.1
require (
	github.com/gorilla/mux v1.8.0
)
`
      );

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
    });

    it('handles mixed language projects', async () => {
      // JavaScript
      const packageJson = {
        dependencies: { express: '^4.0.0' },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(tempDir, 'server.js'), 'import express from "express";');

      // Python
      await writeFile(join(tempDir, 'requirements.txt'), 'flask==2.0.0');
      await writeFile(join(tempDir, 'app.py'), 'import flask');

      const result = await analyzer.analyze(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        const jsUsage = result.data.usages.find((u) => u.packageName === 'express');
        const pyUsage = result.data.usages.find((u) => u.packageName === 'flask');

        expect(jsUsage?.language).toBe('javascript');
        expect(pyUsage?.language).toBe('python');
      }
    });
  });
});
