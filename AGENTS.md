## Comprehensive Project Structure Overview

I've explored the Modelence application codebase. Here's a detailed breakdown of what's available:

---

## 🚨 CRITICAL FRAMEWORD INFORMATION

### Modelence Framework - MANDATORY USAGE

**THIS PROJECT USES THE MODELENCE FRAMEWORK. NON-NEGOTIABLE.**

**MANDATORY MCP SERVER USAGE:**
- **ALWAYS** use the Modelence MCP server to fetch the LATEST documentation
- **NEVER** rely on cached documentation or assumptions about Modelence
- **REQUIRED** to consult MCP before implementing any Modelence-specific features
- **NON-NEGOTIABLE** for all server-side modules, queries, mutations, and database operations

**When to use Modelence MCP Server (MANDATORY):**
- Creating or modifying backend modules (`new Module()`)
- Defining database schemas and stores
- Implementing queries and mutations
- Setting up cron jobs
- Configuring authentication
- Working with React Query integration (`@modelence/react-query`)
- ANY server-side operations

**How to access Modelence documentation:**
```
Use MCP: ListMcpResourcesTool -> ReadMcpResourceTool for Modelence
Search: mcp__modelence__SearchModelence for specific topics
```

**CONSEQUENCES of skipping MCP consultation:**
- Outdated implementation patterns
- Breaking changes in newer versions
- Missed optimizations and features
- Incompatible code structure
- GUARANTEED technical debt

---

### 1. PROJECT STRUCTURE

```
/user-app/
├── src/
│   ├── client/                      # React frontend
│   │   ├── assets/                  # Images/logos (favicon.svg, modelence.svg)
│   │   ├── components/
│   │   │   ├── ui/                  # Reusable UI components (shadcn-style)
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Label.tsx
│   │   │   │   └── Card.tsx
│   │   │   ├── LoadingSpinner.tsx    # Custom loading component
│   │   │   └── Page.tsx              # Page wrapper with header
│   │   ├── pages/                    # Route pages
│   │   │   ├── HomePage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SignupPage.tsx
│   │   │   ├── ExamplePage.tsx
│   │   │   ├── PrivateExamplePage.tsx
│   │   │   ├── LogoutPage.tsx
│   │   │   ├── TermsPage.tsx
│   │   │   └── NotFoundPage.tsx
│   │   ├── lib/
│   │   │   └── utils.ts              # Utility functions (cn helper)
│   │   ├── router.tsx                # React Router configuration
│   │   ├── index.tsx                 # App entry point
│   │   ├── types.d.ts
│   │   └── index.css
│   │
│   └── server/                       # Node.js backend
│       ├── app.ts                    # Server entry point
│       └── example/
│           ├── index.ts              # Module definition with queries/mutations
│           ├── db.ts                 # Database schemas
│           └── cron.ts               # Scheduled jobs
│
├── Configuration Files
│   ├── tsconfig.json                 # TypeScript config with @/* path alias
│   ├── tailwind.config.js            # Tailwind CSS setup
│   ├── vite.config.ts                # Vite bundler config
│   ├── postcss.config.js
│   └── modelence.config.ts           # Modelence framework config
│
└── package.json                      # Dependencies & scripts
```

### 2. AVAILABLE UI COMPONENTS (SHADCN-STYLE)

All components are custom implementations located in `/user-app/src/client/components/ui/`:

#### Button Component (`/user-app/src/client/components/ui/Button.tsx`)
- **Variants**: default, destructive, outline, secondary, ghost, link
- **Sizes**: default, sm, lg, icon
- **Features**: Forward ref, fully styled with Tailwind, hover/active states
- **Props**: `ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`

#### Input Component (`/user-app/src/client/components/ui/Input.tsx`)
- **Features**: Forward ref, styled with Tailwind
- **Supports**: All standard HTML input attributes
- **Styling**: Border, focus ring, dark mode, placeholder colors

#### Label Component (`/user-app/src/client/components/ui/Label.tsx`)
- **Features**: Semantic label element with peer-disabled states
- **Props**: `LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement>`

#### Card Component (`/user-app/src/client/components/ui/Card.tsx`)
- **Subcomponents**: 
  - `Card` - Main container
  - `CardHeader` - Header section with padding
  - `CardTitle` - Title text styling
  - `CardDescription` - Description text styling
  - `CardContent` - Content wrapper
  - `CardFooter` - Footer section

All components use the `cn()` utility function for class merging.

### 3. UTILITY FUNCTIONS

**File**: `/user-app/src/client/lib/utils.ts`

```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
- Uses `clsx` for conditional classes
- Uses `tailwind-merge` to prevent class conflicts
- Perfect for merging component classes with custom overrides

### 4. EXISTING FORM PATTERNS

The app already has two working form examples you can reference:

#### LoginForm (`/user-app/src/client/pages/LoginPage.tsx`)
- Email and password fields
- `FormData` API for form submission
- Card-based layout with headers and footers
- Validation and error handling
- Links to signup

#### SignupForm (`/user-app/src/client/pages/SignupPage.tsx`)
- Email, password, confirm password
- Checkbox for terms acceptance
- Success state handling
- Client-side password validation
- Toast error notifications
- `useCallback` hook for form submission
- State management for success state

### 5. APP STRUCTURE & ARCHITECTURE

#### Client Setup (`/user-app/src/client/index.tsx`)
```typescript
- React Query (TanStack) integration
- React Router DOM
- React Hot Toast for notifications
- Suspense boundaries with loading state
- Global error handler
```

#### Router Configuration (`/user-app/src/client/router.tsx`)
- **Public Routes**: Home, Example, Terms, Logout, 404
- **Guest Routes**: Login, Signup (redirects to home if authenticated)
- **Private Routes**: PrivateExamplePage (redirects to login if not authenticated)
- **Route Protection**: 
  - `GuestRoute` component for auth-only pages
  - `PrivateRoute` component for protected pages
  - Redirect with `_redirect` query param to return after login

#### Page Wrapper (`/user-app/src/client/components/Page.tsx`)
- Header with logo, user info, logout button
- Responsive layout with max-width
- Body section with optional loading state
- Built-in navigation

### 6. MODULE SYSTEM (Backend)

**File**: `/user-app/src/server/example/index.ts`

Example shows Module pattern with:

```typescript
new Module('example', {
  configSchema: { /* configuration */ },
  stores: [ /* database stores */ ],
  queries: {
    getItem: async (args, { user }) => { /* query logic */ },
    getItems: async (args, { user }) => { /* query logic */ }
  },
  mutations: {
    createItem: async (args, { user }) => { /* mutation logic */ },
    updateItem: async (args, { user }) => { /* mutation logic */ }
  },
  cronJobs: {
    dailyTest: dailyTestCron
  }
})
```

#### Database Pattern (`/user-app/src/server/example/db.ts`)
```typescript
export const dbExampleItems = new Store('exampleItems', {
  schema: {
    title: schema.string(),
    createdAt: schema.date(),
    userId: schema.userId(),
  },
  indexes: []
});
```

### 7. KEY DEPENDENCIES

From `package.json`:
```json
{
  "@modelence/react-query": "^1.0.2",      // Modelence + React Query integration
  "@tanstack/react-query": "^5.90.12",     // Server state management
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.22.0",           // Client routing
  "react-hot-toast": "^2.4.1",             // Toast notifications
  "zod": "^4.1.13",                        // Schema validation
  "tailwindcss": "^3.4.1",                 // Styling
  "clsx": "^2.1.1",                        // Class utilities
  "tailwind-merge": "^3.4.0"               // Class merging
}
```

### 8. BUILD & DEVELOPMENT

**Scripts** (from package.json):
```bash
npm run dev          # Development server
npm run build        # Production build
npm start            # Start production server
npm test             # Run tests (not configured)
```

**Vite Configuration**:
- Root: `src/client`
- Path alias: `@/` → `./src/`
- Dev server: `0.0.0.0:5173` (allows external access)
- React plugin enabled

### 9. STYLING SETUP

- **Tailwind CSS**: Configured with `src/client/**/*.{js,jsx,ts,tsx}` content paths
- **PostCSS**: Enabled with autoprefixer
- **Color Scheme**: Gray, black, white primary colors; blue, red accents

### 10. AVAILABLE PATTERNS FOR TODO LIST FORM

You can reuse:

1. **Form Structure**: FormData API like in LoginPage/SignupPage
2. **Validation**: Zod on backend, client-side checks in form
3. **UI Components**: Button, Input, Label, Card for form container
4. **Page Layout**: Use Page wrapper component
5. **Toast Notifications**: `react-hot-toast` for feedback
6. **State Management**: React Query for server state
7. **Hooks**: `useCallback`, `useState`, `useMutation`, `useQuery`
8. **Styling**: Use `cn()` utility to combine classes

### Summary

This is a full-stack Modelence framework application with:
- Clean component structure ready for a todo list feature
- All necessary UI building blocks already available
- Form handling patterns established
- Database and backend module patterns ready to follow
- Authentication system in place
- TypeScript support throughout
- No external shadcn/ui dependency needed - custom components are already implemented

---

## AVAILABLE SKILLS

### Design & Frontend Skills

- **Skill(12-principles-of-animation)**: MANDATORY when reviewing motion, implementing animations, or checking animation quality. MUST audit animation code against Disney's 12 principles adapted for web. Outputs file:line findings. NEVER skip animation quality checks.

- **Skill(baseline-ui)**: NON-NEGOTIABLE foundation for all UI work. Enforces opinionated UI baseline to prevent AI-generated interface slop. REQUIRED for component consistency. Skipping this guarantees inconsistency and amateur results.

- **Skill(canvas-design)**: REQUIRED when user asks to create a poster, piece of art, design, or static visual piece. MUST create beautiful visual art in .png and .pdf documents using design philosophy. NEVER copy existing artists' work to avoid copyright violations. Create ORIGINAL visual designs exclusively.

- **Skill(design-lab)**: MANDATORY when user wants to explore UI design options, redesign existing components, or create new UI with multiple approaches to compare. Conducts design interviews, generates five distinct UI variations in a temporary design lab, collects feedback, and produces implementation plans. NEVER skip the exploration phase for significant UI work.

- **Skill(frontend-design)**: REQUIRED for all web components, pages, artifacts, posters, or applications. Creates distinctive, production-grade frontend interfaces with high design quality. MUST generate creative, polished code that avoids generic AI aesthetics. NEVER produce forgettable, template-like designs.

- **Skill(interface-design)**: EXCLUSIVELY for dashboards, admin panels, SaaS apps, tools, settings pages, and data interfaces. NOT for landing pages, marketing sites, campaigns—those redirect to frontend-design. MANDATORY for building interface design with craft and consistency. NEVER produce generic dashboards.

- **Skill(interaction-design)**: REQUIRED when adding polish to UI interactions, implementing loading states, or creating delightful user experiences. Designs and implements microinteractions, motion design, transitions, and user feedback patterns. NEVER ship interactions without thoughtful feedback patterns.

- **Skill(ui-ux-pro-max)**: COMPREHENSIVE design intelligence for UI/UX work. Contains 50+ styles, 97 color palettes, 57 font pairings, 99 UX guidelines across 9 technology stacks. MANDATORY for design, build, create, implement, review, fix, improve, optimize, enhance, or refactor tasks. NEVER guess design decisions—consult this skill first.

### Accessibility & Performance Skills

- **Skill(fixing-accessibility)**: NON-NEGOTIABLE for all UI work. Fixes accessibility issues with minimal, targeted changes. MANDATORY when adding or changing buttons, links, inputs, menus, dialogs, tabs, dropdowns, forms, validation, error states, keyboard shortcuts, or custom interactions. NEVER ship inaccessible code.

- **Skill(fixing-metadata)**: REQUIRED for shipping correct, complete metadata. MANDATORY when adding or changing page titles, descriptions, canonical, robots, Open Graph, Twitter cards, favicons, app icons, manifest, theme-color, structured data, locale, or alternate languages. NEVER ship incomplete metadata.

- **Skill(fixing-motion-performance)**: MANDATORY when adding or changing UI animations, refactoring janky interactions, implementing scroll-linked motion, or animating layout, filters, masks, gradients. Fixes animation performance issues. NEVER ship performance-killing animations.

- **Skill(wcag-audit-patterns)**: REQUIRED for conducting WCAG 2.2 accessibility audits with automated testing, manual verification, and remediation guidance. MANDATORY when auditing websites for accessibility, fixing WCAG violations, or implementing accessible design patterns. NEVER skip accessibility compliance for public-facing sites.

- **Skill(web-design-guidelines)**: MANDATORY when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices". Reviews UI code for Web Interface Guidelines compliance. NEVER ship unreviewed UI code.

### Platform-Specific Skills

- **Skill(swiftui-ui-patterns)**: REQUIRED when creating or refactoring SwiftUI UI, designing tab architecture with TabView, composing screens, or needing component-specific patterns and examples. Provides best practices and example-driven guidance for building SwiftUI views and components. NEVER guess SwiftUI patterns.

### Framework-Specific Skills

- **Modelence Framework (NON-NEGOTIABLE)**: This project is BUILT ON Modelence framework. MANDATORY usage of Modelence MCP server for ALL backend operations. **ALWAYS** fetch latest documentation via `mcp__modelence__SearchModelence` before implementing:
  - Backend modules (`new Module()`)
  - Database schemas and stores
  - Queries and mutations
  - Cron jobs
  - Authentication
  - React Query integration (`@modelence/react-query`)

**NEVER implement Modelence features without consulting MCP first.** Skipping MCP consultation guarantees outdated patterns, breaking changes, and technical debt.
