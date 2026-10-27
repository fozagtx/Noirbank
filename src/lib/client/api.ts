export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ErrorBody = {
  error?: string;
  details?: {
    violations?: { message: string }[];
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  } | null;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) {
    const details = body?.details;
    const extra = [
      ...(details?.violations?.map((item) => item.message) ?? []),
      ...(details?.formErrors ?? []),
      ...Object.entries(details?.fieldErrors ?? {}).flatMap(([key, messages]) =>
        (messages ?? []).map((message) => `${key}: ${message}`),
      ),
    ];
    const message = [body?.error ?? response.statusText ?? "Request failed", ...extra]
      .filter(Boolean)
      .join(" ");
    throw new ApiError(message, response.status);
  }
  return body as T;
}
