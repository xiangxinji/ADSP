# Project-wide Asset Operations

The workflow library groups operations by 仓库, 成员, 环境, and 知识. Each group
contains a draggable "获取所有…" operation, even when the project has no assets.
These are read-only collection commands; they do not select a single fixed asset,
accept an asset ID, clone repositories, or fetch remote provider inventories.

## API and Contracts

All collection commands use
`POST /api/projects/:id/assets/:assetType/operations/:operationId` with no body or `{}`.
The route project ID is the only project context; input parameters cannot override it.

| Asset type | Operation ID | Label | Response type |
|---|---|---|---|
| `repository` | `repository.list` | 获取所有仓库 | `RepositoryAsset[]` |
| `member` | `member.list` | 获取所有成员 | `ProjectMember[]` |
| `environment` | `environment.list` | 获取所有环境 | `EnvironmentAsset[]` |
| `knowledge` | `knowledge.list` | 获取所有知识 | `KnowledgeAsset[]` |

Successful responses are HTTP `200` with the complete array of assets registered in
that project. Empty collections return `[]`. Each element has the same domain shape
as the corresponding project workspace collection, including repository metadata,
member user profiles, environment test accounts, or knowledge Markdown and references.
Global user authentication passwords and provider credentials are never included.
Environment accounts may contain the same non-sensitive test passwords already stored
on their asset; never register production credentials or secrets there.

The single source of truth is `shared/config/asset-operations.ts` (schema version 6).
Each command declares `execution.scope: 'project'`, an empty input contract, a typed
array `contract.outputType`, all element fields in `contract.output`, and stable
exceptions. Nested object fields use `fields`; object arrays use `type: 'object[]'`;
nullable properties declare `nullable: true`. Existing commands without `outputType`
continue to return their existing object shapes. `AssetOperationCatalog` renders the
complete contract; project-scoped operations are not individual asset-row actions.

## Workflow Example

```json
{
  "id": "all-repositories",
  "assetType": "repository",
  "operationId": "repository.list",
  "assetSource": "input",
  "inputs": {},
  "position": { "x": 260, "y": 250 }
}
```

Connect the trigger to this node, then connect its normal output to a repository
operation such as `repository.clone`. In that downstream node, select input values
and set `repositoryId` to `$prev.0.id`. This selects only the first returned repository;
it does not loop over or clone every repository. Array order follows the asset domain's
collection order; callers should not assume a particular asset always occupies index 0.
Nested fields such as `$prev.0.user.name` and `$prev.0.accounts.0.account` are also
supported where their declared types match the downstream input.

Run history stores the raw asset arrays as node outputs. Collection nodes require no
root input. An empty collection is successful; an out-of-range downstream reference
fails that node with `workflow.input-reference-not-found` before invoking its command.

## Expected Errors

| HTTP status | `data.code` | Meaning |
|---|---|---|
| `404` | `asset.project-not-found` | The project does not exist. |
| `404` | `asset.operation-not-found` | The asset type or project-scoped command is unsupported. |
| `400` | `asset.invalid-input` | Extra inputs, a single-asset binding, or the single-asset endpoint were supplied. |
| `500` | `asset.list-failed` | The asset collection could not be read; internal details are not returned. |

Workflow command failures retain these codes in their step errors and can be selected
as exception ports using the shared contract. Unknown workflow input fields remain
definition-validation errors. Missing projects never silently become empty collections.
The existing single-asset operation endpoints retain their paths and result contracts.
