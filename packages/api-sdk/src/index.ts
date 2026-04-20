export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AppMemberRole = "admin" | "manager" | "developer";
export type EnvironmentMemberRole = AppMemberRole;

export type ApiKeyScope =
  | "app:read"
  | "app:write"
  | "app:admin"
  | "flags:read"
  | "flags:write"
  | "flags:override"
  | "apiKeys:read"
  | "apiKeys:write";

export type FeatureFlagOperator =
  | "eq"
  | "ne"
  | "in"
  | "not_in"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "contains"
  | "starts_with"
  | "ends_with";

export type FlagValueType = "boolean" | "string" | "number" | "json";

export type FeatureFlagRule = {
  attribute: string;
  operator: FeatureFlagOperator;
  value: JsonValue;
};

export type FeatureFlagConfig = {
  type: FlagValueType;
  defaultValue: JsonValue;
  rules: FeatureFlagRule[];
};

export type App = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  stagingAddress: string | null;
  nightlyAddress: string | null;
  environments: AppEnvironment[];
  productionAddresses: ProductionAddress[];
  membershipRole: AppMemberRole | null;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Environment = App;

export type AppEnvironment = {
  id: string;
  appId: string;
  name: string;
  address: string | null;
  enabled: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductionAddress = {
  id: string;
  appId: string;
  label: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

export type AppUserSummary = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};
export type EnvironmentUserSummary = AppUserSummary;

export type AppMember = {
  id: string;
  appId: string;
  userId: string;
  role: AppMemberRole;
  user: AppUserSummary;
  createdAt: string;
  updatedAt: string;
};
export type EnvironmentMember = AppMember;

export type FeatureFlag = {
  id: string;
  appId: string;
  name: string;
  description: string | null;
  config: FeatureFlagConfig;
  createdAt: string;
  updatedAt: string;
};

export type FlagOverride = {
  id: string;
  appId: string;
  flagId: string;
  userId: string;
  value: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type ApiKey = {
  id: string;
  appId: string;
  description: string | null;
  scopes: ApiKeyScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateApiKeyResult = {
  apiKey: ApiKey;
  plaintextKey: string;
};

export type EvaluateFeatureFlagResult = {
  id: string;
  name: string;
  type: FlagValueType;
  value: JsonValue;
  source: "default" | "override" | "rule";
  ruleMatched: boolean;
  matchedRule: FeatureFlagRule | null;
};

export type EvaluateRequest = {
  flagNames?: string[];
  userId?: string;
  url?: string;
  attributes?: Record<string, JsonValue>;
};

export type EvaluateResponse = {
  appId: string;
  evaluatedAt: string;
  addressMatched: boolean;
  evaluations: Record<string, EvaluateFeatureFlagResult>;
};

export type SwitchboardSessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SwitchboardSession = {
  user: SwitchboardSessionUser;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
  };
};

export type SwitchboardHealthPayload = {
  status: "ok";
  service: "switchboard-api";
  environment: string;
  timestamp: string;
};

export type SwitchboardDatabaseHealthPayload =
  | {
      status: "ok";
      database: "connected";
      checkedAt: string;
    }
  | {
      status: "error";
      database: "unavailable";
      checkedAt: string;
      message: string;
    };

export type SwitchboardApiSuccess<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

export type SwitchboardApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
  };
};

export type SwitchboardManagementAuth =
  | {
      kind: "ui-user-id";
      userId: string;
    }
  | {
      kind: "session-token";
      sessionToken: string;
    }
  | {
      kind: "header";
      headers: Record<string, string>;
    };

export type SwitchboardSdkAuth =
  | {
      kind: "api-key";
      apiKey: string;
    }
  | {
      kind: "basic";
      username: string;
      password: string;
    };

export type SwitchboardRequestOptions = {
  auth?: SwitchboardManagementAuth | SwitchboardSdkAuth;
  headers?: Record<string, string>;
};

export type SwitchboardClientOptions = {
  defaultHeaders?: Record<string, string>;
  managementAuth?: SwitchboardManagementAuth;
  sdkAuth?: SwitchboardSdkAuth;
};

export type AppCreateInput = {
  name: string;
  description?: string | null;
  stagingAddress?: string | null;
  nightlyAddress?: string | null;
  environments?: Array<{
    name: string;
    address?: string | null;
    enabled?: boolean;
  }>;
};
export type EnvironmentCreateInput = AppCreateInput;

export type AppUpdateInput = {
  name?: string;
  description?: string | null;
  stagingAddress?: string | null;
  nightlyAddress?: string | null;
};
export type EnvironmentUpdateInput = AppUpdateInput;

export type ProductionAddressInput = {
  label: string;
  address: string;
};

export type ProductionAddressUpdateInput = {
  label?: string;
  address?: string;
};

export type AppMemberCreateInput = {
  userId: string;
  role: AppMemberRole;
};
export type EnvironmentMemberCreateInput = AppMemberCreateInput;

export type AppMemberUpdateInput = {
  role: AppMemberRole;
};
export type EnvironmentMemberUpdateInput = AppMemberUpdateInput;

export type FeatureFlagCreateInput = {
  name: string;
  description?: string | null;
  config: FeatureFlagConfig;
};

export type FeatureFlagUpdateInput = {
  name?: string;
  description?: string | null;
  config?: FeatureFlagConfig;
};

export type FlagOverrideCreateInput = {
  flagId: string;
  userId: string;
  value: JsonValue;
};

export type FlagOverrideUpdateInput = {
  value: JsonValue;
};

export type ApiKeyCreateInput = {
  description?: string | null;
  scopes: ApiKeyScope[];
  expiresAt?: string | null;
};

export class SwitchboardApiClientError extends Error {
  status: number;
  body?: SwitchboardApiError;

  constructor(message: string, status: number, body?: SwitchboardApiError) {
    super(message);
    this.name = "SwitchboardApiClientError";
    this.status = status;
    this.body = body;
  }
}

function encodeBasicAuth(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

function mergeHeaders(...records: Array<Record<string, string> | undefined>) {
  const headers = new Headers();

  for (const record of records) {
    if (!record) {
      continue;
    }

    for (const [key, value] of Object.entries(record)) {
      headers.set(key, value);
    }
  }

  return headers;
}

function authToHeaders(auth?: SwitchboardManagementAuth | SwitchboardSdkAuth) {
  if (!auth) {
    return {};
  }

  switch (auth.kind) {
    case "ui-user-id":
      return {
        "x-switchboard-user-id": auth.userId,
      };
    case "session-token":
      return {
        cookie: `better-auth.session_token=${auth.sessionToken}`,
      };
    case "header":
      return auth.headers;
    case "api-key":
      return {
        authorization: `Bearer ${auth.apiKey}`,
      };
    case "basic":
      return {
        authorization: `Basic ${encodeBasicAuth(auth.username, auth.password)}`,
      };
  }
}

export class SwitchboardClient {
  private readonly baseUrl: string;
  private readonly options: SwitchboardClientOptions;

  constructor(baseUrl: string, options: SwitchboardClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.options = options;
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    options?: SwitchboardRequestOptions
  ): Promise<T> {
    const headers = mergeHeaders(
      this.options.defaultHeaders,
      authToHeaders(options?.auth),
      options?.headers
    );

    if (!options?.auth && this.options.managementAuth) {
      for (const [key, value] of Object.entries(
        authToHeaders(this.options.managementAuth)
      )) {
        if (!headers.has(key)) {
          headers.set(key, value);
        }
      }
    }

    if (!options?.auth && this.options.sdkAuth) {
      for (const [key, value] of Object.entries(
        authToHeaders(this.options.sdkAuth)
      )) {
        if (!headers.has(key)) {
          headers.set(key, value);
        }
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const payload = (await response.json()) as
      | SwitchboardApiSuccess<T>
      | SwitchboardApiError;

    if (!response.ok || !payload.success) {
      throw new SwitchboardApiClientError(
        payload.success
          ? `HTTP ${response.status}`
          : `${payload.error.code}: ${payload.error.message}`,
        response.status,
        payload.success ? undefined : payload
      );
    }

    return payload.data;
  }

  private requestJson<T>(
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<T>(
      path,
      {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      options
    );
  }

  async getSession(
    auth: Extract<SwitchboardManagementAuth, { kind: "session-token" }>
  ): Promise<SwitchboardSession | null> {
    const headers = mergeHeaders(this.options.defaultHeaders, authToHeaders(auth));

    const response = await fetch(`${this.baseUrl}/api/auth/get-session`, {
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as SwitchboardSession | null;
    if (!body?.user?.id) {
      return null;
    }

    return body;
  }

  getHealth() {
    return this.request<SwitchboardHealthPayload>("/health");
  }

  getDatabaseHealth() {
    return this.request<SwitchboardDatabaseHealthPayload>("/db/health");
  }

  listApps(options?: SwitchboardRequestOptions) {
    return this.request<{ apps: App[] }>("/api/v1/apps", undefined, options);
  }

  listEnvironments(options?: SwitchboardRequestOptions) {
    return this.listApps(options).then(({ apps }) => ({
      environments: apps as Environment[],
    }));
  }

  createApp(input: AppCreateInput, options?: SwitchboardRequestOptions) {
    return this.requestJson<{ app: App }>(
      "/api/v1/apps",
      "POST",
      input,
      options
    );
  }

  createEnvironment(
    input: EnvironmentCreateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.createApp(input, options).then(({ app }) => ({
      environment: app as Environment,
    }));
  }

  getApp(appId: string, options?: SwitchboardRequestOptions) {
    return this.request<{ app: App }>(
      `/api/v1/apps/${appId}`,
      undefined,
      options
    );
  }

  getEnvironment(appId: string, options?: SwitchboardRequestOptions) {
    return this.getApp(appId, options).then(({ app }) => ({
      environment: app as Environment,
    }));
  }

  updateApp(
    appId: string,
    input: AppUpdateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ app: App }>(
      `/api/v1/apps/${appId}`,
      "PATCH",
      input,
      options
    );
  }

  updateEnvironment(
    appId: string,
    input: EnvironmentUpdateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.updateApp(appId, input, options).then(({ app }) => ({
      environment: app as Environment,
    }));
  }

  deleteApp(appId: string, options?: SwitchboardRequestOptions) {
    return this.request<{ deleted: true }>(
      `/api/v1/apps/${appId}`,
      {
        method: "DELETE",
      },
      options
    );
  }

  deleteEnvironment(appId: string, options?: SwitchboardRequestOptions) {
    return this.deleteApp(appId, options);
  }

  listProductionAddresses(appId: string, options?: SwitchboardRequestOptions) {
    return this.request<{ productionAddresses: ProductionAddress[] }>(
      `/api/v1/apps/${appId}/production-addresses`,
      undefined,
      options
    );
  }

  createProductionAddress(
    appId: string,
    input: ProductionAddressInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ productionAddress: ProductionAddress }>(
      `/api/v1/apps/${appId}/production-addresses`,
      "POST",
      input,
      options
    );
  }

  getProductionAddress(
    appId: string,
    productionAddressId: string,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<{ productionAddress: ProductionAddress }>(
      `/api/v1/apps/${appId}/production-addresses/${productionAddressId}`,
      undefined,
      options
    );
  }

  updateProductionAddress(
    appId: string,
    productionAddressId: string,
    input: ProductionAddressUpdateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ productionAddress: ProductionAddress }>(
      `/api/v1/apps/${appId}/production-addresses/${productionAddressId}`,
      "PATCH",
      input,
      options
    );
  }

  deleteProductionAddress(
    appId: string,
    productionAddressId: string,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<{ deleted: true }>(
      `/api/v1/apps/${appId}/production-addresses/${productionAddressId}`,
      {
        method: "DELETE",
      },
      options
    );
  }

  listMembers(appId: string, options?: SwitchboardRequestOptions) {
    return this.request<{ members: AppMember[] }>(
      `/api/v1/apps/${appId}/members`,
      undefined,
      options
    );
  }

  createMember(
    appId: string,
    input: AppMemberCreateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ member: AppMember }>(
      `/api/v1/apps/${appId}/members`,
      "POST",
      input,
      options
    );
  }

  updateMember(
    appId: string,
    memberId: string,
    input: AppMemberUpdateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ member: AppMember }>(
      `/api/v1/apps/${appId}/members/${memberId}`,
      "PATCH",
      input,
      options
    );
  }

  deleteMember(
    appId: string,
    memberId: string,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<{ deleted: true }>(
      `/api/v1/apps/${appId}/members/${memberId}`,
      {
        method: "DELETE",
      },
      options
    );
  }

  listFlags(appId: string, options?: SwitchboardRequestOptions) {
    return this.request<{ flags: FeatureFlag[] }>(
      `/api/v1/apps/${appId}/flags`,
      undefined,
      options
    );
  }

  createFlag(
    appId: string,
    input: FeatureFlagCreateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ flag: FeatureFlag }>(
      `/api/v1/apps/${appId}/flags`,
      "POST",
      input,
      options
    );
  }

  getFlag(appId: string, flagId: string, options?: SwitchboardRequestOptions) {
    return this.request<{ flag: FeatureFlag }>(
      `/api/v1/apps/${appId}/flags/${flagId}`,
      undefined,
      options
    );
  }

  updateFlag(
    appId: string,
    flagId: string,
    input: FeatureFlagUpdateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ flag: FeatureFlag }>(
      `/api/v1/apps/${appId}/flags/${flagId}`,
      "PATCH",
      input,
      options
    );
  }

  deleteFlag(
    appId: string,
    flagId: string,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<{ deleted: true }>(
      `/api/v1/apps/${appId}/flags/${flagId}`,
      {
        method: "DELETE",
      },
      options
    );
  }

  listOverrides(
    appId: string,
    filters?: {
      flagId?: string;
      userId?: string;
    },
    options?: SwitchboardRequestOptions
  ) {
    const query = new URLSearchParams();

    if (filters?.flagId) {
      query.set("flagId", filters.flagId);
    }

    if (filters?.userId) {
      query.set("userId", filters.userId);
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : "";

    return this.request<{ overrides: FlagOverride[] }>(
      `/api/v1/apps/${appId}/overrides${suffix}`,
      undefined,
      options
    );
  }

  createOverride(
    appId: string,
    input: FlagOverrideCreateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ override: FlagOverride }>(
      `/api/v1/apps/${appId}/overrides`,
      "POST",
      input,
      options
    );
  }

  updateOverride(
    appId: string,
    overrideId: string,
    input: FlagOverrideUpdateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<{ override: FlagOverride }>(
      `/api/v1/apps/${appId}/overrides/${overrideId}`,
      "PATCH",
      input,
      options
    );
  }

  deleteOverride(
    appId: string,
    overrideId: string,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<{ deleted: true }>(
      `/api/v1/apps/${appId}/overrides/${overrideId}`,
      {
        method: "DELETE",
      },
      options
    );
  }

  listApiKeys(appId: string, options?: SwitchboardRequestOptions) {
    return this.request<{ apiKeys: ApiKey[] }>(
      `/api/v1/apps/${appId}/api-keys`,
      undefined,
      options
    );
  }

  createApiKey(
    appId: string,
    input: ApiKeyCreateInput,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<CreateApiKeyResult>(
      `/api/v1/apps/${appId}/api-keys`,
      "POST",
      input,
      options
    );
  }

  getApiKey(
    appId: string,
    apiKeyId: string,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<{ apiKey: ApiKey }>(
      `/api/v1/apps/${appId}/api-keys/${apiKeyId}`,
      undefined,
      options
    );
  }

  deleteApiKey(
    appId: string,
    apiKeyId: string,
    options?: SwitchboardRequestOptions
  ) {
    return this.request<{ deleted: true }>(
      `/api/v1/apps/${appId}/api-keys/${apiKeyId}`,
      {
        method: "DELETE",
      },
      options
    );
  }

  evaluateApp(
    appId: string,
    request: EvaluateRequest,
    options?: SwitchboardRequestOptions
  ) {
    return this.requestJson<EvaluateResponse>(
      `/api/v1/apps/${appId}/evaluate`,
      "POST",
      {
        ...request,
        attributes: request.attributes ?? {},
      },
      options
    );
  }

  evaluateEnvironment(
    appId: string,
    request: EvaluateRequest,
    options?: SwitchboardRequestOptions
  ) {
    return this.evaluateApp(appId, request, options);
  }
}

export function createClient(
  baseUrl: string,
  options?: SwitchboardClientOptions
) {
  return new SwitchboardClient(baseUrl, options);
}

export const evaluateExample = `
import { createClient } from "@repo/api-sdk";

const client = createClient("http://localhost:4000", {
  sdkAuth: {
    kind: "api-key",
    apiKey: process.env.SWITCHBOARD_API_KEY!,
  },
});

const result = await client.evaluateApp("APP_ID", {
  userId: "USER_ID",
  url: "https://app.switchboard.dev/dashboard",
  attributes: {
    plan: "pro",
    region: "ca",
    seats: 12,
  },
});

console.log(result.evaluations.beta_banner?.value);
`.trim();
