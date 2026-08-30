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
  "personIds": ["person-uuid"]
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

Body: `{ "provider": "gitlab" | "github", "name": string, "url": string, "defaultBranch": string }`.

Existing repository records default to `gitlab` during migration.

## People

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/:id/people` | Add a project member record |
| `PATCH` | `/api/people/:id` | Update member metadata |
| `DELETE` | `/api/people/:id` | Remove it and cascade requirement references |

Body: `{ "name": string, "email": string, "role": string }`.

## Workspace Response

`GET /api/projects/:id` returns:

```json
{
  "project": {},
  "requirements": [],
  "requirementStatuses": [],
  "repositories": [],
  "people": []
}
```

Each requirement contains `statusId`, expanded `status`, `repositoryIds`, `personIds`,
and expanded `repositories` and `people` arrays for direct display.
