# ASDP Initial API Contract

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
  "repositoryIds": ["repository-uuid"],
  "memberIds": ["member-uuid"]
}
```

`statusId` must reference a status from the same project. If omitted when creating a
requirement, the project's initial status is used. Priorities are `low`, `medium`,
`high`, and `urgent`.

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

Body: `{ "provider": "gitlab" | "github", "externalId"?: string, "name": string, "url": string, "defaultBranch": string }`.

Existing repository records default to `gitlab` during migration.

## Global GitLab Settings

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/settings/gitlab` | Read non-secret connection status and masked token hint |
| `PUT` | `/api/settings/gitlab` | Validate and save the base URL and Access Token |
| `DELETE` | `/api/settings/gitlab` | Remove the saved GitLab credential |
| `POST` | `/api/settings/gitlab/test` | Validate form values without saving |
| `GET` | `/api/integrations/gitlab/repositories` | List membership projects visible to the saved token |

`PUT` and `POST /test` accept `{ "baseUrl": string, "token"?: string }`. When a connection already exists, an omitted or empty token keeps and tests the saved token. Saved tokens are never returned by any API. Repository queries accept `search`, `page`, and `perPage` (maximum 100).

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

## Workspace Response

`GET /api/projects/:id` returns:

```json
{
  "project": {},
  "requirements": [],
  "requirementStatuses": [],
  "repositories": [],
  "members": []
}
```

Each requirement contains `statusId`, expanded `status`, `repositoryIds`, `memberIds`,
and expanded `repositories` and `members` arrays for direct display. Every member
contains its project role and an expanded global `user`.
