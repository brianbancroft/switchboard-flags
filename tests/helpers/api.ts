import { type APIRequestContext, request } from "@playwright/test";

export const API_BASE =
  process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

export const DASHBOARD_BASE =
  process.env.PLAYWRIGHT_DASHBOARD_URL ?? "http://localhost:3002";

export type AuthedRequest = {
  api: APIRequestContext;
  userId: string;
  email: string;
  dispose: () => Promise<void>;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

/**
 * Create a Playwright APIRequestContext authenticated as the given user via
 * better-auth's `/api/auth/sign-in/email` endpoint. The returned request
 * object carries the session cookie for subsequent /api/v1/* calls.
 */
export async function signInApi(
  email: string,
  password: string
): Promise<AuthedRequest> {
  const api = await request.newContext({ baseURL: API_BASE });
  const signInRes = await api.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  if (!signInRes.ok()) {
    const body = await signInRes.text();
    throw new Error(
      `Sign-in failed for ${email}: ${signInRes.status()} ${body}`
    );
  }
  const session = await api.get("/api/auth/get-session");
  const sessionBody = (await session.json()) as {
    user?: { id: string; email: string };
  };
  if (!sessionBody?.user?.id) {
    throw new Error(`No user in session for ${email}`);
  }
  return {
    api,
    userId: sessionBody.user.id,
    email: sessionBody.user.email,
    dispose: () => api.dispose(),
  };
}

async function unwrap<T>(
  label: string,
  res: Awaited<ReturnType<APIRequestContext["get"]>>
): Promise<T> {
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok() || !body.success || !body.data) {
    throw new Error(
      `${label} failed: ${res.status()} ${body.error?.code ?? ""} ${body.error?.message ?? JSON.stringify(body)}`
    );
  }
  return body.data;
}

type AppEnvironmentSummary = {
  id: string;
  name: string;
  isDev: boolean;
  address: string | null;
};

type AppSummary = {
  id: string;
  name: string;
  environments?: AppEnvironmentSummary[];
};

export async function listApps(admin: AuthedRequest): Promise<AppSummary[]> {
  const res = await admin.api.get(`/api/v1/apps`);
  const data = await unwrap<{ apps: AppSummary[] }>("listApps", res);
  return data.apps;
}

export async function findAppByName(
  admin: AuthedRequest,
  name: string
): Promise<AppSummary | null> {
  const apps = await listApps(admin);
  return apps.find((a) => a.name === name) ?? null;
}

export async function getApp(
  actor: AuthedRequest,
  appId: string
): Promise<AppSummary> {
  const res = await actor.api.get(`/api/v1/apps/${appId}`);
  const data = await unwrap<{ app: AppSummary }>("getApp", res);
  return data.app;
}

/**
 * Create an app with a dev environment (auto) plus the explicit environments
 * passed in. Returns the created app including its env ids.
 */
export async function createApp(
  admin: AuthedRequest,
  input: {
    name: string;
    description?: string;
    environments?: Array<{ name: string; address?: string | null }>;
  }
): Promise<AppSummary> {
  const description = input.description?.trim();
  const res = await admin.api.post(`/api/v1/apps`, {
    data: {
      name: input.name,
      ...(description ? { description } : {}),
      ...(input.environments ? { environments: input.environments } : {}),
    },
  });
  return (await unwrap<{ app: AppSummary }>("createApp", res)).app;
}

export async function deleteApp(
  admin: AuthedRequest,
  appId: string
): Promise<void> {
  const res = await admin.api.delete(`/api/v1/apps/${appId}`);
  if (!res.ok())
    throw new Error(`deleteApp failed: ${res.status()} ${await res.text()}`);
}

export async function addOrUpdateMember(
  admin: AuthedRequest,
  appId: string,
  userId: string,
  role: "admin" | "manager" | "developer"
): Promise<void> {
  // Always list members first — POST will 500 on duplicate (unique violation)
  const list = await unwrap<{
    members: Array<{ id: string; userId: string; role: string }>;
  }>("listMembers", await admin.api.get(`/api/v1/apps/${appId}/members`));
  const existing = list.members.find((m) => m.userId === userId);

  if (existing) {
    if (existing.role === role) return;
    const patchRes = await admin.api.patch(
      `/api/v1/apps/${appId}/members/${existing.id}`,
      { data: { role } }
    );
    if (!patchRes.ok())
      throw new Error(
        `updateMember role failed: ${patchRes.status()} ${await patchRes.text()}`
      );
    return;
  }

  const postRes = await admin.api.post(`/api/v1/apps/${appId}/members`, {
    data: { userId, role },
  });
  if (!postRes.ok())
    throw new Error(
      `addMember failed: ${postRes.status()} ${await postRes.text()}`
    );
}

export async function listFlags(
  actor: AuthedRequest,
  appId: string
): Promise<Array<{ id: string; name: string }>> {
  const res = await actor.api.get(`/api/v1/apps/${appId}/flags`);
  const data = await unwrap<{ flags: Array<{ id: string; name: string }> }>(
    "listFlags",
    res
  );
  return data.flags;
}

export async function createFlag(
  actor: AuthedRequest,
  appId: string,
  input: { name: string; description?: string; defaultValue?: boolean }
): Promise<{ statusCode: number; body: unknown }> {
  const description = input.description?.trim();
  const res = await actor.api.post(`/api/v1/apps/${appId}/flags`, {
    data: {
      name: input.name,
      ...(description ? { description } : {}),
      config: {
        type: "boolean",
        defaultValue: input.defaultValue ?? false,
        rules: [],
      },
    },
  });
  return { statusCode: res.status(), body: await res.json() };
}

export async function setFlagEnvValue(
  actor: AuthedRequest,
  appId: string,
  flagId: string,
  environmentId: string,
  value: boolean
): Promise<{ statusCode: number; body: unknown }> {
  const res = await actor.api.put(
    `/api/v1/apps/${appId}/flags/${flagId}/env-values/${environmentId}`,
    { data: { value } }
  );
  return { statusCode: res.status(), body: await res.json() };
}

export async function deleteFlag(
  actor: AuthedRequest,
  appId: string,
  flagId: string
): Promise<{ statusCode: number; body: unknown }> {
  const res = await actor.api.delete(
    `/api/v1/apps/${appId}/flags/${flagId}`
  );
  return { statusCode: res.status(), body: await res.json() };
}
