import "../.astro/types.d.ts";

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_API_SPEC_URL?: string;
  }
}
