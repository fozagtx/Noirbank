import { AgentService } from "../service";
import { FileStore } from "../store/file-store";
import { DevtoolWallet } from "../wallet/devtool";

const globalForApp = globalThis as typeof globalThis & {
  __noirbank?: AgentService;
};

export function getService(): AgentService {
  if (!globalForApp.__noirbank) {
    globalForApp.__noirbank = new AgentService(
      new FileStore(),
      new DevtoolWallet(),
    );
  }
  return globalForApp.__noirbank;
}
