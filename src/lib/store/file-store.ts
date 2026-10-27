import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StoreData } from "../types";
import { emptyStore, type AgentStore } from "./types";

export class FileStore implements AgentStore {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filePath = path.join(process.cwd(), "data", "store.json"),
  ) {}

  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  read(): Promise<StoreData> {
    return this.locked(() => this.load());
  }

  update<T>(fn: (draft: StoreData) => Promise<T> | T): Promise<T> {
    return this.locked(async () => {
      const draft = await this.load();
      const result = await fn(draft);
      await this.save(draft);
      return result;
    });
  }

  private async load(): Promise<StoreData> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        treasuryAccountUuid: parsed.treasuryAccountUuid ?? null,
        treasuryAddress: parsed.treasuryAddress ?? null,
        openedAt: parsed.openedAt ?? null,
        lastSyncAt: parsed.lastSyncAt ?? null,
        chainHeight: parsed.chainHeight ?? null,
        agents: parsed.agents ?? [],
        proposals: parsed.proposals ?? [],
        intents: parsed.intents ?? [],
        audit: parsed.audit ?? [],
        payees: parsed.payees ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
      throw error;
    }
  }

  private async save(data: StoreData): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, this.filePath);
  }
}
