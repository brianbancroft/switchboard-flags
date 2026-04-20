type RedocOptions = {
  title: string;
  specUrl: string;
  headline: string;
  body: string;
};

export function renderRedocHtml({
  title,
  specUrl,
  headline,
  body,
}: RedocOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Inter", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(123, 92, 255, 0.12), transparent 28%),
          linear-gradient(180deg, #f7f7fb 0%, #ffffff 42%);
        color: #171717;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
      }

      .hero {
        padding: 2.5rem 1.5rem 1rem;
      }

      .eyebrow {
        margin: 0 0 0.5rem;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6d28d9;
      }

      h1 {
        margin: 0;
        font-size: clamp(2.25rem, 5vw, 3.5rem);
        line-height: 1;
      }

      .hero p {
        max-width: 44rem;
        margin: 0.85rem 0 0;
        color: #52525b;
        font-size: 1rem;
        line-height: 1.6;
      }

      redoc {
        display: block;
        padding: 0 1rem 2rem;
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <p class="eyebrow">OpenAPI</p>
      <h1>${headline}</h1>
      <p>${body}</p>
    </section>
    <redoc spec-url="${specUrl}"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
}
