export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SwitchboardOptions = {
  /** Base URL of the Switchboard API (e.g. https://switchboard.example.com). */
  url: string;
  /** App token (API key) created in the Switchboard UI. Scopes to an app + environment. */
  token: string;
  /**
   * Minimum milliseconds between background version checks. Calls to `.check()`
   * that land within this window reuse the existing cache without hitting the
   * network. Defaults to 500ms.
   */
  minCheckIntervalMs?: number;
  /**
   * Called when a background refresh fails. Errors are swallowed by default so
   * `.check()` stays synchronous and never throws. Use this to log them.
   */
  onError?: (error: unknown) => void;
  /**
   * Override the caller URL sent to the server. Defaults to
   * `window.location.href` in the browser and `undefined` on the server.
   */
  callerUrl?: string;
  /** Injected fetch for SSR/testing. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
};

type PayloadResponse = {
  success: boolean;
  data: {
    version: string;
    evaluations: Record<string, JsonValue>;
  };
};

type VersionResponse = {
  success: boolean;
  data: { version: string };
};

type ErrorResponse = {
  success: false;
  error: { code: string; message: string };
};

function detectCallerUrl(): string | undefined {
  if (typeof globalThis !== "undefined") {
    const loc = (
      globalThis as typeof globalThis & {
        location?: { href?: string };
      }
    ).location;
    if (loc && typeof loc.href === "string") return loc.href;
  }
  return undefined;
}

export class Switchboard {
  readonly #baseUrl: string;
  readonly #token: string;
  readonly #minIntervalMs: number;
  readonly #onError: (error: unknown) => void;
  readonly #callerUrl: string | undefined;
  readonly #fetch: typeof fetch;

  #evaluations: Record<string, JsonValue> = {};
  #version: string | null = null;
  #lastCheckedAt = 0;
  #readyPromise: Promise<void>;
  #refreshInFlight: Promise<void> | null = null;

  constructor(options: SwitchboardOptions) {
    this.#baseUrl = options.url.replace(/\/+$/, "");
    this.#token = options.token;
    this.#minIntervalMs = options.minCheckIntervalMs ?? 500;
    this.#onError = options.onError ?? (() => {});
    this.#callerUrl = options.callerUrl ?? detectCallerUrl();
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#readyPromise = this.#loadPayload();
  }

  /** Resolves once the initial payload has loaded. Rejects on network/auth errors. */
  ready(): Promise<void> {
    return this.#readyPromise;
  }

  /**
   * Force a version check + payload refresh and await the result. Coalesces
   * with an in-flight background refresh so concurrent callers share one
   * request. Use from server-rendered code that needs to see a just-changed
   * flag value on the next request.
   */
  async refresh(): Promise<void> {
    if (this.#refreshInFlight) {
      await this.#refreshInFlight;
      return;
    }
    this.#lastCheckedAt = Date.now();
    this.#refreshInFlight = this.#refresh().finally(() => {
      this.#refreshInFlight = null;
    });
    await this.#refreshInFlight;
  }

  /**
   * Synchronously return the current cached value for `flagName`. Kicks off a
   * background version check; when stale, refreshes the payload so the next
   * call returns the new value.
   */
  check<T = JsonValue>(flagName: string): T | undefined;
  check<T>(flagName: string, defaultValue: T): T;
  check<T>(flagName: string, defaultValue?: T): T | undefined {
    this.#maybeRefresh();
    if (flagName in this.#evaluations) {
      return this.#evaluations[flagName] as unknown as T;
    }
    return defaultValue;
  }

  #qs(): string {
    if (!this.#callerUrl) return "";
    const params = new URLSearchParams({ url: this.#callerUrl });
    return `?${params.toString()}`;
  }

  async #request<T>(path: string): Promise<T> {
    const response = await this.#fetch(`${this.#baseUrl}${path}${this.#qs()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        Accept: "application/json",
      },
    });

    const body = (await response.json()) as T | ErrorResponse;

    if (!response.ok || (body as ErrorResponse).success === false) {
      const err = body as ErrorResponse;
      const message = err?.error?.message ?? `Request failed: ${response.status}`;
      const code = err?.error?.code ?? "REQUEST_FAILED";
      throw new SwitchboardError(message, code, response.status);
    }

    return body as T;
  }

  async #loadPayload(): Promise<void> {
    const body = await this.#request<PayloadResponse>("/api/v1/sdk/payload");
    this.#evaluations = body.data.evaluations;
    this.#version = body.data.version;
    this.#lastCheckedAt = Date.now();
  }

  #maybeRefresh(): void {
    if (this.#refreshInFlight) return;
    const now = Date.now();
    if (now - this.#lastCheckedAt < this.#minIntervalMs) return;
    this.#lastCheckedAt = now;
    this.#refreshInFlight = this.#refresh()
      .catch((error) => this.#onError(error))
      .finally(() => {
        this.#refreshInFlight = null;
      });
  }

  async #refresh(): Promise<void> {
    const version = await this.#request<VersionResponse>("/api/v1/sdk/version");
    if (version.data.version === this.#version) return;
    const payload = await this.#request<PayloadResponse>("/api/v1/sdk/payload");
    this.#evaluations = payload.data.evaluations;
    this.#version = payload.data.version;
  }
}

export class SwitchboardError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SwitchboardError";
  }
}
