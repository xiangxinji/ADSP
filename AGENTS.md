# Repository Guidelines

## Agent Skill Restrictions

Do not invoke, load, or follow any skill whose name begins with `superpowers:` while working in this repository. Use the repository guidelines, normal development workflows, or relevant non-superpowers skills instead.

## Project Identity & Boundaries

This repository is **ForgePilot · 铸航 — Autonomous Software Delivery Platform**（自主软件交付平台）. Display `ForgePilot` as the product name, `铸航` as its Chinese name, and use the `forgepilot-` prefix for new services. ForgePilot converts requirements into verified code changes and orchestrates delivery through external systems.

ForgePilot is the AI control plane, not a replacement for source control, CI/CD, or runtime infrastructure. GitLab remains the source of truth for repositories, commits, merge requests, pipelines, and deployment execution. ForgePilot creates changes, triggers pipelines, interprets results, and retries failures through APIs and webhooks. Production credentials stay in GitLab CI or the target infrastructure. Preserve legacy `ASDP_*` environment variables and persisted identifiers when compatibility requires them.

Read `docs/product-vision.md` and `docs/architecture.md` before changing product boundaries. Update those documents when an architectural decision changes.

## Project Structure

This is a Nuxt 4 application. Code lives in `app/`, routes in `app/pages/`, shared types in `shared/`, server endpoints in `server/api/`, domain use cases in `server/services/`, persistence in `server/repositories/`, external-system adapters in `server/integrations/`, and product documentation in `docs/`. Put reusable UI in `app/components/` and shared client logic in `app/composables/`. Never commit `.nuxt/`, `.output/`, `.data/`, or `node_modules/`.

Whenever any new asset type is added, update the Markdown editor shortcuts in the same change so the new asset type is available from the editor's shortcut UI.

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

## Asset Operation Contract — Hard Requirement

Every workflow-ready asset command must declare its stable operation contract in
`shared/config/asset-operations.ts`; do not create separate client, API, and workflow
descriptions. The contract must define every input and output field with its stable
name, type, requirement status, and description, plus every expected exception with a
stable machine-readable code and operator-facing description. `AssetOperationCatalog`
must render this shared contract so users can inspect an operation before running it.

Command implementations must return the declared output shape. Expected runtime
failures must be constructed with `createAssetOperationError` from
`server/utils/asset-operation-error.ts`, which returns the same stable code in the HTTP
error `data.code`; workflows must branch on that code rather than translated error
text. New workflow-ready commands are incomplete without contract tests, success and
error-response API tests, and documentation updates. Client-only asset actions remain
outside workflow contracts.

## Project Filesystem Boundary — Hard Requirement

All filesystem operations performed for a project must stay inside that project's dedicated directory at `<global-workspace>/projects/<project-id>/`. Repository working copies belong at `<global-workspace>/projects/<project-id>/repositories/<repository-name>/`. Never place project-owned files directly under the global workspace root, never read or write another project's directory, and never allow relative traversal or absolute paths to escape the owning project directory.

Backend code must resolve project-owned paths through the shared project-workspace containment primitive in `server/utils/workspace-path.ts` (or the corresponding settings-service wrapper) instead of joining paths ad hoc. Global control-plane state such as the SQLite database and encryption keys remains outside project directories. Any project filesystem feature is incomplete unless its containment behavior is covered by tests.

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
