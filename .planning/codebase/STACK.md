# Technology Stack

**Analysis Date:** 2026-06-20

## Languages

**Primary:**
- TypeScript 5.8.3 - All application source code under `src/`
- JavaScript (CJS) - Electron main process (`electron/main.cjs`, `electron/preload.cjs`)

**Secondary:**
- CSS (via Tailwind utility classes) - Styling throughout `src/`

## Runtime

**Environment:**
- Node.js 24.16.0 (development toolchain and Electron host)
- Chromium (Electron renderer process — the actual React app runs here)

**Package Manager:**
- npm 11.13.0
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- React 18.3.1 - UI component model, used exclusively as SPA inside Electron renderer
- React Router DOM 6.30.1 - Client-side routing (`src/pages/`)
- Electron 39.2.7 - Desktop shell; wraps the Vite-built React SPA as a native Windows app

**UI Component Layer:**
- shadcn/ui (config at `components.json`) - Component generation scaffolding; style: "default", baseColor: slate, cssVariables: true
- Radix UI primitives (full suite, ~24 packages) - Headless accessible primitives used by shadcn components in `src/components/ui/`
- Tailwind CSS 3.4.17 - Utility-first CSS framework; config at `tailwind.config.ts`
- tailwindcss-animate 1.0.7 - Animation utilities (accordion open/close)
- `@tailwindcss/typography` 0.5.16 - Prose styling (devDependency)

**Form & Validation:**
- react-hook-form 7.61.1 - Form state management
- `@hookform/resolvers` 3.10.0 - Adapter layer (Zod integration)
- Zod 3.25.76 - Schema validation and type inference

**Data Fetching / State:**
- `@tanstack/react-query` 5.83.0 - Server/async state management (installed; usage limited to infrastructure, all primary data is local-storage-based)

**Charts / Visualisation:**
- Recharts 2.15.4 - Chart library used in `src/pages/Reports.tsx`

**Date Handling:**
- date-fns 3.6.0 with `ptBR` locale - All date formatting and arithmetic throughout `src/lib/` and pages

**Notifications:**
- sonner 1.7.4 - Toast notifications via `toast()` calls across all pages

**Build/Dev:**
- Vite 5.4.19 - Dev server (port 8080) and production bundler; config at `vite.config.ts`
- `@vitejs/plugin-react-swc` 3.11.0 - SWC-powered React transform (replaces Babel)
- lovable-tagger 1.1.13 - Development-only component tagging plugin (active in `development` mode only)
- concurrently 9.2.1 - Runs Vite dev server and Electron process in parallel
- wait-on 9.0.3 - Waits for Vite TCP port before launching Electron in dev mode
- cross-env 10.1.0 - Sets `NODE_ENV=development` for Electron dev launch

**Linting:**
- ESLint 9.32.0 - Configured at `eslint.config.js` (flat config format)
- typescript-eslint 8.38.0 - TypeScript-aware lint rules
- eslint-plugin-react-hooks 5.2.0 - Enforces Rules of Hooks
- eslint-plugin-react-refresh 0.4.20 - Guards against non-component exports during HMR

## Key Dependencies

**Critical:**
- `electron-store` 11.0.2 - Persistent JSON key-value store written to the OS user-data directory; the sole persistence layer for all application data (products, clients, sales, installments, settings). IPC handlers exposed at `electron/main.cjs` lines 16-28; renderer accesses via `window.electron.store` bridged in `electron/preload.cjs`.
- `jspdf` 4.0.0 - In-browser PDF generation. Used by `src/lib/generateReceipt.ts`, `src/lib/generateQuote.ts`, `src/lib/generateCrediarioReceipt.ts`. No server required; PDFs are opened in new tab (autoPrint) or downloaded via blob URL.
- `react-router-dom` 6.30.1 - SPA routing between pages (Dashboard, POS, Products, Clients, Sales, Quotes, Returns, Reports, Settings, CreditNotes).

**Infrastructure:**
- `lucide-react` 0.462.0 - Icon library used pervasively across all pages and components
- `date-fns` 3.6.0 - Date formatting with Brazilian locale (`ptBR`) throughout receipts and reports
- `class-variance-authority` 0.7.1 - Variant-based className builder used in shadcn button/badge components
- `clsx` + `tailwind-merge` - Combined in `src/lib/utils.ts` as the `cn()` helper; used in every component
- `embla-carousel-react` 8.6.0 - Carousel primitive (shadcn dependency, not directly referenced in business logic)
- `react-day-picker` 8.10.1 - Calendar widget used in shadcn `calendar.tsx`
- `cmdk` 1.1.1 - Command palette primitive backing shadcn `command.tsx`; used in POS product search
- `vaul` 0.9.9 - Drawer primitive (shadcn `drawer.tsx`)
- `next-themes` 0.3.0 - Theme provider (dark mode toggle infrastructure)
- `input-otp` 1.4.2 - OTP input primitive (shadcn component, not used in business logic)
- `react-resizable-panels` 2.1.9 - Resizable layout panels (shadcn `resizable.tsx`)

## Configuration

**TypeScript:**
- `tsconfig.json` - Root config; references `tsconfig.app.json` and `tsconfig.node.json`. Strict mode is OFF (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`).
- `tsconfig.app.json` - App source config; target ES2020, bundler module resolution, path alias `@/*` → `./src/*`, `noEmit: true`.

**Path Aliases:**
- `@/*` maps to `src/*` — configured in both `tsconfig.json` and `vite.config.ts`

**Build Output:**
- Vite builds to `dist/` (web bundle)
- Electron builder packages to `dist-electron/`
- Electron builder config in `package.json` `"build"` key: appId `com.pdv.rccasaconstrucao`, Windows NSIS installer, icon at `build/icon.ico`

**Vite Dev Server:**
- Host: `::` (all interfaces), Port: `8080`
- Base: `./` (relative paths, required for Electron file:// loading)

## Platform Requirements

**Development:**
- Node.js 24.x
- npm 11.x
- Windows (primary target; Electron builder targets win32 NSIS)
- Run `npm run electron:dev` to launch Vite + Electron concurrently

**Production:**
- Windows desktop application distributed as NSIS installer
- No server required — fully offline, all data stored locally via electron-store
- No environment variables needed (no external API keys)

---

*Stack analysis: 2026-06-20*
