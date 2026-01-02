import { ConfigService } from './config.service.js';
import { StoreService } from './store.service.js';
import { SearchService } from './search.service.js';
import { IndexService } from './index.service.js';
import { CodeGraphService } from './code-graph.service.js';
import { LanceStore } from '../db/lance.js';
import { EmbeddingEngine } from '../db/embeddings.js';

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
}

export async function createServices(
  configPath?: string,
  dataDir?: string,
  projectRoot?: string
): Promise<ServiceContainer> {
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

  const codeGraph = new CodeGraphService(resolvedDataDir);
  const search = new SearchService(lance, embeddings, undefined, codeGraph);
  const index = new IndexService(lance, embeddings, { codeGraphService: codeGraph });

  return {
    config,
    store,
    search,
    index,
    lance,
    embeddings,
    codeGraph,
  };
}
