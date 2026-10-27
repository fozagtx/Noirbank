import { emptyStore, type AgentStore } from "./types";
import type { StoreData } from "../types";

export class MemoryStore implements AgentStore {
  private data: StoreData = emptyStore();
  private chain: Promise<unknown> = Promise.resolve();

  constructor(initial?: StoreData) {
    if (initial) this.data = structuredClone(initial);
  }

  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  read(): Promise<StoreData> {
    return this.locked(async () => structuredClone(this.data));
  }

  update<T>(fn: (draft: StoreData) => Promise<T> | T): Promise<T> {
    return this.locked(async () => {
      const draft = structuredClone(this.data);
      const result = await fn(draft);
      this.data = draft;
      return result;
    });
  }
}
