import {
  JobService,
  createServices,
  createStoreId
} from "./chunk-EUE4BKMA.js";

// src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// src/mcp/schemas/index.ts
import { z } from "zod";
var SearchArgsSchema = z.object({
  query: z.string().min(1, "Query must be a non-empty string"),
  intent: z.enum(["find-pattern", "find-implementation", "find-usage", "find-definition", "find-documentation"]).optional(),
  detail: z.enum(["minimal", "contextual", "full"]).default("minimal"),
  limit: z.number().int().positive().default(10),
  stores: z.array(z.string()).optional()
});
var GetFullContextArgsSchema = z.object({
  resultId: z.string().min(1, "Result ID must be a non-empty string")
});
var ListStoresArgsSchema = z.object({
  type: z.enum(["file", "repo", "web"]).optional()
});
var GetStoreInfoArgsSchema = z.object({
  store: z.string().min(1, "Store name or ID must be a non-empty string")
});
var CreateStoreArgsSchema = z.object({
  name: z.string().min(1, "Store name must be a non-empty string"),
  type: z.enum(["file", "repo"]),
  source: z.string().min(1, "Source path or URL must be a non-empty string"),
  branch: z.string().optional(),
  description: z.string().optional()
});
var IndexStoreArgsSchema = z.object({
  store: z.string().min(1, "Store name or ID must be a non-empty string")
});
var DeleteStoreArgsSchema = z.object({
  store: z.string().min(1, "Store name or ID must be a non-empty string")
});
var CheckJobStatusArgsSchema = z.object({
  jobId: z.string().min(1, "Job ID must be a non-empty string")
});
var ListJobsArgsSchema = z.object({
  activeOnly: z.boolean().optional(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional()
});
var CancelJobArgsSchema = z.object({
  jobId: z.string().min(1, "Job ID must be a non-empty string")
});

// src/mcp/cache.ts
var LRUCache = class {
  cache = /* @__PURE__ */ new Map();
  maxSize;
  /**
   * Create a new LRU cache
   *
   * @param maxSize - Maximum number of items to store (default: 1000)
   */
  constructor(maxSize = 1e3) {
    this.maxSize = maxSize;
  }
  /**
   * Store a value in the cache
   *
   * If the key already exists, it will be moved to the end (most recent).
   * If the cache is at capacity, the oldest item will be evicted.
   *
   * @param key - The cache key
   * @param value - The value to store
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== void 0) {
        this.cache.delete(firstKey);
      }
    }
  }
  /**
   * Retrieve a value from the cache
   *
   * If the key exists, it will be moved to the end (most recent).
   *
   * @param key - The cache key
   * @returns The cached value, or undefined if not found
   */
  get(key) {
    const value = this.cache.get(key);
    if (value !== void 0) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  /**
   * Check if a key exists in the cache
   *
   * @param key - The cache key
   * @returns True if the key exists
   */
  has(key) {
    return this.cache.has(key);
  }
  /**
   * Remove a specific key from the cache
   *
   * @param key - The cache key
   * @returns True if the key was removed, false if it didn't exist
   */
  delete(key) {
    return this.cache.delete(key);
  }
  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
  }
  /**
   * Get the current number of items in the cache
   */
  get size() {
    return this.cache.size;
  }
};

// src/mcp/handlers/search.handler.ts
var resultCache = new LRUCache(1e3);
var handleSearch = async (args, context) => {
  const validated = SearchArgsSchema.parse(args);
  const { services } = context;
  const storeIds = validated.stores !== void 0 ? await Promise.all(validated.stores.map(async (s) => {
    const store = await services.store.getByIdOrName(s);
    if (!store) {
      throw new Error(`Store not found: ${s}`);
    }
    return store.id;
  })) : (await services.store.list()).map((s) => s.id);
  try {
    for (const storeId of storeIds) {
      await services.lance.initialize(storeId);
    }
  } catch (error) {
    throw new Error(
      `Failed to initialize vector stores: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const searchQuery = {
    query: validated.query,
    stores: storeIds,
    mode: "hybrid",
    limit: validated.limit,
    detail: validated.detail
  };
  const results = await services.search.search(searchQuery);
  for (const result of results.results) {
    resultCache.set(result.id, result);
  }
  const estimatedTokens = results.results.reduce((sum, r) => {
    let tokens = 100;
    if (r.context) tokens += 200;
    if (r.full) tokens += 800;
    return sum + tokens;
  }, 0);
  const enhancedResults = await Promise.all(results.results.map(async (r) => {
    const storeId = r.metadata.storeId;
    const store = await services.store.getByIdOrName(storeId);
    return {
      id: r.id,
      score: r.score,
      summary: {
        ...r.summary,
        storeName: store?.name,
        repoRoot: store !== void 0 && store.type === "repo" ? store.path : void 0
      },
      context: r.context,
      full: r.full
    };
  }));
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          results: enhancedResults,
          totalResults: results.totalResults,
          estimatedTokens,
          mode: results.mode,
          timeMs: results.timeMs
        }, null, 2)
      }
    ]
  };
};
var handleGetFullContext = async (args, context) => {
  const validated = GetFullContextArgsSchema.parse(args);
  const resultId = validated.resultId;
  const cachedResult = resultCache.get(resultId);
  if (!cachedResult) {
    throw new Error(
      `Result not found in cache: ${resultId}. Run a search first to cache results.`
    );
  }
  if (cachedResult.full) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: cachedResult.id,
            score: cachedResult.score,
            summary: cachedResult.summary,
            context: cachedResult.context,
            full: cachedResult.full
          }, null, 2)
        }
      ]
    };
  }
  const { services } = context;
  const store = await services.store.getByIdOrName(cachedResult.metadata.storeId);
  if (!store) {
    throw new Error(`Store not found: ${cachedResult.metadata.storeId}`);
  }
  await services.lance.initialize(store.id);
  const searchQuery = {
    query: cachedResult.content.substring(0, 100),
    // Use snippet of content as query
    stores: [store.id],
    mode: "hybrid",
    limit: 1,
    detail: "full"
  };
  const results = await services.search.search(searchQuery);
  const fullResult = results.results.find((r) => r.id === resultId);
  if (!fullResult) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: cachedResult.id,
            score: cachedResult.score,
            summary: cachedResult.summary,
            context: cachedResult.context,
            warning: "Could not retrieve full context, returning cached minimal result"
          }, null, 2)
        }
      ]
    };
  }
  resultCache.set(resultId, fullResult);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          id: fullResult.id,
          score: fullResult.score,
          summary: fullResult.summary,
          context: fullResult.context,
          full: fullResult.full
        }, null, 2)
      }
    ]
  };
};

// src/mcp/handlers/store.handler.ts
import { rm } from "fs/promises";
import { join } from "path";

// src/workers/spawn-worker.ts
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
function spawnBackgroundWorker(jobId, dataDir) {
  const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
  const isProduction = __dirname2.includes("/dist/");
  let command;
  let args;
  if (isProduction) {
    const workerScript = path.join(__dirname2, "background-worker-cli.js");
    command = process.execPath;
    args = [workerScript, jobId];
  } else {
    const workerScript = path.join(__dirname2, "background-worker-cli.ts");
    command = "npx";
    args = ["tsx", workerScript, jobId];
  }
  const worker = spawn(command, args, {
    detached: true,
    // Detach from parent process
    stdio: "ignore",
    // Don't pipe stdio (fully independent)
    env: {
      ...process.env,
      // Inherit environment variables
      BLUERA_DATA_DIR: dataDir
      // Pass dataDir to worker
    }
  });
  worker.unref();
}

// src/mcp/handlers/store.handler.ts
var handleListStores = async (args, context) => {
  const validated = ListStoresArgsSchema.parse(args);
  const { services } = context;
  const stores = await services.store.list();
  const filtered = validated.type !== void 0 ? stores.filter((s) => s.type === validated.type) : stores;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          stores: filtered.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            path: "path" in s ? s.path : void 0,
            url: "url" in s && s.url !== void 0 ? s.url : void 0,
            description: s.description,
            createdAt: s.createdAt.toISOString()
          }))
        }, null, 2)
      }
    ]
  };
};
var handleGetStoreInfo = async (args, context) => {
  const validated = GetStoreInfoArgsSchema.parse(args);
  const { services } = context;
  const store = await services.store.getByIdOrName(createStoreId(validated.store));
  if (store === void 0) {
    throw new Error(`Store not found: ${validated.store}`);
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          id: store.id,
          name: store.name,
          type: store.type,
          path: "path" in store ? store.path : void 0,
          url: "url" in store && store.url !== void 0 ? store.url : void 0,
          branch: "branch" in store ? store.branch : void 0,
          description: store.description,
          status: store.status,
          createdAt: store.createdAt.toISOString(),
          updatedAt: store.updatedAt.toISOString()
        }, null, 2)
      }
    ]
  };
};
var handleCreateStore = async (args, context) => {
  const validated = CreateStoreArgsSchema.parse(args);
  const { services, options } = context;
  const isUrl = validated.source.startsWith("http://") || validated.source.startsWith("https://") || validated.source.startsWith("git@");
  const result = await services.store.create({
    name: validated.name,
    type: validated.type,
    ...isUrl ? { url: validated.source } : { path: validated.source },
    ...validated.branch !== void 0 ? { branch: validated.branch } : {},
    ...validated.description !== void 0 ? { description: validated.description } : {}
  });
  if (!result.success) {
    throw new Error(result.error.message);
  }
  const jobService = new JobService(options.dataDir);
  const jobDetails = {
    storeName: result.data.name,
    storeId: result.data.id
  };
  if (isUrl) {
    jobDetails["url"] = validated.source;
  }
  if ("path" in result.data && result.data.path) {
    jobDetails["path"] = result.data.path;
  }
  const job = jobService.createJob({
    type: validated.type === "repo" && isUrl ? "clone" : "index",
    details: jobDetails,
    message: `Indexing ${result.data.name}...`
  });
  spawnBackgroundWorker(job.id, options.dataDir ?? "");
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          store: {
            id: result.data.id,
            name: result.data.name,
            type: result.data.type,
            path: "path" in result.data ? result.data.path : void 0
          },
          job: {
            id: job.id,
            status: job.status,
            message: job.message
          },
          message: `Store created. Indexing started in background (Job ID: ${job.id})`
        }, null, 2)
      }
    ]
  };
};
var handleIndexStore = async (args, context) => {
  const validated = IndexStoreArgsSchema.parse(args);
  const { services, options } = context;
  const store = await services.store.getByIdOrName(createStoreId(validated.store));
  if (store === void 0) {
    throw new Error(`Store not found: ${validated.store}`);
  }
  const jobService = new JobService(options.dataDir);
  const jobDetails = {
    storeName: store.name,
    storeId: store.id
  };
  if ("path" in store && store.path) {
    jobDetails["path"] = store.path;
  }
  const job = jobService.createJob({
    type: "index",
    details: jobDetails,
    message: `Re-indexing ${store.name}...`
  });
  spawnBackgroundWorker(job.id, options.dataDir ?? "");
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          store: {
            id: store.id,
            name: store.name
          },
          job: {
            id: job.id,
            status: job.status,
            message: job.message
          },
          message: `Indexing started in background (Job ID: ${job.id})`
        }, null, 2)
      }
    ]
  };
};
var handleDeleteStore = async (args, context) => {
  const validated = DeleteStoreArgsSchema.parse(args);
  const { services, options } = context;
  const store = await services.store.getByIdOrName(createStoreId(validated.store));
  if (store === void 0) {
    throw new Error(`Store not found: ${validated.store}`);
  }
  await services.lance.deleteStore(store.id);
  if (store.type === "repo" && "url" in store && store.url !== void 0) {
    if (options.dataDir === void 0) {
      throw new Error("dataDir is required to delete cloned repository files");
    }
    const repoPath = join(options.dataDir, "repos", store.id);
    await rm(repoPath, { recursive: true, force: true });
  }
  const result = await services.store.delete(store.id);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          deleted: true,
          store: {
            id: store.id,
            name: store.name,
            type: store.type
          },
          message: `Successfully deleted store: ${store.name}`
        }, null, 2)
      }
    ]
  };
};

// src/mcp/handlers/job.handler.ts
var handleCheckJobStatus = (args, context) => {
  const validated = CheckJobStatusArgsSchema.parse(args);
  const { options } = context;
  const jobService = new JobService(options.dataDir);
  const job = jobService.getJob(validated.jobId);
  if (!job) {
    throw new Error(`Job not found: ${validated.jobId}`);
  }
  return Promise.resolve({
    content: [
      {
        type: "text",
        text: JSON.stringify(job, null, 2)
      }
    ]
  });
};
var handleListJobs = (args, context) => {
  const validated = ListJobsArgsSchema.parse(args);
  const { options } = context;
  const jobService = new JobService(options.dataDir);
  let jobs;
  if (validated.activeOnly === true) {
    jobs = jobService.listActiveJobs();
  } else if (validated.status !== void 0) {
    jobs = jobService.listJobs(validated.status);
  } else {
    jobs = jobService.listJobs();
  }
  return Promise.resolve({
    content: [
      {
        type: "text",
        text: JSON.stringify({ jobs }, null, 2)
      }
    ]
  });
};
var handleCancelJob = (args, context) => {
  const validated = CancelJobArgsSchema.parse(args);
  const { options } = context;
  const jobService = new JobService(options.dataDir);
  const result = jobService.cancelJob(validated.jobId);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  const job = jobService.getJob(validated.jobId);
  return Promise.resolve({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          job,
          message: "Job cancelled successfully"
        }, null, 2)
      }
    ]
  });
};

// src/mcp/handlers/index.ts
var tools = [
  // Search tools
  {
    name: "search",
    description: "Search all indexed knowledge stores with pattern detection and AI-optimized results. Returns structured code units with progressive context layers.",
    schema: SearchArgsSchema,
    handler: handleSearch
  },
  {
    name: "get_full_context",
    description: "Get complete code and context for a specific search result by ID. Use this after search to get full implementation details.",
    schema: GetFullContextArgsSchema,
    handler: handleGetFullContext
  },
  // Store tools
  {
    name: "list_stores",
    description: "List all indexed knowledge stores (library sources, reference material, documentation)",
    schema: ListStoresArgsSchema,
    handler: handleListStores
  },
  {
    name: "get_store_info",
    description: "Get detailed information about a specific store including its file path for direct access",
    schema: GetStoreInfoArgsSchema,
    handler: handleGetStoreInfo
  },
  {
    name: "create_store",
    description: "Create a new knowledge store from git URL or local path",
    schema: CreateStoreArgsSchema,
    handler: handleCreateStore
  },
  {
    name: "index_store",
    description: "Index or re-index a knowledge store to make it searchable",
    schema: IndexStoreArgsSchema,
    handler: handleIndexStore
  },
  {
    name: "delete_store",
    description: "Delete a knowledge store and all associated data (database, cloned files)",
    schema: DeleteStoreArgsSchema,
    handler: handleDeleteStore
  },
  // Job tools
  {
    name: "check_job_status",
    description: "Check the status of a background job (clone, index, crawl operations)",
    schema: CheckJobStatusArgsSchema,
    handler: handleCheckJobStatus
  },
  {
    name: "list_jobs",
    description: "List all background jobs, optionally filtered by status",
    schema: ListJobsArgsSchema,
    handler: handleListJobs
  },
  {
    name: "cancel_job",
    description: "Cancel a running or pending background job",
    schema: CancelJobArgsSchema,
    handler: handleCancelJob
  }
];

// src/mcp/server.ts
function createMCPServer(options) {
  const server = new Server(
    {
      name: "bluera-knowledge",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return Promise.resolve({
      tools: [
        {
          name: "search",
          description: "Search all indexed knowledge stores with pattern detection and AI-optimized results. Returns structured code units with progressive context layers.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (can include type signatures, constraints, or natural language)"
              },
              intent: {
                type: "string",
                enum: ["find-pattern", "find-implementation", "find-usage", "find-definition", "find-documentation"],
                description: "Search intent for better ranking"
              },
              detail: {
                type: "string",
                enum: ["minimal", "contextual", "full"],
                default: "minimal",
                description: "Context detail level: minimal (summary only), contextual (+ imports/types), full (+ complete code)"
              },
              limit: {
                type: "number",
                default: 10,
                description: "Maximum number of results"
              },
              stores: {
                type: "array",
                items: { type: "string" },
                description: "Specific store IDs to search (optional)"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "list_stores",
          description: "List all indexed knowledge stores (library sources, reference material, documentation)",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["file", "repo", "web"],
                description: "Filter by store type (optional)"
              }
            }
          }
        },
        {
          name: "get_store_info",
          description: "Get detailed information about a specific store including its file path for direct access",
          inputSchema: {
            type: "object",
            properties: {
              store: {
                type: "string",
                description: "Store name or ID"
              }
            },
            required: ["store"]
          }
        },
        {
          name: "create_store",
          description: "Create a new knowledge store from git URL or local path",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Store name"
              },
              type: {
                type: "string",
                enum: ["file", "repo"],
                description: "Store type"
              },
              source: {
                type: "string",
                description: "Git URL or local path"
              },
              branch: {
                type: "string",
                description: "Git branch (for repo type)"
              },
              description: {
                type: "string",
                description: "Store description"
              }
            },
            required: ["name", "type", "source"]
          }
        },
        {
          name: "index_store",
          description: "Index or re-index a knowledge store to make it searchable",
          inputSchema: {
            type: "object",
            properties: {
              store: {
                type: "string",
                description: "Store name or ID"
              }
            },
            required: ["store"]
          }
        },
        {
          name: "delete_store",
          description: "Delete a knowledge store and all associated data (database, cloned files)",
          inputSchema: {
            type: "object",
            properties: {
              store: {
                type: "string",
                description: "Store name or ID to delete"
              }
            },
            required: ["store"]
          }
        },
        {
          name: "get_full_context",
          description: "Get complete code and context for a specific search result by ID. Use this after search to get full implementation details.",
          inputSchema: {
            type: "object",
            properties: {
              resultId: {
                type: "string",
                description: "Result ID from previous search"
              }
            },
            required: ["resultId"]
          }
        },
        {
          name: "check_job_status",
          description: "Check the status of a background job (clone, index, crawl operations)",
          inputSchema: {
            type: "object",
            properties: {
              jobId: {
                type: "string",
                description: "Job ID to check status for"
              }
            },
            required: ["jobId"]
          }
        },
        {
          name: "list_jobs",
          description: "List all background jobs, optionally filtered by status",
          inputSchema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["pending", "running", "completed", "failed", "cancelled"],
                description: "Filter jobs by status (optional)"
              },
              activeOnly: {
                type: "boolean",
                default: false,
                description: "Only show active (pending/running) jobs"
              }
            }
          }
        },
        {
          name: "cancel_job",
          description: "Cancel a running or pending background job",
          inputSchema: {
            type: "object",
            properties: {
              jobId: {
                type: "string",
                description: "Job ID to cancel"
              }
            },
            required: ["jobId"]
          }
        }
      ]
    });
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const validated = tool.schema.parse(args ?? {});
    const services = await createServices(
      options.config,
      options.dataDir,
      options.projectRoot
    );
    return tool.handler(validated, { services, options });
  });
  return server;
}
async function runMCPServer(options) {
  const server = createMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bluera Knowledge MCP server running on stdio");
}
var scriptPath = process.argv[1] ?? "";
var isMCPServerEntry = scriptPath.endsWith("mcp/server.js") || scriptPath.endsWith("mcp/server");
if (isMCPServerEntry) {
  runMCPServer({
    dataDir: process.env["DATA_DIR"],
    config: process.env["CONFIG_PATH"],
    projectRoot: process.env["PROJECT_ROOT"] ?? process.env["PWD"]
  }).catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
}

export {
  createMCPServer,
  runMCPServer
};
//# sourceMappingURL=chunk-7BI4JJML.js.map