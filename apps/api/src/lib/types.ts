import type { ApiKeyScope, App, User } from "../db/schema.js";
import type { AppAccess } from "./permissions.js";

export type AppBindings = {
  Variables: {
    requestId: string;
    user: User;
    authType: "ui" | "apiKey" | "basic";
    appAccess: AppAccess;
    sdkApp: App;
    sdkCredential:
      | {
          kind: "apiKey";
          id: string;
          appId: string;
          environmentId: string | null;
          isDevEnvironment: boolean;
          scopes: ApiKeyScope[];
        }
      | {
          kind: "basic";
          appId: string;
        };
  };
};
