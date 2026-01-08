#!/usr/bin/env node
import {
  runMCPServer
} from "./chunk-TIGPI3BE.js";
import {
  IntelligentCrawler
} from "./chunk-IZWOEBFM.js";
import {
  ASTParser,
  ChunkingService,
  classifyWebContentType,
  createDocumentId,
  createServices,
  createStoreId,
  destroyServices,
  err,
  extractRepoName,
  ok
} from "./chunk-HUEWT6U5.js";
import "./chunk-6FHWC36B.js";

// src/index.ts
import { homedir as homedir2 } from "os";
import { join as join4 } from "path";

// src/cli/commands/crawl.ts
import { createHash } from "crypto";
import { Command } from "commander";
import ora from "ora";
function createCrawlCommand(getOptions) {
  return new Command("crawl").description("Crawl web pages with natural language control and index into store").argument("<url>", "URL to crawl").argument("<store>", "Target web store to add crawled content to").option(
    "--crawl <instruction>",
    'Natural language instruction for what to crawl (e.g., "all Getting Started pages")'
  ).option(
    "--extract <instruction>",
    'Natural language instruction for what to extract (e.g., "extract API references")'
  ).option("--simple", "Use simple BFS mode instead of intelligent crawling").option("--max-pages <number>", "Maximum number of pages to crawl", "50").option("--headless", "Use headless browser for JavaScript-rendered sites").action(
    async (url, storeIdOrName, cmdOptions) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      let store;
      let storeCreated = false;
      const existingStore = await services.store.getByIdOrName(storeIdOrName);
      if (!existingStore) {
        const result = await services.store.create({
          name: storeIdOrName,
          type: "web",
          url
        });
        if (!result.success) {
          await destroyServices(services);
          throw new Error(`Failed to create store: ${result.error.message}`);
        }
        const createdStore = result.data;
        if (createdStore.type !== "web") {
          throw new Error("Unexpected store type after creation");
        }
        store = createdStore;
        storeCreated = true;
        if (globalOpts.quiet !== true && globalOpts.format !== "json") {
          console.log(`Created web store: ${store.name}`);
        }
      } else if (existingStore.type !== "web") {
        await destroyServices(services);
        throw new Error(
          `Store "${storeIdOrName}" exists but is not a web store (type: ${existingStore.type})`
        );
      } else {
        store = existingStore;
      }
      const maxPages = cmdOptions.maxPages !== void 0 ? parseInt(cmdOptions.maxPages) : 50;
      const isInteractive = process.stdout.isTTY && globalOpts.quiet !== true && globalOpts.format !== "json";
      let spinner;
      if (isInteractive) {
        const mode = cmdOptions.simple === true ? "simple" : "intelligent";
        spinner = ora(`Crawling ${url} (${mode} mode)`).start();
      } else if (globalOpts.quiet !== true && globalOpts.format !== "json") {
        console.log(`Crawling ${url}`);
      }
      const crawler = new IntelligentCrawler();
      const webChunker = ChunkingService.forContentType("web");
      let pagesIndexed = 0;
      let chunksCreated = 0;
      let exitCode = 0;
      crawler.on("progress", (progress) => {
        if (spinner) {
          if (progress.type === "strategy") {
            spinner.text = progress.message ?? "Analyzing crawl strategy...";
          } else if (progress.type === "page") {
            const url2 = progress.currentUrl ?? "unknown";
            spinner.text = `Crawling ${String(progress.pagesVisited + 1)}/${String(maxPages)} - ${url2}`;
          } else if (progress.type === "extraction") {
            const url2 = progress.currentUrl ?? "unknown";
            spinner.text = `Extracting from ${url2}...`;
          } else if (progress.type === "error" && progress.message !== void 0) {
            spinner.warn(progress.message);
          }
        }
      });
      try {
        await services.lance.initialize(store.id);
        const docs = [];
        for await (const result of crawler.crawl(url, {
          ...cmdOptions.crawl !== void 0 && { crawlInstruction: cmdOptions.crawl },
          ...cmdOptions.extract !== void 0 && { extractInstruction: cmdOptions.extract },
          maxPages,
          ...cmdOptions.simple !== void 0 && { simple: cmdOptions.simple },
          useHeadless: cmdOptions.headless ?? false
        })) {
          const contentToProcess = result.extracted ?? result.markdown;
          const chunks = webChunker.chunk(contentToProcess, `${result.url}.md`);
          const fileType = classifyWebContentType(result.url, result.title);
          const urlHash = createHash("md5").update(result.url).digest("hex");
          for (const chunk of chunks) {
            const chunkId = chunks.length > 1 ? `${store.id}-${urlHash}-${String(chunk.chunkIndex)}` : `${store.id}-${urlHash}`;
            const vector = await services.embeddings.embed(chunk.content);
            docs.push({
              id: createDocumentId(chunkId),
              content: chunk.content,
              vector,
              metadata: {
                type: chunks.length > 1 ? "chunk" : "web",
                storeId: store.id,
                url: result.url,
                title: result.title,
                extracted: result.extracted !== void 0,
                depth: result.depth,
                indexedAt: /* @__PURE__ */ new Date(),
                fileType,
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunk.totalChunks,
                sectionHeader: chunk.sectionHeader
              }
            });
            chunksCreated++;
          }
          pagesIndexed++;
        }
        if (docs.length > 0) {
          if (spinner) {
            spinner.text = "Indexing documents...";
          }
          await services.lance.addDocuments(store.id, docs);
          await services.lance.createFtsIndex(store.id);
        }
        const crawlResult = {
          success: true,
          store: store.name,
          storeCreated,
          url,
          pagesCrawled: pagesIndexed,
          chunksCreated,
          mode: cmdOptions.simple === true ? "simple" : "intelligent",
          hadCrawlInstruction: cmdOptions.crawl !== void 0,
          hadExtractInstruction: cmdOptions.extract !== void 0
        };
        if (globalOpts.format === "json") {
          console.log(JSON.stringify(crawlResult, null, 2));
        } else if (spinner !== void 0) {
          spinner.succeed(
            `Crawled ${String(pagesIndexed)} pages, indexed ${String(chunksCreated)} chunks`
          );
        } else if (globalOpts.quiet !== true) {
          console.log(
            `Crawled ${String(pagesIndexed)} pages, indexed ${String(chunksCreated)} chunks`
          );
        }
      } catch (error) {
        const message = `Crawl failed: ${error instanceof Error ? error.message : String(error)}`;
        if (spinner) {
          spinner.fail(message);
        } else {
          console.error(`Error: ${message}`);
        }
        exitCode = 6;
      } finally {
        await crawler.stop();
        await destroyServices(services);
      }
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    }
  );
}

// src/cli/commands/index-cmd.ts
import { Command as Command2 } from "commander";
import ora2 from "ora";
function createIndexCommand(getOptions) {
  const index = new Command2("index").description("Scan store files, chunk text, generate embeddings, save to LanceDB").argument("<store>", "Store ID or name").option("--force", "Re-index all files even if unchanged").action(async (storeIdOrName, _options) => {
    const globalOpts = getOptions();
    const services = await createServices(globalOpts.config, globalOpts.dataDir);
    let exitCode = 0;
    try {
      indexLogic: {
        const store = await services.store.getByIdOrName(storeIdOrName);
        if (store === void 0) {
          console.error(`Error: Store not found: ${storeIdOrName}`);
          exitCode = 3;
          break indexLogic;
        }
        const isInteractive = process.stdout.isTTY && globalOpts.quiet !== true && globalOpts.format !== "json";
        let spinner;
        if (isInteractive) {
          spinner = ora2(`Indexing store: ${store.name}`).start();
        } else if (globalOpts.quiet !== true && globalOpts.format !== "json") {
          console.log(`Indexing store: ${store.name}`);
        }
        await services.lance.initialize(store.id);
        const result = await services.index.indexStore(store, (event) => {
          if (event.type === "progress") {
            if (spinner) {
              spinner.text = `Indexing: ${String(event.current)}/${String(event.total)} files - ${event.message}`;
            }
          }
        });
        if (result.success) {
          if (globalOpts.format === "json") {
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            const message = `Indexed ${String(result.data.documentsIndexed)} documents, ${String(result.data.chunksCreated)} chunks in ${String(result.data.timeMs)}ms`;
            if (spinner !== void 0) {
              spinner.succeed(message);
            } else if (globalOpts.quiet !== true) {
              console.log(message);
            }
          }
        } else {
          const message = `Error: ${result.error.message}`;
          if (spinner !== void 0) {
            spinner.fail(message);
          } else {
            console.error(message);
          }
          exitCode = 4;
          break indexLogic;
        }
      }
    } finally {
      await destroyServices(services);
    }
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  });
  index.command("watch <store>").description("Watch store directory; re-index when files change").option(
    "--debounce <ms>",
    "Wait N ms after last change before re-indexing (default: 1000)",
    "1000"
  ).action(async (storeIdOrName, options) => {
    const globalOpts = getOptions();
    const services = await createServices(globalOpts.config, globalOpts.dataDir);
    const store = await services.store.getByIdOrName(storeIdOrName);
    if (store === void 0 || store.type !== "file" && store.type !== "repo") {
      console.error(`Error: File/repo store not found: ${storeIdOrName}`);
      process.exit(3);
    }
    const { WatchService } = await import("./watch.service-BJV3TI3F.js");
    const watchService = new WatchService(services.index, services.lance);
    if (globalOpts.quiet !== true) {
      console.log(`Watching ${store.name} for changes...`);
    }
    await watchService.watch(store, parseInt(options.debounce ?? "1000", 10), () => {
      if (globalOpts.quiet !== true) {
        console.log(`Re-indexed ${store.name}`);
      }
    });
    process.on("SIGINT", () => {
      void (async () => {
        await watchService.unwatchAll();
        process.exit(0);
      })().catch(() => {
      });
    });
  });
  return index;
}

// src/cli/commands/mcp.ts
import { Command as Command3 } from "commander";
function createMCPCommand(getOptions) {
  const mcp = new Command3("mcp").description("Start MCP (Model Context Protocol) server for AI agent integration").action(async () => {
    const opts = getOptions();
    await runMCPServer({
      dataDir: opts.dataDir,
      config: opts.config
    });
  });
  return mcp;
}

// src/cli/commands/plugin-api.ts
import { Command as Command4 } from "commander";

// src/plugin/commands.ts
import ora3 from "ora";

// src/analysis/dependency-usage-analyzer.ts
import { existsSync } from "fs";
import { readFile, readdir } from "fs/promises";
import { join, extname } from "path";
var TEXT_EXTENSIONS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".rs",
  ".php",
  ".md",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".toml"
]);
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var DependencyUsageAnalyzer = class {
  astParser;
  constructor() {
    this.astParser = new ASTParser();
  }
  async analyze(projectRoot, onProgress) {
    const startTime = Date.now();
    try {
      const declaredDeps = await this.readDeclaredDependencies(projectRoot);
      if (declaredDeps.size === 0) {
        return ok({
          usages: [],
          totalFilesScanned: 0,
          skippedFiles: 0,
          analysisTimeMs: Date.now() - startTime
        });
      }
      const files = await this.scanDirectory(projectRoot);
      if (files.length === 0) {
        return ok({
          usages: [],
          totalFilesScanned: 0,
          skippedFiles: 0,
          analysisTimeMs: Date.now() - startTime
        });
      }
      const usageMap = /* @__PURE__ */ new Map();
      let processedCount = 0;
      let skippedCount = 0;
      for (const filePath of files) {
        try {
          const content = await readFile(filePath, "utf-8");
          const imports = this.extractImportsForFile(filePath, content);
          for (const importInfo of imports) {
            const packageName = this.extractPackageName(importInfo.source);
            if (packageName !== null && declaredDeps.has(packageName)) {
              const dep = declaredDeps.get(packageName);
              if (dep !== void 0) {
                this.incrementUsage(usageMap, packageName, filePath, dep.isDev, dep.language);
              }
            }
          }
          processedCount++;
          if (onProgress !== void 0 && processedCount % 10 === 0) {
            onProgress(
              processedCount,
              files.length,
              `Analyzed ${String(processedCount)}/${String(files.length)} files`
            );
          }
        } catch {
          skippedCount++;
        }
      }
      const sortedUsages = Array.from(usageMap.values()).sort(
        (a, b) => b.importCount - a.importCount
      );
      return ok({
        usages: sortedUsages,
        totalFilesScanned: processedCount,
        skippedFiles: skippedCount,
        analysisTimeMs: Date.now() - startTime
      });
    } catch (error) {
      const errorObj = new Error(
        error instanceof Error ? error.message : "Unknown error during analysis"
      );
      errorObj.name = "ANALYSIS_ERROR";
      return err(errorObj);
    }
  }
  extractPackageName(importSource) {
    if (importSource.startsWith(".") || importSource.startsWith("/")) {
      return null;
    }
    if (importSource.startsWith("node:")) {
      return null;
    }
    if (importSource.startsWith("@")) {
      const parts = importSource.split("/");
      if (parts.length >= 2 && parts[0] !== void 0 && parts[1] !== void 0) {
        return `${parts[0]}/${parts[1]}`;
      }
      return null;
    }
    const firstPart = importSource.split("/")[0];
    return firstPart ?? null;
  }
  extractImportsForFile(filePath, content) {
    const ext = extname(filePath);
    if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
      try {
        return this.astParser.extractImports(content);
      } catch {
        return this.extractImportsRegex(content, "javascript");
      }
    }
    if (ext === ".py") {
      return this.extractImportsRegex(content, "python");
    }
    return [];
  }
  extractImportsRegex(content, language) {
    const imports = [];
    if (language === "javascript") {
      const importPattern = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
      const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      for (const match of content.matchAll(importPattern)) {
        if (match[1] !== void 0) imports.push({ source: match[1] });
      }
      for (const match of content.matchAll(requirePattern)) {
        if (match[1] !== void 0) imports.push({ source: match[1] });
      }
    } else {
      const importPattern = /^import\s+([a-zA-Z0-9_]+)/gm;
      const fromPattern = /^from\s+([a-zA-Z0-9_]+)/gm;
      for (const match of content.matchAll(importPattern)) {
        if (match[1] !== void 0) imports.push({ source: match[1] });
      }
      for (const match of content.matchAll(fromPattern)) {
        if (match[1] !== void 0) imports.push({ source: match[1] });
      }
    }
    return imports;
  }
  incrementUsage(usageMap, packageName, filePath, isDevDependency, language) {
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
        language
      });
    }
  }
  async scanDirectory(dir) {
    const files = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (![
            "node_modules",
            ".git",
            "dist",
            "build",
            "coverage",
            "__pycache__",
            ".venv",
            "venv"
          ].includes(entry.name)) {
            files.push(...await this.scanDirectory(fullPath));
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (TEXT_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
    }
    return files;
  }
  async readDeclaredDependencies(projectRoot) {
    const deps = /* @__PURE__ */ new Map();
    const packageJsonPath = join(projectRoot, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const content = await readFile(packageJsonPath, "utf-8");
        const parsed = JSON.parse(content);
        if (isRecord(parsed)) {
          if (isRecord(parsed["dependencies"])) {
            for (const name of Object.keys(parsed["dependencies"])) {
              deps.set(name, { name, isDev: false, language: "javascript" });
            }
          }
          if (isRecord(parsed["devDependencies"])) {
            for (const name of Object.keys(parsed["devDependencies"])) {
              deps.set(name, { name, isDev: true, language: "javascript" });
            }
          }
        }
      } catch {
      }
    }
    const reqPath = join(projectRoot, "requirements.txt");
    if (existsSync(reqPath)) {
      try {
        const content = await readFile(reqPath, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "" || trimmed.startsWith("#")) continue;
          const match = /^([a-zA-Z0-9_-]+)/.exec(trimmed);
          if (match?.[1] !== void 0) {
            const name = match[1].toLowerCase();
            deps.set(name, { name, isDev: false, language: "python" });
          }
        }
      } catch {
      }
    }
    const pyprojectPath = join(projectRoot, "pyproject.toml");
    if (existsSync(pyprojectPath)) {
      try {
        const content = await readFile(pyprojectPath, "utf-8");
        const depMatches = content.matchAll(/"([a-zA-Z0-9_-]+)"/g);
        for (const match of depMatches) {
          if (match[1] !== void 0) {
            const name = match[1].toLowerCase();
            deps.set(name, { name, isDev: false, language: "python" });
          }
        }
      } catch {
      }
    }
    const cargoPath = join(projectRoot, "Cargo.toml");
    if (existsSync(cargoPath)) {
      try {
        const content = await readFile(cargoPath, "utf-8");
        const inDepsSection = /\[dependencies\]([\s\S]*?)(?=\n\[|$)/;
        const depsMatch = inDepsSection.exec(content);
        if (depsMatch?.[1] !== void 0) {
          const depsSection = depsMatch[1];
          const cratePattern = /^([a-zA-Z0-9_-]+)\s*=/gm;
          for (const match of depsSection.matchAll(cratePattern)) {
            if (match[1] !== void 0) {
              deps.set(match[1], { name: match[1], isDev: false, language: "rust" });
            }
          }
        }
        const inDevDepsSection = /\[dev-dependencies\]([\s\S]*?)(?=\n\[|$)/;
        const devDepsMatch = inDevDepsSection.exec(content);
        if (devDepsMatch?.[1] !== void 0) {
          const devDepsSection = devDepsMatch[1];
          const cratePattern = /^([a-zA-Z0-9_-]+)\s*=/gm;
          for (const match of devDepsSection.matchAll(cratePattern)) {
            if (match[1] !== void 0) {
              deps.set(match[1], { name: match[1], isDev: true, language: "rust" });
            }
          }
        }
      } catch {
      }
    }
    const goModPath = join(projectRoot, "go.mod");
    if (existsSync(goModPath)) {
      try {
        const content = await readFile(goModPath, "utf-8");
        const requirePattern = /^\s*([a-zA-Z0-9._/-]+)\s+v[\d.]+/gm;
        for (const match of content.matchAll(requirePattern)) {
          if (match[1] !== void 0 && !match[1].startsWith("//")) {
            deps.set(match[1], { name: match[1], isDev: false, language: "go" });
          }
        }
      } catch {
      }
    }
    return deps;
  }
};

// src/analysis/repo-url-resolver.ts
function isObject(value) {
  return typeof value === "object" && value !== null;
}
var RepoUrlResolver = class {
  /**
   * Find the GitHub repository URL for a package
   */
  async findRepoUrl(packageName, language = "javascript") {
    let registryUrl = null;
    switch (language) {
      case "javascript":
        registryUrl = await this.tryNpmRegistry(packageName);
        break;
      case "python":
        registryUrl = await this.tryPyPiRegistry(packageName);
        break;
      case "rust":
        registryUrl = await this.tryCratesRegistry(packageName);
        break;
      case "go":
        registryUrl = await this.tryGoModule(packageName);
        break;
    }
    if (registryUrl !== null) {
      return { url: registryUrl, confidence: "high", source: "registry" };
    }
    return { url: null, confidence: "low", source: "fallback" };
  }
  /**
   * Query NPM registry for package metadata
   */
  async tryNpmRegistry(packageName) {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (!isObject(data)) {
        return null;
      }
      if ("repository" in data) {
        const repo = data["repository"];
        if (isObject(repo) && "url" in repo) {
          const urlValue = repo["url"];
          const url = String(urlValue);
          return this.normalizeRepoUrl(url);
        }
        if (typeof repo === "string") {
          return this.normalizeRepoUrl(repo);
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Query PyPI registry for package metadata
   */
  async tryPyPiRegistry(packageName) {
    try {
      const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (!isObject(data)) {
        return null;
      }
      if ("info" in data) {
        const info = data["info"];
        if (isObject(info) && "project_urls" in info) {
          const projectUrls = info["project_urls"];
          if (isObject(projectUrls)) {
            const urlKeys = ["Source", "Repository", "Code", "Homepage"];
            for (const key of urlKeys) {
              if (key in projectUrls) {
                const urlValue = projectUrls[key];
                const url = String(urlValue);
                if (url.includes("github.com")) {
                  return this.normalizeRepoUrl(url);
                }
              }
            }
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Query crates.io registry for Rust crate metadata
   */
  async tryCratesRegistry(crateName) {
    try {
      const response = await fetch(`https://crates.io/api/v1/crates/${crateName}`, {
        headers: {
          // crates.io requires a User-Agent header
          "User-Agent": "bluera-knowledge (https://github.com/blueraai/bluera-knowledge)"
        }
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (!isObject(data)) {
        return null;
      }
      if ("crate" in data) {
        const crate = data["crate"];
        if (isObject(crate) && "repository" in crate) {
          const repo = crate["repository"];
          if (typeof repo === "string") {
            return this.normalizeRepoUrl(repo);
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Resolve Go module to GitHub repository
   * Go modules often use GitHub URLs directly (e.g., github.com/gorilla/mux)
   */
  async tryGoModule(moduleName) {
    try {
      if (moduleName.startsWith("github.com/")) {
        const parts = moduleName.split("/");
        const owner = parts[1];
        const repo = parts[2];
        if (owner !== void 0 && repo !== void 0) {
          return `https://github.com/${owner}/${repo}`;
        }
      }
      const response = await fetch(`https://proxy.golang.org/${moduleName}/@latest`, {
        headers: {
          "User-Agent": "bluera-knowledge (https://github.com/blueraai/bluera-knowledge)"
        }
      });
      if (!response.ok) {
        return null;
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Normalize various repository URL formats to standard GitHub URL
   */
  normalizeRepoUrl(url) {
    let normalized = url.replace(/^git\+/, "");
    normalized = normalized.replace(/\.git$/, "");
    normalized = normalized.replace(/^git:\/\//, "https://");
    normalized = normalized.replace(/^ssh:\/\/git@/, "https://");
    normalized = normalized.replace(/^git@github\.com:/, "https://github.com/");
    if (normalized.includes("github.com")) {
      return normalized;
    }
    return null;
  }
};

// src/plugin/commands.ts
async function handleAddRepo(args) {
  const services = await createServices(void 0, void 0, process.env["PWD"]);
  const storeName = args.name ?? extractRepoName(args.url);
  console.log(`Cloning ${args.url}...`);
  const result = await services.store.create({
    name: storeName,
    type: "repo",
    url: args.url,
    ...args.branch !== void 0 ? { branch: args.branch } : {}
  });
  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
  console.log(`Created store: ${storeName} (${result.data.id})`);
  if ("path" in result.data) {
    console.log(`Location: ${result.data.path}`);
  }
  console.log("\nIndexing...");
  const indexResult = await services.index.indexStore(result.data);
  if (indexResult.success) {
    console.log(`Indexed ${String(indexResult.data.documentsIndexed)} files`);
  } else {
    console.error(`Indexing failed: ${indexResult.error.message}`);
  }
}
async function handleAddFolder(args) {
  const services = await createServices(void 0, void 0, process.env["PWD"]);
  const { basename } = await import("path");
  const storeName = args.name ?? basename(args.path);
  console.log(`Adding folder: ${args.path}...`);
  const result = await services.store.create({
    name: storeName,
    type: "file",
    path: args.path
  });
  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
  console.log(`Created store: ${storeName} (${result.data.id})`);
  if ("path" in result.data) {
    console.log(`Location: ${result.data.path}`);
  }
  console.log("\nIndexing...");
  const indexResult = await services.index.indexStore(result.data);
  if (indexResult.success) {
    console.log(`Indexed ${String(indexResult.data.documentsIndexed)} files`);
  } else {
    console.error(`Indexing failed: ${indexResult.error.message}`);
  }
}
async function handleStores() {
  const services = await createServices(void 0, void 0, process.env["PWD"]);
  const stores = await services.store.list();
  if (stores.length === 0) {
    console.log("No stores found.");
    console.log("\nCreate a store with:");
    console.log("  /bluera-knowledge:add-repo <url> --name=<name>");
    console.log("  /bluera-knowledge:add-folder <path> --name=<name>");
    return;
  }
  console.log("| Name | Type | ID | Source |");
  console.log("|------|------|----|--------------------|");
  for (const store of stores) {
    const name = store.name;
    const type = store.type;
    const id = store.id;
    let source = "";
    if ("url" in store && store.url !== void 0) {
      source = store.url;
    } else if ("path" in store) {
      source = store.path;
    }
    console.log(`| ${name} | ${type} | ${id.substring(0, 8)}... | ${source} |`);
  }
}
async function handleSuggest() {
  const projectRoot = process.env["PWD"] ?? process.cwd();
  console.log("Analyzing project dependencies...\n");
  const services = await createServices(void 0, void 0, projectRoot);
  const analyzer = new DependencyUsageAnalyzer();
  const resolver = new RepoUrlResolver();
  const spinner = ora3("Scanning source files...").start();
  const result = await analyzer.analyze(projectRoot, (current, total, message) => {
    spinner.text = `${message} (${String(current)}/${String(total)})`;
  });
  spinner.stop();
  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
  const { usages, totalFilesScanned, skippedFiles } = result.data;
  console.log(
    `\u2714 Scanned ${String(totalFilesScanned)} files${skippedFiles > 0 ? ` (skipped ${String(skippedFiles)})` : ""}
`
  );
  if (usages.length === 0) {
    console.log("No external dependencies found in this project.");
    console.log("\nMake sure you have a package.json or requirements.txt file.");
    return;
  }
  const existingStores = await services.store.list();
  const existingRepoNames = new Set(existingStores.map((s) => s.name));
  const newUsages = usages.filter((u) => !existingRepoNames.has(u.packageName));
  if (newUsages.length === 0) {
    console.log("\u2714 All dependencies are already in knowledge stores!");
    return;
  }
  const topSuggestions = newUsages.slice(0, 5);
  console.log("Top dependencies by usage in this project:\n");
  topSuggestions.forEach((usage, i) => {
    console.log(`${String(i + 1)}. ${usage.packageName}`);
    console.log(
      `   ${String(usage.importCount)} imports across ${String(usage.fileCount)} files
`
    );
  });
  console.log("Searching for repository URLs...\n");
  for (const usage of topSuggestions) {
    const repoResult = await resolver.findRepoUrl(usage.packageName, usage.language);
    if (repoResult.url !== null) {
      console.log(`\u2714 ${usage.packageName}: ${repoResult.url}`);
      console.log(`  /bluera-knowledge:add-repo ${repoResult.url} --name=${usage.packageName}
`);
    } else {
      console.log(`\u2717 ${usage.packageName}: Could not find repository URL`);
      console.log(
        `  You can manually add it: /bluera-knowledge:add-repo <url> --name=${usage.packageName}
`
      );
    }
  }
  console.log("Use the commands above to add repositories to your knowledge stores.");
}

// src/cli/commands/plugin-api.ts
function createAddRepoCommand(_getOptions) {
  return new Command4("add-repo").description("Clone and index a library source repository").argument("<url>", "Git repository URL").option("--name <name>", "Store name (defaults to repo name)").option("--branch <branch>", "Git branch to clone").action(async (url, options) => {
    await handleAddRepo({ url, ...options });
  });
}
function createAddFolderCommand(_getOptions) {
  return new Command4("add-folder").description("Index a local folder of reference material").argument("<path>", "Folder path to index").option("--name <name>", "Store name (defaults to folder name)").action(async (path, options) => {
    await handleAddFolder({ path, ...options });
  });
}
function createStoresCommand(_getOptions) {
  return new Command4("stores").description("List all indexed library stores").action(async () => {
    await handleStores();
  });
}
function createSuggestCommand(_getOptions) {
  return new Command4("suggest").description("Suggest important dependencies to add to knowledge stores").action(async () => {
    await handleSuggest();
  });
}

// src/cli/commands/search.ts
import { Command as Command5 } from "commander";
function createSearchCommand(getOptions) {
  const search = new Command5("search").description("Search indexed documents using vector similarity + full-text matching").argument("<query>", "Search query").option(
    "-s, --stores <stores>",
    "Limit search to specific stores (comma-separated IDs or names)"
  ).option(
    "-m, --mode <mode>",
    "vector (embeddings only), fts (text only), hybrid (both, default)",
    "hybrid"
  ).option("-n, --limit <count>", "Maximum results to return (default: 10)", "10").option("-t, --threshold <score>", "Minimum score 0-1; omit low-relevance results").option(
    "--min-relevance <score>",
    "Minimum raw cosine similarity 0-1; returns empty if no results meet threshold"
  ).option("--include-content", "Show full document content, not just preview snippet").option(
    "--detail <level>",
    "Context detail: minimal, contextual, full (default: minimal)",
    "minimal"
  ).action(
    async (query, options) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      let exitCode = 0;
      try {
        let storeIds = (await services.store.list()).map((s) => s.id);
        searchLogic: {
          if (options.stores !== void 0) {
            const requestedStores = options.stores.split(",").map((s) => s.trim());
            const resolvedStores = [];
            for (const requested of requestedStores) {
              const store = await services.store.getByIdOrName(requested);
              if (store !== void 0) {
                resolvedStores.push(store.id);
              } else {
                console.error(`Error: Store not found: ${requested}`);
                exitCode = 3;
                break searchLogic;
              }
            }
            storeIds = resolvedStores;
          }
          if (storeIds.length === 0) {
            console.error("No stores to search. Create a store first.");
            exitCode = 1;
            break searchLogic;
          }
          for (const storeId of storeIds) {
            await services.lance.initialize(storeId);
          }
          const results = await services.search.search({
            query,
            stores: storeIds,
            mode: options.mode ?? "hybrid",
            limit: parseInt(options.limit ?? "10", 10),
            threshold: options.threshold !== void 0 ? parseFloat(options.threshold) : void 0,
            minRelevance: options.minRelevance !== void 0 ? parseFloat(options.minRelevance) : void 0,
            includeContent: options.includeContent,
            detail: options.detail ?? "minimal"
          });
          if (globalOpts.format === "json") {
            console.log(JSON.stringify(results, null, 2));
          } else if (globalOpts.quiet === true) {
            for (const r of results.results) {
              const path = r.metadata.path ?? r.metadata.url ?? "unknown";
              console.log(path);
            }
          } else {
            console.log(`
Search: "${query}"`);
            let statusLine = `Mode: ${results.mode} | Detail: ${String(options.detail)} | Stores: ${String(results.stores.length)} | Results: ${String(results.totalResults)} | Time: ${String(results.timeMs)}ms`;
            if (results.confidence !== void 0) {
              statusLine += ` | Confidence: ${results.confidence}`;
            }
            if (results.maxRawScore !== void 0) {
              statusLine += ` | MaxRaw: ${results.maxRawScore.toFixed(3)}`;
            }
            console.log(`${statusLine}
`);
            if (results.results.length === 0) {
              if (results.confidence === "low") {
                console.log("No sufficiently relevant results found.\n");
              } else {
                console.log("No results found.\n");
              }
            } else {
              for (let i = 0; i < results.results.length; i++) {
                const r = results.results[i];
                if (r === void 0) continue;
                if (r.summary) {
                  console.log(
                    `${String(i + 1)}. [${r.score.toFixed(2)}] ${r.summary.type}: ${r.summary.name}`
                  );
                  console.log(`   ${r.summary.location}`);
                  console.log(`   ${r.summary.purpose}`);
                  if (r.context && options.detail !== "minimal") {
                    console.log(`   Imports: ${r.context.keyImports.slice(0, 3).join(", ")}`);
                    console.log(
                      `   Related: ${r.context.relatedConcepts.slice(0, 3).join(", ")}`
                    );
                  }
                  console.log();
                } else {
                  const path = r.metadata.path ?? r.metadata.url ?? "unknown";
                  console.log(`${String(i + 1)}. [${r.score.toFixed(2)}] ${path}`);
                  const preview = r.highlight ?? r.content.slice(0, 150).replace(/\n/g, " ") + (r.content.length > 150 ? "..." : "");
                  console.log(`   ${preview}
`);
                }
              }
            }
          }
        }
      } finally {
        await destroyServices(services);
      }
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    }
  );
  return search;
}

// src/cli/commands/serve.ts
import { serve } from "@hono/node-server";
import { Command as Command6 } from "commander";

// src/server/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
var CreateStoreBodySchema = z.object({
  name: z.string().min(1, "Store name must be a non-empty string"),
  type: z.enum(["file", "repo", "web"]),
  path: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  branch: z.string().optional(),
  depth: z.number().int().positive().optional()
}).refine(
  (data) => {
    switch (data.type) {
      case "file":
        return data.path !== void 0;
      case "web":
        return data.url !== void 0;
      case "repo":
        return data.path !== void 0 || data.url !== void 0;
    }
  },
  {
    message: "Missing required field: file stores need path, web stores need url, repo stores need path or url"
  }
);
var SearchBodySchema = z.object({
  query: z.string().min(1, "Query must be a non-empty string"),
  detail: z.enum(["minimal", "contextual", "full"]).optional(),
  limit: z.number().int().positive().optional(),
  stores: z.array(z.string()).optional()
});
function createApp(services) {
  const app = new Hono();
  app.use("*", cors());
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/api/stores", async (c) => {
    const stores = await services.store.list();
    return c.json(stores);
  });
  app.post("/api/stores", async (c) => {
    const jsonData = await c.req.json();
    const parseResult = CreateStoreBodySchema.safeParse(jsonData);
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.issues[0]?.message ?? "Invalid request body" }, 400);
    }
    const result = await services.store.create(parseResult.data);
    if (result.success) {
      return c.json(result.data, 201);
    }
    return c.json({ error: result.error.message }, 400);
  });
  app.get("/api/stores/:id", async (c) => {
    const store = await services.store.getByIdOrName(c.req.param("id"));
    if (!store) return c.json({ error: "Not found" }, 404);
    return c.json(store);
  });
  app.delete("/api/stores/:id", async (c) => {
    const store = await services.store.getByIdOrName(c.req.param("id"));
    if (!store) return c.json({ error: "Not found" }, 404);
    const result = await services.store.delete(store.id);
    if (result.success) return c.json({ deleted: true });
    return c.json({ error: result.error.message }, 400);
  });
  app.post("/api/search", async (c) => {
    const jsonData = await c.req.json();
    const parseResult = SearchBodySchema.safeParse(jsonData);
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.issues[0]?.message ?? "Invalid request body" }, 400);
    }
    const storeIds = (await services.store.list()).map((s) => s.id);
    for (const id of storeIds) {
      await services.lance.initialize(id);
    }
    const requestedStores = parseResult.data.stores !== void 0 ? parseResult.data.stores.map((s) => createStoreId(s)) : storeIds;
    const query = {
      query: parseResult.data.query,
      detail: parseResult.data.detail ?? "minimal",
      limit: parseResult.data.limit ?? 10,
      stores: requestedStores
    };
    const results = await services.search.search(query);
    return c.json(results);
  });
  app.post("/api/stores/:id/index", async (c) => {
    const store = await services.store.getByIdOrName(c.req.param("id"));
    if (!store) return c.json({ error: "Not found" }, 404);
    await services.lance.initialize(store.id);
    const result = await services.index.indexStore(store);
    if (result.success) return c.json(result.data);
    return c.json({ error: result.error.message }, 400);
  });
  return app;
}

// src/cli/commands/serve.ts
function createServeCommand(getOptions) {
  return new Command6("serve").description("Start HTTP API server for programmatic search access").option("-p, --port <port>", "Port to listen on (default: 3847)", "3847").option(
    "--host <host>",
    "Bind address (default: 127.0.0.1, use 0.0.0.0 for all interfaces)",
    "127.0.0.1"
  ).action(async (options) => {
    const globalOpts = getOptions();
    const services = await createServices(globalOpts.config, globalOpts.dataDir);
    const app = createApp(services);
    const port = parseInt(options.port ?? "3847", 10);
    const host = options.host ?? "127.0.0.1";
    const shutdown = () => {
      void (async () => {
        await destroyServices(services);
        process.exit(0);
      })();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    console.log(`Starting server on http://${host}:${String(port)}`);
    serve({
      fetch: app.fetch,
      port,
      hostname: host
    });
  });
}

// src/cli/commands/setup.ts
import { spawnSync } from "child_process";
import { existsSync as existsSync2 } from "fs";
import { mkdir } from "fs/promises";
import { homedir } from "os";
import { join as join2 } from "path";
import { Command as Command7 } from "commander";
import ora4 from "ora";

// src/defaults/repos.ts
var DEFAULT_REPOS = [
  {
    url: "git@github.com:ericbuess/claude-code-docs.git",
    name: "claude-code-docs",
    description: "Claude Code documentation",
    tags: ["claude", "docs", "claude-code"]
  },
  {
    url: "git@github.com:anthropics/claude-code.git",
    name: "claude-code",
    description: "Claude Code CLI tool source",
    tags: ["claude", "cli", "anthropic"]
  },
  {
    url: "git@github.com:anthropics/claude-agent-sdk-python.git",
    name: "claude-agent-sdk-python",
    description: "Claude Agent SDK for Python",
    tags: ["claude", "sdk", "python", "agents"]
  },
  {
    url: "git@github.com:anthropics/skills.git",
    name: "claude-skills",
    description: "Claude skills and capabilities",
    tags: ["claude", "skills"]
  },
  {
    url: "git@github.com:anthropics/claude-quickstarts.git",
    name: "claude-quickstarts",
    description: "Claude quickstart examples and tutorials",
    tags: ["claude", "examples", "tutorials"]
  },
  {
    url: "git@github.com:anthropics/claude-plugins-official.git",
    name: "claude-plugins",
    description: "Official Claude plugins",
    tags: ["claude", "plugins"]
  },
  {
    url: "git@github.com:anthropics/claude-agent-sdk-typescript.git",
    name: "claude-agent-sdk-typescript",
    description: "Claude Agent SDK for TypeScript",
    tags: ["claude", "sdk", "typescript", "agents"]
  },
  {
    url: "git@github.com:anthropics/claude-agent-sdk-demos.git",
    name: "claude-agent-sdk-demos",
    description: "Claude Agent SDK demo applications",
    tags: ["claude", "sdk", "demos", "examples"]
  }
];

// src/cli/commands/setup.ts
var DEFAULT_REPOS_DIR = join2(homedir(), ".bluera", "bluera-knowledge", "repos");
function createSetupCommand(getOptions) {
  const setup = new Command7("setup").description(
    "Quick-start with pre-configured Claude/Anthropic documentation repos"
  );
  setup.command("repos").description(
    "Clone repos to ~/.bluera/bluera-knowledge/repos/, create stores, index all content"
  ).option(
    "--repos-dir <path>",
    "Clone destination (default: ~/.bluera/bluera-knowledge/repos/)",
    DEFAULT_REPOS_DIR
  ).option("--skip-clone", "Don't clone; assume repos already exist locally").option("--skip-index", "Clone and create stores but don't index yet").option("--only <names>", "Only process matching repos (comma-separated, partial match)").option("--list", "Print available repos without cloning/indexing").action(
    async (options) => {
      const globalOpts = getOptions();
      if (options.list === true) {
        console.log("\nDefault repositories:\n");
        for (const repo of DEFAULT_REPOS) {
          console.log(`  ${repo.name}`);
          console.log(`    URL: ${repo.url}`);
          console.log(`    Description: ${repo.description}`);
          console.log(`    Tags: ${repo.tags.join(", ")}`);
          console.log("");
        }
        return;
      }
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      try {
        let repos = DEFAULT_REPOS;
        if (options.only !== void 0 && options.only !== "") {
          const onlyNames = options.only.split(",").map((n) => n.trim().toLowerCase());
          repos = DEFAULT_REPOS.filter(
            (r) => onlyNames.some((n) => r.name.toLowerCase().includes(n))
          );
          if (repos.length === 0) {
            console.error(`No repos matched: ${options.only}`);
            console.log("Available repos:", DEFAULT_REPOS.map((r) => r.name).join(", "));
            process.exit(1);
          }
        }
        console.log(`
Setting up ${String(repos.length)} repositories...
`);
        await mkdir(options.reposDir, { recursive: true });
        for (const repo of repos) {
          const repoPath = join2(options.reposDir, repo.name);
          const spinner = ora4(`Processing ${repo.name}`).start();
          try {
            if (options.skipClone !== true) {
              if (existsSync2(repoPath)) {
                spinner.text = `${repo.name}: Already cloned, pulling latest...`;
                const pullResult = spawnSync("git", ["pull", "--ff-only"], {
                  cwd: repoPath,
                  stdio: "pipe"
                });
                if (pullResult.status !== 0) {
                  spinner.text = `${repo.name}: Pull skipped (local changes)`;
                }
              } else {
                spinner.text = `${repo.name}: Cloning...`;
                const cloneResult = spawnSync("git", ["clone", repo.url, repoPath], {
                  stdio: "pipe"
                });
                if (cloneResult.status !== 0) {
                  const errorMessage = cloneResult.stderr.length > 0 ? cloneResult.stderr.toString() : "Git clone failed";
                  throw new Error(errorMessage);
                }
              }
            }
            spinner.text = `${repo.name}: Creating store...`;
            const existingStore = await services.store.getByIdOrName(repo.name);
            let storeId;
            if (existingStore) {
              storeId = existingStore.id;
              spinner.text = `${repo.name}: Store already exists`;
            } else {
              const result = await services.store.create({
                name: repo.name,
                type: "repo",
                path: repoPath,
                description: repo.description,
                tags: repo.tags
              });
              if (!result.success) {
                throw new Error(
                  result.error instanceof Error ? result.error.message : String(result.error)
                );
              }
              storeId = result.data.id;
            }
            if (options.skipIndex !== true) {
              spinner.text = `${repo.name}: Indexing...`;
              const store = await services.store.getByIdOrName(storeId);
              if (store) {
                await services.lance.initialize(store.id);
                const indexResult = await services.index.indexStore(store, (event) => {
                  if (event.type === "progress") {
                    spinner.text = `${repo.name}: Indexing ${String(event.current)}/${String(event.total)} files`;
                  }
                });
                if (indexResult.success) {
                  spinner.succeed(
                    `${repo.name}: ${String(indexResult.data.documentsIndexed)} docs, ${String(indexResult.data.chunksCreated)} chunks`
                  );
                } else {
                  throw new Error(
                    indexResult.error instanceof Error ? indexResult.error.message : String(indexResult.error)
                  );
                }
              }
            } else {
              spinner.succeed(`${repo.name}: Ready (indexing skipped)`);
            }
          } catch (error) {
            spinner.fail(
              `${repo.name}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
        console.log('\nSetup complete! Use "bluera-knowledge search <query>" to search.\n');
      } finally {
        await destroyServices(services);
      }
    }
  );
  return setup;
}

// src/cli/commands/store.ts
import { Command as Command8 } from "commander";
function createStoreCommand(getOptions) {
  const store = new Command8("store").description(
    "Manage knowledge stores (collections of indexed documents)"
  );
  store.command("list").description("Show all stores with their type (file/repo/web) and ID").option("-t, --type <type>", "Filter by type: file, repo, or web").action(async (options) => {
    const globalOpts = getOptions();
    const services = await createServices(globalOpts.config, globalOpts.dataDir);
    try {
      const stores = await services.store.list(options.type);
      if (globalOpts.format === "json") {
        console.log(JSON.stringify(stores, null, 2));
      } else if (globalOpts.quiet === true) {
        for (const s of stores) {
          console.log(s.name);
        }
      } else {
        if (stores.length === 0) {
          console.log("No stores found.");
        } else {
          console.log("\nStores:\n");
          for (const s of stores) {
            console.log(`  ${s.name} (${s.type}) - ${s.id}`);
          }
          console.log("");
        }
      }
    } finally {
      await destroyServices(services);
    }
  });
  store.command("create <name>").description("Create a new store pointing to a local path or URL").requiredOption(
    "-t, --type <type>",
    "Store type: file (local dir), repo (git), web (crawled site)"
  ).requiredOption("-s, --source <path>", "Local path for file/repo stores, URL for web stores").option("-d, --description <desc>", "Optional description for the store").option("--tags <tags>", "Comma-separated tags for filtering").action(
    async (name, options) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      let exitCode = 0;
      try {
        const isUrl = options.source.startsWith("http://") || options.source.startsWith("https://");
        const result = await services.store.create({
          name,
          type: options.type,
          path: options.type === "file" || options.type === "repo" && !isUrl ? options.source : void 0,
          url: options.type === "web" || options.type === "repo" && isUrl ? options.source : void 0,
          description: options.description,
          tags: options.tags?.split(",").map((t) => t.trim())
        });
        if (result.success) {
          if (globalOpts.format === "json") {
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            console.log(`
Created store: ${result.data.name} (${result.data.id})
`);
          }
        } else {
          console.error(`Error: ${result.error.message}`);
          exitCode = 1;
        }
      } finally {
        await destroyServices(services);
      }
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    }
  );
  store.command("info <store>").description("Show store details: ID, type, path/URL, timestamps").action(async (storeIdOrName) => {
    const globalOpts = getOptions();
    const services = await createServices(globalOpts.config, globalOpts.dataDir);
    try {
      const s = await services.store.getByIdOrName(storeIdOrName);
      if (s === void 0) {
        console.error(`Error: Store not found: ${storeIdOrName}`);
        process.exit(3);
      }
      if (globalOpts.format === "json") {
        console.log(JSON.stringify(s, null, 2));
      } else {
        console.log(`
Store: ${s.name}`);
        console.log(`  ID: ${s.id}`);
        console.log(`  Type: ${s.type}`);
        if ("path" in s) console.log(`  Path: ${s.path}`);
        if ("url" in s && s.url !== void 0) console.log(`  URL: ${s.url}`);
        if (s.description !== void 0) console.log(`  Description: ${s.description}`);
        console.log(`  Created: ${s.createdAt.toISOString()}`);
        console.log(`  Updated: ${s.updatedAt.toISOString()}`);
        console.log("");
      }
    } finally {
      await destroyServices(services);
    }
  });
  store.command("delete <store>").description("Remove store and its indexed documents from LanceDB").option("-f, --force", "Delete without confirmation prompt").option("-y, --yes", "Alias for --force").action(async (storeIdOrName, options) => {
    const globalOpts = getOptions();
    const services = await createServices(globalOpts.config, globalOpts.dataDir);
    try {
      const s = await services.store.getByIdOrName(storeIdOrName);
      if (s === void 0) {
        console.error(`Error: Store not found: ${storeIdOrName}`);
        process.exit(3);
      }
      const skipConfirmation = options.force === true || options.yes === true;
      if (!skipConfirmation) {
        if (!process.stdin.isTTY) {
          console.error(
            "Error: Use --force or -y to delete without confirmation in non-interactive mode"
          );
          process.exit(1);
        }
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        const answer = await new Promise((resolve) => {
          rl.question(`Delete store "${s.name}"? [y/N] `, resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
          console.log("Cancelled.");
          process.exit(0);
        }
      }
      const result = await services.store.delete(s.id);
      if (result.success) {
        console.log(`Deleted store: ${s.name}`);
      } else {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
    } finally {
      await destroyServices(services);
    }
  });
  return store;
}

// src/cli/program.ts
import { readFileSync } from "fs";
import { dirname, join as join3 } from "path";
import { fileURLToPath } from "url";
import { Command as Command9 } from "commander";
function getVersion() {
  const __filename2 = fileURLToPath(import.meta.url);
  const __dirname2 = dirname(__filename2);
  const content = readFileSync(join3(__dirname2, "../package.json"), "utf-8");
  const pkg = JSON.parse(content);
  return pkg.version;
}
var version = getVersion();
function createProgram() {
  const program2 = new Command9();
  program2.name("bluera-knowledge").description("CLI tool for managing knowledge stores with semantic search").version(version);
  program2.option("-c, --config <path>", "Path to config file").option("-d, --data-dir <path>", "Data directory").option("-p, --project-root <path>", "Project root directory (for resolving relative paths)").option("-f, --format <format>", "Output format: json | table | plain", "table").option("-q, --quiet", "Suppress non-essential output").option("-v, --verbose", "Enable verbose logging");
  return program2;
}
function getGlobalOptions(program2) {
  const opts = program2.opts();
  return {
    config: opts.config,
    dataDir: opts.dataDir,
    projectRoot: opts.projectRoot,
    format: opts.format,
    quiet: opts.quiet,
    verbose: opts.verbose
  };
}

// src/index.ts
var DEFAULT_DATA_DIR = join4(homedir2(), ".bluera", "bluera-knowledge", "data");
var DEFAULT_CONFIG = join4(homedir2(), ".bluera", "bluera-knowledge", "config.json");
var DEFAULT_REPOS_DIR2 = join4(homedir2(), ".bluera", "bluera-knowledge", "repos");
function formatCommandHelp(cmd, indent = "") {
  const lines = [];
  const name = cmd.name();
  const desc = cmd.description();
  const args = cmd.registeredArguments.map((a) => {
    const req = a.required;
    return req ? `<${a.name()}>` : `[${a.name()}]`;
  }).join(" ");
  lines.push(`${indent}${name}${args ? ` ${args}` : ""}`);
  if (desc) {
    lines.push(`${indent}  ${desc}`);
  }
  const options = cmd.options.filter((o) => o.flags !== "-h, --help");
  for (const opt of options) {
    lines.push(`${indent}  ${opt.flags.padEnd(28)} ${opt.description}`);
  }
  const subcommands = cmd.commands.filter((c) => c.name() !== "help");
  for (const sub of subcommands) {
    lines.push("");
    lines.push(...formatCommandHelp(sub, `${indent}  `));
  }
  return lines;
}
function printFullHelp(program2) {
  console.log("bluera-knowledge - CLI tool for managing knowledge stores with semantic search\n");
  console.log("Paths:");
  console.log(`  data        ${DEFAULT_DATA_DIR}`);
  console.log(`  config      ${DEFAULT_CONFIG}`);
  console.log(`  repos       ${DEFAULT_REPOS_DIR2}`);
  console.log("\nGlobal options:");
  const globalOpts = program2.options.filter(
    (o) => o.flags !== "-h, --help" && o.flags !== "-V, --version"
  );
  for (const opt of globalOpts) {
    console.log(`  ${opt.flags.padEnd(28)} ${opt.description}`);
  }
  console.log("\nCommands:\n");
  const commands = program2.commands.filter((c) => c.name() !== "help");
  for (const cmd of commands) {
    console.log(formatCommandHelp(cmd).join("\n"));
    console.log("");
  }
}
var program = createProgram();
program.addCommand(createAddRepoCommand(() => getGlobalOptions(program)));
program.addCommand(createAddFolderCommand(() => getGlobalOptions(program)));
program.addCommand(createStoresCommand(() => getGlobalOptions(program)));
program.addCommand(createSuggestCommand(() => getGlobalOptions(program)));
program.addCommand(createStoreCommand(() => getGlobalOptions(program)));
program.addCommand(createSearchCommand(() => getGlobalOptions(program)));
program.addCommand(createIndexCommand(() => getGlobalOptions(program)));
program.addCommand(createServeCommand(() => getGlobalOptions(program)));
program.addCommand(createCrawlCommand(() => getGlobalOptions(program)));
program.addCommand(createSetupCommand(() => getGlobalOptions(program)));
program.addCommand(createMCPCommand(() => getGlobalOptions(program)));
if (process.argv.length <= 2) {
  printFullHelp(program);
  process.exit(0);
}
program.parse();
//# sourceMappingURL=index.js.map