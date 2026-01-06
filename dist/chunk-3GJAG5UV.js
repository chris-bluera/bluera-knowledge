// src/services/watch.service.ts
import { watch } from "chokidar";
var WatchService = class {
  watchers = /* @__PURE__ */ new Map();
  pendingTimeouts = /* @__PURE__ */ new Map();
  indexService;
  lanceStore;
  constructor(indexService, lanceStore) {
    this.indexService = indexService;
    this.lanceStore = lanceStore;
  }
  async watch(store, debounceMs = 1e3, onReindex) {
    if (this.watchers.has(store.id)) {
      return Promise.resolve();
    }
    let timeout = null;
    const watcher = watch(store.path, {
      ignored: /(^|[/\\])\.(git|node_modules|dist|build)/,
      persistent: true,
      ignoreInitial: true
    });
    const reindexHandler = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.pendingTimeouts.delete(store.id);
        void (async () => {
          try {
            await this.lanceStore.initialize(store.id);
            await this.indexService.indexStore(store);
            onReindex?.();
          } catch (error) {
            console.error("Error during reindexing:", error);
          }
        })();
      }, debounceMs);
      this.pendingTimeouts.set(store.id, timeout);
    };
    watcher.on("all", reindexHandler);
    watcher.on("error", (error) => {
      console.error("Watcher error:", error);
    });
    this.watchers.set(store.id, watcher);
    return Promise.resolve();
  }
  async unwatch(storeId) {
    const pendingTimeout = this.pendingTimeouts.get(storeId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      this.pendingTimeouts.delete(storeId);
    }
    const watcher = this.watchers.get(storeId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(storeId);
    }
  }
  async unwatchAll() {
    for (const [id] of this.watchers) {
      await this.unwatch(id);
    }
  }
};

export {
  WatchService
};
//# sourceMappingURL=chunk-3GJAG5UV.js.map