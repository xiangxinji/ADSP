# Repository Guidelines

## Project Identity & Boundaries

This repository is **ASDP — Autonomous Software Delivery Platform**（自主软件交付平台）. Display `ASDP` as the product name and use the `asdp-` prefix for services. ASDP converts requirements into verified code changes and orchestrates delivery through external systems.

ASDP is the AI control plane, not a replacement for source control, CI/CD, or runtime infrastructure. GitLab remains the source of truth for repositories, commits, merge requests, pipelines, and deployment execution. ASDP creates changes, triggers pipelines, interprets results, and retries failures through APIs and webhooks. Production credentials stay in GitLab CI or the target infrastructure.

Read `docs/product-vision.md` and `docs/architecture.md` before changing product boundaries. Update those documents when an architectural decision changes.

## Project Structure

This is a Nuxt 4 application. Code lives in `app/`, routes in `app/pages/`, shared types in `shared/`, server endpoints in `server/api/`, domain use cases in `server/services/`, persistence in `server/repositories/`, external-system adapters in `server/integrations/`, and product documentation in `docs/`. Put reusable UI in `app/components/` and shared client logic in `app/composables/`. Never commit `.nuxt/`, `.output/`, `.data/`, or `node_modules/`.

## Backend API Architecture — Hard Requirement

High cohesion and low coupling are mandatory for every backend API change. A change that violates the rules below is incomplete and must not be committed or merged.

- Enforce the dependency direction `server/api` → `server/services` → `server/repositories` / `server/integrations` → `server/utils`. Never introduce reverse imports.
- Keep endpoint files transport-only: parse and validate HTTP input, invoke a focused use case, and set the HTTP response. Do not place SQL, provider calls, or domain workflows in `server/api`.
- Organize services, repositories, integrations, and validators by business domain. Each module must have one clear reason to change; do not recreate catch-all modules such as a global store, manager, or payload file.
- Put cross-domain workflows in an explicitly named orchestration service. Domain services must expose focused operations instead of reaching into another domain's tables.
- Keep all SQLite statements and row-to-domain mapping inside `server/repositories/` or database bootstrap/migration code. Services own business rules and transaction boundaries; repositories own persistence details.
- Keep GitLab and future provider-specific requests and payloads behind `server/integrations/`. Provider response shapes must not leak into core domain models or endpoint contracts.
- Preserve API paths and shared response contracts unless the requirement explicitly changes them. Put browser/server contracts in `shared/` and server-only types inside the owning backend domain.
- Reuse small transport primitives from `server/utils/http-input.ts`, but keep domain payload validation in focused files under `server/validation/`.
- Update `docs/architecture.md` whenever these boundaries or their dependency direction change, and verify every backend change with `npm run build`.

## Build, Test, and Development Commands

- `npm install --legacy-peer-deps`: install dependencies with the required npm 10 workaround.
- `npm run dev`: start the hot-reloading development server.
- `npm run build`: validate and create the production bundle.
- `npm run preview`: run the built bundle locally.
- `npm run generate`: generate static output where supported.

Use Node.js 22.19 or newer to satisfy the installed Nuxt version's engine requirements.

## Coding Style & Naming Conventions

Use TypeScript, Vue Single-File Components, two-space indentation, single quotes, and no semicolons. Name components in PascalCase (`WorkflowRunCard.vue`), composables with a `use` prefix (`usePipelines.ts`), and utilities in kebab-case. Keep domain and integration logic outside templates.

No formatter or linter is configured yet. Avoid broad formatting-only changes until one is adopted repository-wide.

## Testing Guidelines

No test framework is configured. Every change must pass `npm run build`. When adding tests, prefer Vitest and `*.spec.ts`; add an `npm test` script in the same change.

## Commit & Pull Request Guidelines

Use Conventional Commits, for example `feat: add workflow run model`. Pull requests must explain the problem and solution, list verification commands, link issues, and include screenshots for UI changes. Keep changes focused and document migrations.

After completing each feature requirement, commit the scoped changes and push the commit to the `origin/main` branch at `https://github.com/xiangxinji/ADSP`. Do not consider a feature requirement complete until its verified changes have been committed and successfully pushed.

## Security & Configuration

Store secrets in local `.env` files and expose client-safe values only through Nuxt runtime configuration. Never commit credentials, GitLab tokens, company documents, or production data.
