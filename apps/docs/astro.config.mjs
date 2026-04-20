import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    starlight({
      title: "Switchboard Docs",
      customCss: ["./src/styles/starlight-overrides.css"],
      social: {
        github: "https://github.com",
      },
      editLink: {
        baseUrl:
          "https://github.com/brianbancroft/switchboard/edit/main/apps/docs/src/content/docs/",
      },
      sidebar: [
        {
          label: "Overview",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Getting Started", slug: "getting-started" },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "System Overview", slug: "architecture/system-overview" },
            { label: "API Boundary", slug: "architecture/api-boundary" },
          ],
        },
        {
          label: "API",
          items: [{ label: "Reference", link: "/api" }],
        },
        {
          label: "Workflow",
          items: [{ label: "GitHub Workflow", slug: "workflow/github" }],
        },
      ],
    }),
  ],
});
