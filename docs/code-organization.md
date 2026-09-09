# Code Organization

ForgePilot keeps its existing Nuxt routes, API contracts, and backend dependency
direction. This guide describes where implementation responsibilities belong; the
product and system boundaries remain defined in `product-vision.md` and
`architecture.md`.

## Frontend

| Directory | Responsibility |
| --- | --- |
| `app/pages/` | Route parameters, page loading, and composing domain UI |
| `app/components/App*.vue` | Cross-domain UI primitives and application shell |
| `app/components/asset/` | Asset menus and shared operation-contract presentation |
| `app/components/knowledge/` | Knowledge editor and inline asset-reference UI |
| `app/components/project/` | Project workspace, asset lists, and editing dialogs |
| `app/components/workflow/` | Workflow canvas, inspectors, execution history, and step details |
| `app/components/settings/`, `app/components/users/` | Settings and user-management UI |
| `app/composables/` | Focused reactive state, client requests, and interaction orchestration |
| `app/utils/` | Stateless client helpers and presentation formatting |
| `app/editor/` | Markdown parser/editor integration and editor-specific extensions |
| `shared/` | Browser/server contracts, operation catalog, and runtime-independent domain helpers |

Use PascalCase component names and `use`-prefixed composable names. Keep component
names stable when moving them into their matching domain directory. Update explicit
imports and verify Nuxt-generated component resolution with a production build.

Each Vue file must stay within **300 physical lines and 10 KiB**. Split by coherent
UI or domain responsibility rather than compressing templates or adding pass-through
wrappers. Passing the size check does not replace a responsibility review.

For example, `ProjectRepositoryAssets` composes the asset list and dialogs, while
`useRepositoryAssetActions` owns command prompts, requests, progress, deletion, and
feedback. `WorkflowRunPanel` owns run history and node selection;
`WorkflowRunStepDetail` renders the selected node's execution details, backed by
`useWorkflowRunStepDetails` for iteration selection and result interpretation.

## Backend

Keep HTTP transport in `server/api/`, domain use cases and explicitly named
orchestrations in `server/services/`, SQL and row mapping in `server/repositories/`,
provider protocols in `server/integrations/`, and payload validation in
`server/validation/`. Low-level `server/utils/` must not import higher layers.
Endpoint imports of technical utilities are limited to `server/utils/http-input`.
Existing server-only constants in `server/domain/` remain dependency-free; database
bootstrap and repositories can share these defaults without reversing backend layers.

Do not move workflow command contracts out of `shared/config/asset-operations.ts`.
Project filesystem access must continue to use the existing containment primitive
in `server/utils/workspace-path.ts`; this organization does not change those rules.

## Verification

```sh
npm run test:architecture
npm test
```

The architecture tests check Vue size limits, component/composable names, domain
component placement, literal backend imports, and browser/server separation. They
cover static imports, re-exports, and literal dynamic imports/require calls; they do
not replace semantic review of SQL placement, provider calls, or domain workflows.
`npm test` builds the application and runs all Vitest unit and API tests, including
the architecture checks. Keep temporary audit material and generated output out of Git.
