# ForgePilot Initial API Contract

## Conventions

- Base path: `/api`
- Media type: `application/json`
- IDs: server-generated UUID strings
- Timestamps: UTC ISO 8601 strings
- Errors: standard HTTP status with `{ statusCode, statusMessage }`
- All nested resources are validated against their parent project.

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

## Automated Verification

All routes in this contract are exercised through real HTTP integration tests. Run
`npm test` before merging an API change. The suite uses an isolated SQLite database,
a local GitLab mock, and a route-inventory guard that fails when a new API route is
added without a corresponding test. See `docs/testing.md` for the required coverage.
