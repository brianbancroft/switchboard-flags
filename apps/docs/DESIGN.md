# Design System — docs

## Stack

- **Astro 5** + **Starlight 0.32**
- Custom brand CSS in `src/styles/starlight-overrides.css`
- Tailwind `@theme` directive for spacing and radius tokens

## Brand Palette

| Name | Value | Use |
|------|-------|-----|
| `--switchboard-paper` | `#f7f2ea` | Page background |
| `--switchboard-wash` | `#ebe4db` | Cards, subtle surfaces |
| `--switchboard-ink` | `#4f473f` | Body text |
| `--switchboard-shadow` | `rgba(88, 71, 56, 0.16)` | Elevation |
| Accent | `hsl(30 68% 43%)` | Links, highlights |

## Voice & Tone

- **Friendly and direct.** Write like you're explaining to a smart colleague, not authoring a spec.
- Use second person ("you", "your project") rather than passive constructions.
- Short sentences. Prefer examples over long descriptions.
- Headings are sentence case.

## Content Structure

Sidebar sections (defined in `astro.config.mjs`):

```
Overview      — what Switchboard is and why it exists
Architecture  — how the pieces fit together
API           — reference material
Workflow      — how-to guides
```

New pages go under the matching section. Keep each page focused on one topic.

## Custom Styling

Override Starlight defaults by adding CSS variables to `starlight-overrides.css`. Avoid overriding Starlight component structure — prefer CSS-only changes to stay upgrade-safe.
