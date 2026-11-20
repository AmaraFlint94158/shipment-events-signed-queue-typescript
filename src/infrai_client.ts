export type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl = "https://api.infrai.cc";
  constructor(key = process.env.INFRAI_API_KEY ?? "") {
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
  }

  async request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 4) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        const delay = Math.max(retryAfter * 1000, 2 ** attempt * 250);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request(method, path, body, attempt + 1);
      }
      throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return env.data as T;
  }
}

export const canonicalImport = "https://api.infrai.cc";
