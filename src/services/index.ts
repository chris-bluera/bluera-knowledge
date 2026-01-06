import { ConfigService } from './config.service.js';
import { StoreService } from './store.service.js';
import { SearchService } from './search.service.js';
import { IndexService } from './index.service.js';
import { CodeGraphService } from './code-graph.service.js';
import { LanceStore } from '../db/lance.js';
import { EmbeddingEngine } from '../db/embeddings.js';
import { PythonBridge } from '../crawl/bridge.js';
import { createLogger, shutdownLogger } from '../logging/index.js';

const logger = createLogger('services');

export { ConfigService } from './config.service.js';
export { StoreService } from './store.service.js';
export { SearchService } from './search.service.js';
export { IndexService } from './index.service.js';
export { JobService } from './job.service.js';
export { WatchService } from './watch.service.js';
export { ChunkingService } from './chunking.service.js';
export { CodeGraphService } from './code-graph.service.js';

export interface ServiceContainer {
  config: ConfigService;
  store: StoreService;
  search: SearchService;
  index: IndexService;
  lance: LanceStore;
  embeddings: EmbeddingEngine;
  codeGraph: CodeGraphService;
  pythonBridge: PythonBridge;
}

export async function createServices(
  configPath?: string,
  dataDir?: string,
  projectRoot?: string
): Promise<ServiceContainer> {
  logger.info({ configPath, dataDir, projectRoot }, 'Initializing services');

  const config = new ConfigService(configPath, dataDir, projectRoot);
  const appConfig = await config.load();
  const resolvedDataDir = config.resolveDataDir();

  const lance = new LanceStore(resolvedDataDir);
  const embeddings = new EmbeddingEngine(
    appConfig.embedding.model,
    appConfig.embedding.dimensions
  );

  await embeddings.initialize();

  const store = new StoreService(resolvedDataDir);
  await store.initialize();

  const pythonBridge = new PythonBridge();
  await pythonBridge.start();

  const codeGraph = new CodeGraphService(resolvedDataDir, pythonBridge);
  const search = new SearchService(lance, embeddings, codeGraph);
  const index = new IndexService(lance, embeddings, { codeGraphService: codeGraph });

  logger.info({ dataDir: resolvedDataDir }, 'Services initialized successfully');

  return {
    config,
    store,
    search,
    index,
    lance,
    embeddings,
    codeGraph,
    pythonBridge,
  };
}

/**
 * Cleanly shut down all services, stopping background processes.
 * Call this after CLI commands complete to allow the process to exit.
 */
export async function destroyServices(services: ServiceContainer): Promise<void> {
  logger.info('Shutting down services');
  try {
    // Use async close to allow native threads time to cleanup
    await services.lance.closeAsync();
  } catch (e) {
    logger.error({ error: e }, 'Error closing LanceStore');
  }
  try {
    await services.pythonBridge.stop();
  } catch (e) {
    logger.error({ error: e }, 'Error stopping Python bridge');
  }
  await shutdownLogger();
}
