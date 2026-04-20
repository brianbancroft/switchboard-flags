import {
  type ApiKey,
  type App,
  type AppMember,
  createClient,
  type Environment,
  type EnvironmentMember,
  type FeatureFlag,
  type FlagOverride,
  type JsonValue,
  type ProductionAddress,
  type SwitchboardManagementAuth,
  SwitchboardApiClientError,
  type SwitchboardSdkAuth,
} from "@repo/api-sdk";
import { env } from "../env.js";
import { tryGetUserContext } from "./context.js";

export class SwitchboardMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwitchboardMcpError";
  }
}

export class SwitchboardBackend {
  private readonly client = createClient(env.SWITCHBOARD_API_BASE_URL, {
    defaultHeaders: {
      ...env.SWITCHBOARD_API_DEFAULT_HEADERS,
      ...(env.SWITCHBOARD_API_TOKEN
        ? { Authorization: `Bearer ${env.SWITCHBOARD_API_TOKEN}` }
        : {}),
    },
  });

  private getAuth(): SwitchboardManagementAuth | undefined {
    const ctx = tryGetUserContext();
    if (ctx) {
      return ctx.auth;
    }

    if (env.SWITCHBOARD_API_UI_USER_ID) {
      return {
        kind: "ui-user-id",
        userId: env.SWITCHBOARD_API_UI_USER_ID,
      };
    }

    return undefined;
  }

  private authOptions() {
    const auth = this.getAuth();
    return auth ? { auth } : undefined;
  }

  async getSession() {
    const ctx = tryGetUserContext();
    if (ctx?.user) {
      return ctx.user;
    }

    if (ctx?.auth.kind === "session-token") {
      const session = await this.client.getSession(ctx.auth);
      return session?.user ?? null;
    }

    return null;
  }

  async getHealth() {
    return this.client.getHealth();
  }

  async getDatabaseHealth() {
    return this.client.getDatabaseHealth();
  }

  async listApps() {
    const result = await this.client.listApps(this.authOptions());
    return result.apps;
  }

  async listEnvironments() {
    return this.listApps();
  }

  async resolveApp(input: {
    appId?: string;
    appName?: string;
    environmentId?: string;
    environmentName?: string;
  }) {
    const appId = input.appId ?? input.environmentId;
    const appName = input.appName ?? input.environmentName;

    if (appId) {
      const result = await this.client.getApp(appId, this.authOptions());
      return result.app;
    }

    const apps = await this.listApps();
    const app = apps.find((candidate) => candidate.name === appName);

    if (!app) {
      throw new SwitchboardMcpError(
        `App "${appName}" was not found or is not accessible.`
      );
    }

    return app;
  }

  async resolveEnvironment(input: {
    appId?: string;
    appName?: string;
    environmentId?: string;
    environmentName?: string;
  }) {
    return this.resolveApp(input);
  }

  createApp(input: {
    name: string;
    description?: string | null;
    stagingAddress?: string | null;
    nightlyAddress?: string | null;
  }) {
    return this.client.createApp(input, this.authOptions());
  }

  createEnvironment(input: {
    name: string;
    description?: string | null;
    stagingAddress?: string | null;
    nightlyAddress?: string | null;
  }) {
    return this.createApp(input);
  }

  updateApp(appId: string, input: Record<string, unknown>) {
    return this.client.updateApp(appId, input, this.authOptions());
  }

  updateEnvironment(environmentId: string, input: Record<string, unknown>) {
    return this.updateApp(environmentId, input);
  }

  deleteApp(appId: string) {
    return this.client.deleteApp(appId, this.authOptions());
  }

  deleteEnvironment(environmentId: string) {
    return this.deleteApp(environmentId);
  }

  listProductionAddresses(environmentId: string) {
    return this.client.listProductionAddresses(environmentId, this.authOptions());
  }

  async resolveProductionAddress(input: {
    app?: App;
    environment?: App;
    productionAddressId?: string;
    label?: string;
  }) {
    const app = input.app ?? input.environment;
    if (!app) {
      throw new SwitchboardMcpError("App context is required.");
    }

    const result = await this.client.listProductionAddresses(app.id);
    const productionAddress = result.productionAddresses.find((candidate) =>
      input.productionAddressId
        ? candidate.id === input.productionAddressId
        : candidate.label === input.label
    );

    if (!productionAddress) {
      throw new SwitchboardMcpError(
        input.productionAddressId
          ? `Production address "${input.productionAddressId}" was not found in app "${app.name}".`
          : `Production address "${input.label}" was not found in app "${app.name}".`
      );
    }

    return productionAddress;
  }

  createProductionAddress(
    environmentId: string,
    input: {
      label: string;
      address: string;
    }
  ) {
    return this.client.createProductionAddress(environmentId, input, this.authOptions());
  }

  updateProductionAddress(
    environmentId: string,
    productionAddressId: string,
    input: {
      label?: string;
      address?: string;
    }
  ) {
    return this.client.updateProductionAddress(
      environmentId,
      productionAddressId,
      input,
      this.authOptions()
    );
  }

  deleteProductionAddress(environmentId: string, productionAddressId: string) {
    return this.client.deleteProductionAddress(
      environmentId,
      productionAddressId,
      this.authOptions()
    );
  }

  listMembers(environmentId: string) {
    return this.client.listMembers(environmentId, this.authOptions());
  }

  async resolveMember(input: {
    app?: App;
    environment?: App;
    memberId?: string;
    userId?: string;
  }) {
    const app = input.app ?? input.environment;
    if (!app) {
      throw new SwitchboardMcpError("App context is required.");
    }

    const result = await this.client.listMembers(app.id);
    const member = result.members.find((candidate) =>
      input.memberId
        ? candidate.id === input.memberId
        : candidate.userId === input.userId
    );

    if (!member) {
      throw new SwitchboardMcpError(
        input.memberId
          ? `Member "${input.memberId}" was not found in app "${app.name}".`
          : `User "${input.userId}" is not a member of app "${app.name}".`
      );
    }

    return member;
  }

  createMember(
    appId: string,
    input: { userId: string; role: AppMember["role"] }
  ) {
    return this.client.createMember(appId, input, this.authOptions());
  }

  updateMember(
    appId: string,
    memberId: string,
    input: { role: AppMember["role"] }
  ) {
    return this.client.updateMember(appId, memberId, input, this.authOptions());
  }

  deleteMember(appId: string, memberId: string) {
    return this.client.deleteMember(appId, memberId, this.authOptions());
  }

  listFlags(environmentId: string) {
    return this.client.listFlags(environmentId, this.authOptions());
  }

  async resolveFlag(input: {
    app?: App;
    environment?: App;
    flagId?: string;
    flagName?: string;
  }) {
    const app = input.app ?? input.environment;
    if (!app) {
      throw new SwitchboardMcpError("App context is required.");
    }

    if (input.flagId) {
      const result = await this.client.getFlag(app.id, input.flagId, this.authOptions());
      return result.flag;
    }

    const result = await this.client.listFlags(app.id);
    const flag = result.flags.find(
      (candidate) => candidate.name === input.flagName
    );

    if (!flag) {
      throw new SwitchboardMcpError(
        `Flag "${input.flagName}" was not found in app "${app.name}".`
      );
    }

    return flag;
  }

  createFlag(
    environmentId: string,
    input: {
      name: string;
      description?: string | null;
      config: FeatureFlag["config"];
    }
  ) {
    return this.client.createFlag(environmentId, input, this.authOptions());
  }

  updateFlag(
    environmentId: string,
    flagId: string,
    input: {
      name?: string;
      description?: string | null;
      config?: FeatureFlag["config"];
    }
  ) {
    return this.client.updateFlag(environmentId, flagId, input, this.authOptions());
  }

  deleteFlag(environmentId: string, flagId: string) {
    return this.client.deleteFlag(environmentId, flagId, this.authOptions());
  }

  listOverrides(
    environmentId: string,
    filters?: {
      flagId?: string;
      userId?: string;
    }
  ) {
    return this.client.listOverrides(environmentId, filters, this.authOptions());
  }

  async findOverride(input: {
    appId?: string;
    environmentId?: string;
    flagId: string;
    userId: string;
  }) {
    const appId = input.appId ?? input.environmentId;
    if (!appId) {
      throw new SwitchboardMcpError("App id is required.");
    }
    const result = await this.client.listOverrides(appId, {
      flagId: input.flagId,
      userId: input.userId,
    }, this.authOptions());

    return result.overrides[0] ?? null;
  }

  createOverride(
    environmentId: string,
    input: {
      flagId: string;
      userId: string;
      value: JsonValue;
    }
  ) {
    return this.client.createOverride(environmentId, input, this.authOptions());
  }

  updateOverride(
    environmentId: string,
    overrideId: string,
    input: {
      value: JsonValue;
    }
  ) {
    return this.client.updateOverride(environmentId, overrideId, input, this.authOptions());
  }

  deleteOverride(environmentId: string, overrideId: string) {
    return this.client.deleteOverride(environmentId, overrideId, this.authOptions());
  }

  listApiKeys(environmentId: string) {
    return this.client.listApiKeys(environmentId, this.authOptions());
  }

  async resolveApiKey(input: {
    appId?: string;
    environmentId?: string;
    apiKeyId: string;
  }): Promise<ApiKey> {
    const appId = input.appId ?? input.environmentId;
    if (!appId) {
      throw new SwitchboardMcpError("App id is required.");
    }
    const result = await this.client.getApiKey(appId, input.apiKeyId, this.authOptions());
    return result.apiKey;
  }

  createApiKey(
    environmentId: string,
    input: {
      description?: string | null;
      scopes: ApiKey["scopes"];
      expiresAt?: string | null;
    }
  ) {
    return this.client.createApiKey(environmentId, input, this.authOptions());
  }

  deleteApiKey(environmentId: string, apiKeyId: string) {
    return this.client.deleteApiKey(environmentId, apiKeyId, this.authOptions());
  }

  resolveEvaluateAuth(input: {
    app?: App;
    environment?: Environment;
    sdkApiKey?: string;
  }): SwitchboardSdkAuth | null {
    const app = input.app ?? input.environment;

    if (input.sdkApiKey) {
      return {
        kind: "api-key",
        apiKey: input.sdkApiKey,
      };
    }

    if (!app) {
      return null;
    }

    const configuredApiKey =
      env.SWITCHBOARD_EVALUATE_API_KEYS[app.id] ??
      env.SWITCHBOARD_EVALUATE_API_KEYS[app.name];

    if (configuredApiKey) {
      return {
        kind: "api-key",
        apiKey: configuredApiKey,
      };
    }

    return null;
  }

  evaluateApp(
    appId: string,
    input: {
      flagNames?: string[];
      userId?: string;
      url?: string;
      attributes?: Record<string, JsonValue>;
    },
    auth: SwitchboardSdkAuth
  ) {
    return this.client.evaluateApp(appId, input, {
      auth,
    });
  }

  evaluateEnvironment(
    environmentId: string,
    input: {
      flagNames?: string[];
      userId?: string;
      url?: string;
      attributes?: Record<string, JsonValue>;
    },
    auth: SwitchboardSdkAuth
  ) {
    return this.evaluateApp(environmentId, input, auth);
  }
}

export function normalizeError(error: unknown) {
  if (error instanceof SwitchboardApiClientError) {
    return {
      message: error.message,
      status: error.status,
      details: error.body?.error.details,
    };
  }

  if (error instanceof SwitchboardMcpError) {
    return {
      message: error.message,
      status: 400,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      status: 500,
    };
  }

  return {
    message: "Unknown MCP server error",
    status: 500,
  };
}

export async function createCurrentFlagsSnapshot(backend: SwitchboardBackend) {
  const apps = await backend.listApps();
  const appsWithFlags = await Promise.all(
    apps.map(async (app) => {
      const result = await backend.listFlags(app.id);
      return {
        app: {
          id: app.id,
          name: app.name,
          stagingAddress: app.stagingAddress,
          nightlyAddress: app.nightlyAddress,
          productionAddressCount: app.productionAddresses.length,
          membershipRole: app.membershipRole,
          isOwner: app.isOwner,
        },
        flags: result.flags.map((flag) => ({
          id: flag.id,
          name: flag.name,
          description: flag.description,
          type: flag.config.type,
          defaultValue: flag.config.defaultValue,
          ruleCount: flag.config.rules.length,
        })),
      };
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    apps: appsWithFlags,
  };
}

export async function createAppFlagsSnapshot(
  backend: SwitchboardBackend,
  app: App
) {
  const result = await backend.listFlags(app.id);

  return {
    generatedAt: new Date().toISOString(),
    app: {
      id: app.id,
      name: app.name,
      stagingAddress: app.stagingAddress,
      nightlyAddress: app.nightlyAddress,
      productionAddresses: app.productionAddresses,
      membershipRole: app.membershipRole,
      isOwner: app.isOwner,
    },
    flags: result.flags,
  };
}

export const createEnvironmentFlagsSnapshot = createAppFlagsSnapshot;

export type { EnvironmentMember, FeatureFlag, FlagOverride, ProductionAddress };
