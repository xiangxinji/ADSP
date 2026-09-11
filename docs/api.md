# ForgePilot Initial API Contract

## Conventions

- Base path: `/api`
- Media type: `application/json`
- IDs: server-generated UUID strings
- Timestamps: UTC ISO 8601 strings
- Errors: standard HTTP status with `{ statusCode, statusMessage }`
- All nested resources are validated against their parent project.

## AI Interface Assets

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects/:id/ai-interfaces` | List the project's AI interface metadata, never keys |
| `POST` | `/api/projects/:id/ai-interfaces` | Create an interface with `provider`, `name`, and `apiKey` |
| `PATCH` | `/api/ai-interfaces/:id` | Update metadata or replace the key; omit `apiKey` to retain it |
| `DELETE` | `/api/ai-interfaces/:id` | Delete the interface and its encrypted key |

Creation returns `201`; list/update return `200`; deletion returns `204`. Invalid
input returns `400`, unknown projects/assets `404`, and project-local duplicate names
`409`. Responses contain only `id`, `projectId`, `provider`, `name`, `hasApiKey`,
`createdAt`, and `updatedAt`. Project workspaces add `aiInterfaces`; summaries add
`aiInterfaceCount`. See [AI interface assets](ai-interface-assets.md) for limits,
credential handling, and Markdown references. These management actions are not
workflow-ready commands and do not call providers.

## Projects

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List projects with requirement and asset counts |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/:id` | Get a complete project workspace |
| `PATCH` | `/api/projects/:id` | Update project metadata |
| `DELETE` | `/api/projects/:id` | Delete a project and its owned records |

Create or update body: `{ "name": string, "description": string }`.

## Requirements

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/requirements` | Create a requirement in the project |
| `PATCH` | `/api/requirements/:id` | Update fields and asset references transactionally |
| `DELETE` | `/api/requirements/:id` | Delete a requirement and its references |

Requirement body:

```json
{
  "title": "Add enterprise login",
  "description": "Support the company identity provider.",
  "acceptanceCriteria": "Users can sign in and sign out.",
  "statusId": "status-uuid",
  "priority": "high",
  "versionIds": ["version-uuid"],
  "repositoryIds": ["repository-uuid"],
  "memberIds": ["member-uuid"]
}
```

`statusId` must reference a status from the same project. If omitted when creating a
requirement, the project's initial status is used. Priorities are `low`, `medium`,
`high`, and `urgent`.

Creation stores the requirement and one durable `requirement-created` event in the same
transaction. The response remains `201` with the created `Requirement`; trigger processing
continues after the response. Every ready workflow in that project whose trigger kind is
`requirement-created` receives one run. Manual workflows and workflows in other projects
are not selected.

The run's root value is the complete created `Requirement` response. Nodes can reference
fields such as `$root.id`, `$root.title`, `$root.repositoryIds.0`, and
`$root.members.0.user.email`. Event-started runs include `triggerEventId`; the pair of
workflow ID and trigger-event ID is unique so queue recovery cannot create the same run
twice. Queue records being processed during a restart return to pending, while an already
created run is marked `workflow.interrupted` and is not replayed automatically.

### Requirement Status Changes

Set the workflow root trigger kind to `requirement-status-changed` (需求状态变更时).
After `PATCH /api/requirements/:id` actually changes `statusId`, the update and an immutable
event are saved in one transaction. The response remains `200` with the updated
`Requirement`; matching ready workflows in the same project execute asynchronously.
Creation, edits to other fields, saving the same status, changes to status metadata, and
rejected updates do not emit this event. Every real transition emits a separate event,
including transitions back to a previous status. By default the trigger listens to all
status changes. Set `trigger.statusIds` to select one or more destination statuses:

```json
{
  "trigger": {
    "kind": "requirement-status-changed",
    "position": { "x": 260, "y": 80 },
    "statusIds": ["ready-status-id", "review-status-id"]
  }
}
```

Only transitions whose new `statusId` is in this list start the workflow; the previous
status does not affect this filter. Omit `statusIds` to select **任意状态**. For
**指定状态（可多选）**, provide a nonempty array of IDs belonging to the same project,
including custom statuses. Empty arrays, null, non-string values, missing/foreign status
IDs, and filters on other trigger kinds return `400`; duplicate IDs are deduplicated.
Metadata-only workflow patches retain the filter; send a trigger without `statusIds` to
clear it explicitly. Definitions, project responses, and immutable run snapshots retain
the selected IDs. Renaming a status does not change matching. Deleting a selected status
never broadens the filter, and other selected statuses remain effective; remove deleted
IDs before saving further definition edits. Existing definitions without a filter keep
their any-status behavior. This filter applies to automatic event dispatch, not explicit
subworkflow calls.

The root object follows `RequirementStatusChangedWorkflowRoot`:

| Field | Type | Required | Description |
|---|---|---|---|
| `requirementId` | string | Yes | ID of the requirement whose status changed; bind `$root.requirementId` in nodes. |
| `previousStatusId` | string | Yes | Status ID immediately before this change. |
| `statusId` | string | Yes | Status ID immediately after this change. |

These values are captured at update time, not read again when the queue executes.
Status-change events share the creation-event queue, project isolation, run history,
restart recovery, and unique workflow/event delivery guarantees. They cannot be started
through the manual-run endpoint.

## Workflow Definitions

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/workflows` | Create workflow basic information as a draft |
| `PATCH` | `/api/workflows/:id` | Update metadata, trigger, operation nodes, and directed edges |
| `DELETE` | `/api/workflows/:id` | Delete a workflow definition |
| `POST` | `/api/workflows/:id/runs` | Start the saved manual workflow; returns `202` |
| `GET` | `/api/workflows/:id/runs` | Read execution history, newest first, with node results |

Create body: `{ "name": string, "note": string }`. The response starts with
`trigger: null`, `nodes: []`, and `edges: []` so the client can navigate directly to the canvas.

### Manual Runs

Start accepts no body, `{}`, or `{ "root": { ... } }`; it never accepts replacement project
IDs, nodes, or saved inputs. `root` is the manual trigger's JSON object for this attempt.
It is persisted in run history and must not contain credentials or other secrets.
Save edits through `PATCH` before starting. The saved definition must have a `manual`
trigger, at least one operation, valid fixed project-local assets, and a complete connected path.
Literal command inputs are validated before creating a run. Reference-based inputs are
type-checked and command-validated immediately before their node executes, after their
source output exists.

Input-sourced asset identities are resolved immediately before their command executes.
They must identify registered assets in the workflow's project. Blank IDs fail with
`workflow.asset-input-invalid`; cross-project IDs fail with
`workflow.asset-project-mismatch`; missing repositories retain `repository.not-found`.
These are step errors in an accepted run, not start-response errors. No provider or
filesystem command runs for the rejected node. Existing command output and exception
contracts remain unchanged, including those for repository cloning.

The `202` response is a `WorkflowRun` (`shared/types/workflow-runs.ts`): `id`, `workflowId`,
`workflow` (the complete definition snapshot), `root`, `status`, `steps`, `startedAt`, and
`finishedAt`. Each ordered step includes `nodeId`, `status`, `startedAt`, `finishedAt`,
`resolvedInputs`, `output` (the operation's declared result, or null), and `error` (null or
`{ code, message }`).
Run status is `running`, `succeeded`, or `failed`; steps additionally use `pending`,
`skipped`, and `handled`. A matching configured operation exception port marks that
step `handled` and preserves its `error`, even when no child is connected. Handled errors
do not fail the run or stop later sync iterations; a handler's own unhandled error still
fails its path. Historical run records are not rewritten. Times are ISO-8601 strings,
or null before the corresponding event occurs.

History returns the persisted `WorkflowRun[]` with `Cache-Control: no-store`. Polling once
per second exposes the currently running node even before its command finishes. A failed
operation without a matching exception port preserves its shared contract error code,
stops its path, and skips remaining nodes; it is a failed run rather than a failure of the
already-accepted start request.
Starting again creates a new attempt and re-executes the chain from the beginning.

Project-wide asset-list nodes return raw typed arrays in `steps[].output`, not an
`{ assets: [...] }` wrapper. Their resolved input object is `{}`. Downstream nodes can
read an asset field with `$prev.0.id`; an empty list succeeds, but reading its first
element fails with `workflow.input-reference-not-found` before the downstream command.

Operation input strings may be exact value references. `$root.release.branch` reads the
manual trigger object (or the corresponding field in an event root), while `$prev.branch` reads the previous value on the currently
executing path. Dot segments traverse nested objects; numeric segments traverse arrays,
for example `$root.releases.0.branch`. References replace the complete input value and
preserve its type; they are not string templates. A normal operation edge supplies the
successful operation output. An exception edge preserves incoming data and supplies
`error: { code, message }`; handlers read `$prev.error.code` and `$prev.error.message`.
The reserved `error` field is replaced on subsequent exceptions, not business fields.
A sync or
async child invocation receives one element of the upstream output array, while the control
node's `complete` or `error` outlet receives its `{ branches, selectedPort }` output.

Sync and async definitions use one fixed execution port: `sourceHandle: 'item'`, connected
to exactly one child. `branches` may be omitted in request payloads and defaults to
`[{ id: 'item', label: '逐项执行' }]`; custom or multiple ports are rejected with `400`.
Optional `complete` and `error` outlets remain unchanged. The executor repeats the child
subtree for each upstream array element; sync follows array order and skips later elements
after failure, while async runs concurrently and waits for all invocations. An empty array
completes without invoking the child. Non-array input fails the control step with
`workflow.control-input-not-array` and follows its error outlet without invoking the child.

Control `output.branches[]` entries include `index` (zero-based input position), `input`
(original element), `portId: 'item'`, `nodeId`, `status`, `failedNodeId`, and `error`.
Entries remain in input order even when asynchronous invocations finish out of order.
Repeated nodes store independent `steps[].executions[]` records, each with an
`iterationPath: [{ nodeId, index }]` from outermost to innermost control, plus its own
resolved inputs, output, error, status, and timestamps. Top-level steps aggregate status;
when there are multiple invocations their aggregate `resolvedInputs` and `output` are null
rather than an arbitrary invocation's values. Older run histories may omit iteration data.
Old definition handles map to `item` without dropping nodes or edges; multiple connected
legacy children require explicitly removing excess connections before saving or running.

Runtime reference failures use `workflow.input-reference-not-found`,
`workflow.previous-output-unavailable`, or `workflow.input-type-mismatch` and stop that
path before invoking its command.

Start-time errors include `404` for missing workflows/assets, `400` for invalid definitions
or command inputs (command validation retains its stable `data.code`), and these `409`s:

| `data.code` | Meaning |
|---|---|
| `workflow.manual-trigger-required` | A manual trigger is required |
| `workflow.empty` | At least one connected operation is required |
| `workflow.already-running` | This definition already has an active attempt |

Workflow/project deletion also returns `409` while a run is active. Idle deletion removes
the associated run history. After a server restart, unfinished attempts become failed with
`workflow.interrupted` on affected steps; completed results remain intact. The executor
does not replay commands automatically. Unexpected command failures use
`workflow.operation-failed` without exposing internal error details.

### Definition Updates

Patch requests may include `name`, `note`, `trigger`, `nodes`, or `edges`. Supported initial
triggers are `manual`, `requirement-created`, and `requirement-status-changed`. Each trigger and operation node stores
finite canvas coordinates. An operation node has the following stable shape:

```json
{
  "id": "node-uuid",
  "assetType": "repository",
  "assetSource": "input",
  "operationId": "repository.create-branch",
  "inputs": {
    "repositoryId": "$root.repositoryId",
    "branch": "$root.release.branch",
    "source": "$prev.branch"
  },
  "position": { "x": 420, "y": 180 }
}
```

`assetSource` supports `input` and `fixed`. Input mode omits `assetId` and supplies the
contract's asset identity field through `inputs` (a literal ID, `$root.repositoryId`,
or `$prev.repositoryId`). Fixed mode requires a project-local `assetId` and an identical
literal identity input. Omitting the source preserves legacy fixed behavior when an
`assetId` exists; otherwise it defaults to input. Unknown sources, an `assetId` combined
with input mode, missing fixed IDs, and mismatched fixed inputs return `400`.
No database migration or API-path change is required.

Project-scoped list operations are an exception to single-asset input configuration:
use `assetSource: "input"`, omit `assetId`, and supply `inputs: {}`. They automatically
read the saved workflow's project and reject fixed-asset bindings. See
`docs/project-asset-operations.md` for the array contracts and project-level endpoints.

For `repository.clone`, use `assetType: "repository"`, `operationId: "repository.clone"`,
`assetSource: "input"`, and `inputs: { "repositoryId": "$prev.repositoryId" }`.
The result remains `{ repositoryId, path }`. This uses a registered repository ID, not
an arbitrary clone URL; the existing project-workspace containment rules still apply.

Edges persist the connections created on the canvas:

```json
{
  "id": "edge-uuid",
  "source": "workflow-trigger",
  "target": "node-uuid"
}
```

The connected path from `workflow-trigger` determines execution order; the service
normalizes the returned node array to that order. Operation nodes require a root trigger,
must reference assets from the workflow's project, and may use only commands marked
workflow-ready in `shared/config/asset-operations.ts`. Inputs are checked against that
operation's shared contract; in fixed mode, the bound asset ID must match the selected asset. The
initial graph must be one connected acyclic chain: no self-connections, duplicate edges,
branching, multiple upstream nodes, cycles, or disconnected operation nodes are accepted.
The first release persists definitions only; it does not execute triggers or workflows.

## Requirement Versions

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/requirement-versions` | Create a project major-version line |
| `PATCH` | `/api/requirement-versions/:id` | Change its major number |
| `DELETE` | `/api/requirement-versions/:id` | Delete an unused version |

Create body: `{ "major": 3 }`. Patch requests use the same field. `major` must be a
non-negative integer and is unique within a project. Responses render the version name
as `v{major}.x`; the greatest configured major has `isLatest: true`. Requirements may
reference multiple project-local versions through `versionIds`. A referenced version
cannot be deleted until it is removed from those requirements.

## Requirement Statuses

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/requirement-statuses` | Create a project status |
| `PATCH` | `/api/requirement-statuses/:id` | Update status metadata |
| `DELETE` | `/api/requirement-statuses/:id` | Delete an unused status |

Create body:

```json
{
  "key": "reviewing",
  "name": "Reviewing",
  "color": "#2563eb",
  "sortOrder": 40,
  "isInitial": false,
  "isTerminal": false
}
```

All fields may be patched. Keys are unique within a project. Setting `isInitial`
to `true` clears that flag from the project's previous initial status. A referenced
status, the only status, or the current initial status cannot be deleted; reassign
requirements or designate another initial status first.

## Repository Assets

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/repositories` | Register a repository |
| `PATCH` | `/api/repositories/:id` | Update repository metadata |
| `DELETE` | `/api/repositories/:id` | Remove it and cascade requirement references |
| `POST` | `/api/repositories/:id/clone` | Compatibility route for the `repository.clone` operation |
| `POST` | `/api/repositories/:id/update` | Compatibility route for the `repository.update` operation |
| `POST` | `/api/assets/:assetType/:id/operations/:operationId` | Execute a configured server-side asset operation |

Body: `{ "provider": "gitlab" | "github", "branchStrategy"?: "multi-version" | "development-production", "externalId"?: string | null, "name": string, "note"?: string, "url": string }`.

`note` is optional user-authored context for the repository and defaults to an empty string.
`externalId` is null when a repository is registered manually rather than selected from GitLab discovery.
`branchStrategy` defaults to `multi-version`. In that strategy, `main` / `test` map to the
release / test branches for `latest`, and `vN.x` / `vN.x-test` map to the release / test
branches for requirement version `vN.x`. `development-production` uses only `dev` for
development and `main` for production release.

Existing repository records default to `gitlab` during migration.
Existing repository records default to the `multi-version` branch strategy during migration.
The repository asset does not persist a default branch; integrations query provider-owned branch metadata when needed.

The versioned operation registry lives in `shared/config/asset-operations.ts`. The
generic operation route accepts `repository.clone`, `repository.update`,
`repository.local-clone-status`, `repository.create-worktree`, and
`repository.create-branch` plus `repository.create-merge-request` for the `repository`
asset type.
`repository.local-clone-status` returns
`{ "repositoryId": string, "cloned": boolean, "path": string }`. Create a worktree
with body `{ "branch": string }`; the branch must already exist locally or on `origin`,
and the result is `{ "repositoryId": string, "branch": string, "path": string }`.
Its path is fixed below `repositories/worktrees/` as
`<repository-name>_<branch-name>` (branch slashes render as `-`). Client-only operations
such as editing or deleting metadata return `404` from this route and are not available
to workflow execution. Operation IDs are stable contracts intended for later
workflow-step configuration.

Create a remote branch with body `{ "branch": string, "source": string }`, where
`branch` is the new branch and `source` is the existing original branch. The result is
`{ "repositoryId": string, "branch": string, "source": string }`. The current server
adapter supports GitLab repository assets imported with an external project ID and uses
the saved GitLab connection to call the repository-branches API. Unsupported providers,
missing external IDs, missing source branches, duplicate target branches, and provider
failures return the stable codes declared by the operation contract.

Create a merge request with body
`{ "source": string, "target": string, "title": string }`. `source` contains the
changes and must differ from `target`; `title` is limited to 255 characters. The result
is `{ "repositoryId": string, "mergeRequestId": string, "mergeRequestNumber": string,
"title": string, "source": string, "target": string, "webUrl": string }`. GitLab's
global ID and project-local IID are normalized to strings so the workflow contract does
not depend on provider numeric types. Missing branches, duplicate open merge requests,
empty comparisons, and provider rejection use the stable exception codes declared in
the operation registry.

Every workflow-ready command carries a versioned operation contract in that registry:
its required inputs, outputs, and expected exceptions all have stable names and types.
Exceptions have a stable code such as `repository.local-copy-exists`; an operation
failure returns the same code in `{ "data": { "code": string } }`, alongside the
standard HTTP status and `statusMessage`. Workflow definitions must use these fields
and codes rather than button text or translated error messages.

Every repository asset response includes `localOperation`, either `null` or the most
recent local operation: `{ "operationId", "status", "startedAt", "finishedAt",
"error" }`. `status` is `running`, `succeeded`, or `failed`. ForgePilot records
`running` before executing a local repository command and synchronizes the same record
to success or failure when the command returns. Refreshing the project workspace reads
this persisted state; the client does not poll for completion.

## Global GitLab Settings

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/settings/gitlab` | Read non-secret connection status and masked token hint |
| `PUT` | `/api/settings/gitlab` | Validate and save the base URL and Access Token |
| `DELETE` | `/api/settings/gitlab` | Remove the saved GitLab credential |
| `POST` | `/api/settings/gitlab/test` | Validate form values without saving |
| `GET` | `/api/integrations/gitlab/repositories` | List membership projects visible to the saved token |

`PUT` and `POST /test` accept `{ "baseUrl": string, "token"?: string }`. When a connection already exists, an omitted or empty token keeps and tests the saved token. Saved tokens are never returned by any API. Repository queries accept `search`, `page`, and `perPage` (maximum 100).

## Global Local Workspace Settings

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/settings/workspace` | Read the configured server-local workspace directory |
| `PUT` | `/api/settings/workspace` | Create, validate, and save the workspace directory |

`PUT` accepts `{ "path": string }`. The path must be absolute and cannot be a filesystem
or drive root. ForgePilot creates a missing directory, verifies that it is readable and
writable, resolves it to a canonical path, and then persists it. Until this setting exists,
filesystem-backed business operations must fail with a configuration error. Repository
working copies, task files, and generated artifacts must resolve beneath this root; path
traversal outside it is rejected. The application database and credential-encryption key
are control-plane state and remain at their independently configured locations.

## Users

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/users` | List global platform users |
| `POST` | `/api/users` | Create a global platform user |

Create body: `{ "name": string, "email": string, "role": "administrator" | "member" }`.
Users are global and are not owned by a project.

## Project Members

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/members` | Select a global user as a project member |
| `PATCH` | `/api/members/:id` | Update the project-specific role |
| `DELETE` | `/api/members/:id` | Remove the membership and cascade requirement references |

Create body: `{ "userId": string, "role": string }`. Patch body: `{ "role": string }`.
The selected user must exist globally and can appear only once in a project.

## Environment Assets

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/environments` | Register a project environment |
| `PATCH` | `/api/environments/:id` | Update its address, note, type, or accounts |
| `DELETE` | `/api/environments/:id` | Remove the environment and its accounts |

Create body:

```json
{
  "address": "https://test.example.com",
  "note": "Used by the QA team for acceptance testing",
  "type": "testing",
  "accounts": [
    { "account": "release-bot", "password": "test-password" },
    { "account": "qa-user", "password": "qa-password" }
  ]
}
```

The optional note records the environment's purpose or access constraints. The
address must be an HTTP(S) URL without embedded credentials. Types are
`development`, `testing`, and `production`. The accounts array may be empty and
accepts a maximum of 20 unique account names. Each account name is required, while
its password is optional and allows up to 500 characters. Supplied account passwords
are intended for non-sensitive, self-service test accounts and are stored and returned
without masking. Tokens, private keys, and production deployment credentials remain
outside this API.

## Knowledge Assets

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/knowledge` | Create a Markdown knowledge document |
| `PATCH` | `/api/knowledge/:id` | Update its title or Markdown content |
| `DELETE` | `/api/knowledge/:id` | Delete the knowledge document |

Create body: `{ "title": string, "content": string }`. Both fields are required, but
`content` may be an empty string so the knowledge metadata can be created before its
Markdown body is authored. Patch requests may contain either field. `content` is
stored as authored Markdown.

Knowledge Markdown may contain `[[asset type：record id]]` tokens. Supported English
types are `repository`, `member`, `environment`, and `knowledge`; the Chinese aliases
`代码仓库`, `项目成员`, `环境`, and `知识` are also accepted. The response includes a
deduplicated `references` array with the authored `assetType`, canonical `targetType`,
`recordId`, resolved label, and `resolved` flag. Targets outside the current project,
deleted records, and unknown asset types are returned as unresolved. The API never
rewrites the Markdown when a target is deleted.

## Workspace Response

`GET /api/projects/:id` returns:

```json
{
  "project": {},
  "workflows": [],
  "requirements": [],
  "requirementStatuses": [],
  "requirementVersions": [],
  "repositories": [],
  "members": [],
  "environments": [],
  "knowledge": []
}
```

Each requirement contains `statusId`, expanded `status`, `versionIds`, `repositoryIds`,
`memberIds`, and expanded `versions`, `repositories`, and `members` arrays for direct display. Every member
contains its project role and an expanded global `user`.
Each knowledge record contains its stored Markdown and resolved reference metadata.
Each workflow record contains its basic information, optional root trigger, operation
nodes with their canvas positions and contract inputs, and stable directed edges.

## Automated Verification

All routes in this contract are exercised through real HTTP integration tests. Run
`npm test` before merging an API change. The suite uses an isolated SQLite database,
a local GitLab mock, and a route-inventory guard that fails when a new API route is
added without a corresponding test. See `docs/testing.md` for the required coverage.

## Agent Executor Operations

`POST /api/projects/:id/assets/repository/operations/repository.agent-codex` and
`POST /api/projects/:id/assets/repository/operations/repository.agent-claude-code` execute
the two agent backends with `{ prompt, writable, references, upstream? }`.
`references` is an array of `{ assetType, assetId }` belonging to the route's project;
`writable` must be an explicit boolean. These operations do not bind a single repository ID.

Successful responses return `{ text, executor, writable, durationMs }`. Invalid inputs,
unavailable assets/workspaces, missing credentials, runtime failures, timeouts, invalid
results and write conflicts return the registry's stable `agent.*` codes in `data.code`.
Workflow nodes use this same contract and automatically supply upstream JSON; the next
node receives the full result, with text available through `$prev.text`.
See `docs/agent-executors.md` for required runtime configuration and security limits.
