# Plan: Implement Dashboard & User Management Pages

## Context

The current web app has a sidebar with sample/placeholder data (Acme Inc, Playground, Models, etc.) and a bare dashboard page. The Figma design shows the actual Switchboard product UI with proper branding, navigation, stats, app cards, and user management pages. We need to replace the placeholder UI with the real design — using normal HTML text and shadcn components, not vectorized/SVG output.

## Role Mapping (Figma → DB)

| Figma Label | DB Role | 
|---|---|
| Admin | `admin` |
| Maintainer | `manager` |
| User | `developer` |

## Missing shadcn Components to Add

- **badge** — for role badges (Admin, Maintainer, User)
- **dialog** — for the Invite User modal
- **select** — for the Role dropdown in the invite form
- **table** — for the users list (already imported in sidebar exploration but not present as file)

## Steps

### 1. Add missing shadcn UI components
Add `badge`, `dialog`, `select`, and `table` components via `pnpm dlx shadcn@latest add badge dialog select table` in `apps/web/`.

### 2. Rewrite the sidebar (`components/app-sidebar.tsx`)
Replace the current sample data sidebar with the Figma design:

- **Header**: Switchboard logo (square with "S") + "Switchboard" title + "Feature Flags" subtitle (no TeamSwitcher)
- **PLATFORM section**: Apps, Usage Statistics, API Keys (flat links, no collapsible submenus)
- **ADMIN section**: Users, Settings (flat links)
- **Footer**: User avatar + name + email (keep NavUser but simplify — just log out, remove Upgrade/Billing/Notifications)
- Remove `TeamSwitcher`, `NavMain`, `NavProjects` components (or stop importing them)
- Use `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` directly with `Link` components for navigation
- Active state: highlight based on current route using `useLocation()`

**Files**: `components/app-sidebar.tsx` (rewrite), `components/nav-user.tsx` (simplify)

### 3. Build the Dashboard Overview page (`routes/dashboard._index.tsx`)
Replace the current minimal page with the full Figma design:

- **Header row**: "Overview" title (h1, text-2xl) + "Welcome to Switchboard." subtitle + "+ New App" button (right-aligned)
- **Stats row**: 4 cards in a grid — Total Apps (12), Active Flags (47), API Calls 24h (14.2k), Team Members (8). Each card has a label, large number, and a right-side accent bar
- **"RECENT APPS" section label** (uppercase, small, muted)
- **App cards grid**: 3x2 grid of cards, each with app name (bold), description, saturation %, flag count
- **"View all apps →" link** at the bottom

All data is hardcoded/static for now (matching the Figma mockup values).

**Files**: `routes/dashboard._index.tsx` (rewrite)

### 4. Build the App Users page (`routes/dashboard.users.tsx`)
Create a new route for user management, matching all 3 Figma role variants:

- **Header**: "App Users" title + subtitle (varies by role) + "+ Invite User" button (admin/maintainer only)
- **"8 users" count** label
- **Search bar**: text input with search icon + placeholder text
- **Role filter pills** (admin view only): All, Admin, Maintainer, User
- **Users table**: columns vary by role:
  - All roles see: User (avatar + name + email), Role (badge), Status (dot + label)
  - Admin also sees: "Change role" dropdown + "Remove" action
  - Maintainer sees: read-only (no actions column)
  - User sees: read-only (no actions, no filters)

For now, hardcode the user list matching the Figma data. Use a `role` variable (hardcoded to "admin" initially) to toggle which variant renders. The real role will come from session/API later.

**Files**: `routes/dashboard.users.tsx` (new)

### 5. Build the Invite User dialog
Create a dialog component triggered by the "+ Invite User" button:

- **Title**: "Invite User"
- **Subtitle**: "Send an invitation to join this application."
- **Close button** (X)
- **Form fields**: Email address (input), Username (input), Role (select: User/Maintainer/Admin)
- **Actions**: Cancel + Send Invite buttons

**Files**: `components/invite-user-dialog.tsx` (new), used in `dashboard.users.tsx`

### 6. Clean up unused components
Remove or leave the now-unused placeholder components:
- `components/team-switcher.tsx` — no longer imported
- `components/nav-main.tsx` — no longer imported  
- `components/nav-projects.tsx` — no longer imported

## Files Modified/Created

| File | Action |
|---|---|
| `apps/web/components/ui/badge.tsx` | Add (shadcn) |
| `apps/web/components/ui/dialog.tsx` | Add (shadcn) |
| `apps/web/components/ui/select.tsx` | Add (shadcn) |
| `apps/web/components/ui/table.tsx` | Add (shadcn) |
| `apps/web/components/app-sidebar.tsx` | Rewrite |
| `apps/web/components/nav-user.tsx` | Simplify |
| `apps/web/app/routes/dashboard._index.tsx` | Rewrite |
| `apps/web/app/routes/dashboard.users.tsx` | Create |
| `apps/web/components/invite-user-dialog.tsx` | Create |
| `apps/web/components/team-switcher.tsx` | Delete |
| `apps/web/components/nav-main.tsx` | Delete |
| `apps/web/components/nav-projects.tsx` | Delete |

## Verification

1. `pnpm build` — ensure no type errors
2. `pnpm lint` — ensure no lint warnings (--max-warnings 0)
3. `pnpm dev --filter web` — start dev server, visually verify:
   - Sidebar matches Figma (Switchboard branding, Platform/Admin sections, user footer)
   - Dashboard overview shows stats cards and app grid
   - `/dashboard/users` shows the users table
   - Invite User dialog opens and has correct form fields
