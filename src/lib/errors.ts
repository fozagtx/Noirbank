export class AgentError extends Error {
  readonly details?: unknown;

  constructor(message: string, readonly status: number, details?: unknown) {
    super(message);
    this.name = "AgentError";
    this.details = details;
  }
}
