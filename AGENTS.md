# Repository Guidelines

## Project Identity & Boundaries

This repository is **ASDP — Autonomous Software Delivery Platform**（自主软件交付平台）. Display `ASDP` as the product name and use the `asdp-` prefix for services. ASDP converts requirements into verified code changes and orchestrates delivery through external systems.

ASDP is the AI control plane, not a replacement for source control, CI/CD, or runtime infrastructure. GitLab remains the source of truth for repositories, commits, merge requests, pipelines, and deployment execution. ASDP creates changes, triggers pipelines, interprets results, and retries failures through APIs and webhooks. Production credentials stay in GitLab CI or the target infrastructure.

Read `docs/product-vision.md` and `docs/architecture.md` before changing product boundaries. Update those documents when an architectural decision changes.

## Project Structure

This is a Nuxt 4 application. Code lives in `app/`, routes in `app/pages/`, shared types in `shared/`, server endpoints in `server/api/`, SQLite access in `server/utils/`, and product documentation in `docs/`. Put reusable UI in `app/components/` and shared client logic in `app/composables/`. Never commit `.nuxt/`, `.output/`, `.data/`, or `node_modules/`.

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
