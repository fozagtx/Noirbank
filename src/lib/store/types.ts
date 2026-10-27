import type { StoreData } from "../types";

export function emptyStore(): StoreData {
  return {
    treasuryAccountUuid: null,
    treasuryAddress: null,
    openedAt: null,
    lastSyncAt: null,
    chainHeight: null,
    agents: [],
    proposals: [],
    intents: [],
    audit: [],
    payees: [],
  };
}

export interface AgentStore {
  read(): Promise<StoreData>;
  update<T>(fn: (draft: StoreData) => Promise<T> | T): Promise<T>;
}
