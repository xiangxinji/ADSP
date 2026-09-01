# ForgePilot Architecture Overview

## Status

This is a living architecture document. It records agreed boundaries and early conceptual design; implementation technology beyond the current Nuxt 4 shell is not yet decided.

## System Context and Responsibility Boundary

ForgePilot is the orchestration and intelligence control plane. GitLab and the runtime environment remain execution systems.

| System | Responsibility |
|---|---|
| ForgePilot | Requirements, specifications, planning, agent coordination, code-change workflows, result interpretation, retry, audit, and policy |
| GitLab | Repositories, branches, commits, merge requests, permissions, and review history |
| GitLab CI | Build, test, security scan, artifact generation, deployment, and rollback jobs |
| Runtime infrastructure | Kubernetes, cloud services, servers, databases, secrets, logs, and metrics |

ForgePilot must not require direct production credentials when GitLab CI or the target infrastructure can perform the operation.

## End-to-End Control Loop

```text
User requirement
    ↓
Requirement specification + acceptance criteria
    ↓
Workflow definition and dependency graph
    ↓
Agent tasks execute in isolated workspaces
    ↓
Branch / commit / merge request created in GitLab
    ↓
GitLab CI pipeline triggered
    ├─ failed → webhook → log analysis → repair task → new commit
    └─ passed → policy gate → merge → GitLab CI deployment
                                      ↓
                           status synchronized to ForgePilot
```

## Logical Modules

- **Identity and Organization:** users, teams, projects, roles, and integration ownership.
- **Requirement Service:** requirements, clarification history, specifications, and acceptance criteria.
- **Workflow Orchestrator:** definitions, runs, steps, dependencies, state transitions, retries, and cancellation.
- **Agent Runtime:** agent roles, task context, model selection, tool authorization, and isolated execution.
- **Artifact and Context Service:** plans, patches, reports, logs, generated documents, and provenance.
- **Source Control Adapter:** repository discovery, branches, commits, merge requests, comments, and webhooks.
- **Delivery Adapter:** pipelines, jobs, logs, artifacts, environments, and deployment status.
- **Policy and Approval Engine:** risk rules, quality gates, human checkpoints, budgets, and permissions.
- **Audit and Observability:** event history, traces, cost, execution metrics, and failure diagnosis.

Repository connections identify their source-control provider. GitLab remains the first delivery adapter, while GitHub repositories can be registered now without leaking provider-specific data into the core workflow domain. GitHub Actions, Jenkins, and Argo CD delivery adapters can be added later without changing that domain.

## Backend Module Boundaries

The current Nuxt implementation is a modular monolith with an enforced inward dependency direction:

```text
server/api (HTTP transport) → server/validation (request contracts)
                            → server/services (domain use cases and orchestration)
                              → server/repositories | server/integrations
                                (persistence | external providers)
                                → server/utils (database and technical primitives)
```

Endpoint handlers parse input, invoke one focused use case, and shape the HTTP response. Services own business rules and transaction boundaries. Repositories own SQLite statements and row mapping, while integrations isolate GitLab or other provider protocols. Cross-domain read models such as the project workspace are assembled by explicitly named orchestration services rather than a global data store. Modules are grouped by business domain so adding a provider, persistence implementation, or use case does not require unrelated endpoint changes.

## Core Domain Model

```text
Organization 1─* User
Organization 1─* Project
Project      *─* User through ProjectMember
Project      1─* RepositoryConnection
Project      1─* Requirement
Project      1─* RequirementVersion
Requirement  1─* WorkflowRun
WorkflowRun  1─* AgentTask
WorkflowRun  1─* Artifact
WorkflowRun  1─* Approval
WorkflowRun  1─* DeliveryReference

DeliveryReference → Commit → MergeRequest → Pipeline → Environment
```

A workflow run is the central auditable unit. It links the original intent to every task, generated artifact, code change, quality result, approval, and delivery outcome.

## Project Entry, Requirements, and Assets

`Project` is the primary workspace and authorization boundary. It owns requirement records and repository connections, and associates organization users through project memberships.

```text
Project 1─* Requirement
Project 1─* RequirementStatus
Project 1─* RequirementVersion
Project 1─* RepositoryAsset
Project 1─* ProjectMember *─1 User
Project 1─* EnvironmentAsset 1─0..* EnvironmentAccount
Project 1─* KnowledgeAsset

Requirement *─1 RequirementStatus
Requirement *─* RequirementVersion through Requirement.version_ids
Requirement *─* RepositoryAsset through RequirementRepository
Requirement *─* ProjectMember through RequirementParticipant
Requirement 1─* WorkflowRun
```

`RequirementRepository` records how a repository participates, such as primary target, dependency, or read-only reference, together with branch or write-scope constraints. `RequirementParticipant` records responsibility such as requester, owner, contributor, reviewer, or approver.

Each `RequirementVersion` is a project-owned major-version line. The user stores only a non-negative integer major and ForgePilot renders it as `v{major}.x`. The project-local maximum major is derived as `latest`; no mutable latest flag is persisted. A requirement can target multiple versions. To keep this bounded model lightweight, its selected stable version IDs are stored in `Requirement.version_ids` as a comma-separated list rather than a join table. Services validate every ID against the owning project before writing, and referenced versions cannot be deleted.

Each `RepositoryAsset` stores a provider discriminator (`gitlab` or `github`) alongside its external ID, name, note, URL, and a branch-strategy enum. `multi-version` is the default and links branches to requirement version lines: `main` and `test` are the release and test branches for `latest`, while `vN.x` and `vN.x-test` are the release and test branches for version `vN.x`. `development-production` limits the repository to the long-lived `dev` development branch and `main` production branch. Existing repository records migrate to `multi-version`. The provider's own default-branch metadata remains provider-owned data and is queried from GitLab or GitHub when needed instead of being persisted by ForgePilot. Existing records migrate to `gitlab`, and legacy persisted default-branch values are removed. Provider-specific synchronization and delivery behavior stays behind source-control and delivery adapters.

Each `EnvironmentAsset` is project-owned and records an HTTP(S) address, an optional note, and a lifecycle type: `development`, `testing`, or `production`. It owns zero or more ordered `EnvironmentAccount` records containing an account name and an optional password. In the current controlled preview any supplied passwords are limited by product policy to non-sensitive, self-service test accounts, stored as plain text in SQLite, and returned unchanged by the environment API so the UI can display them without masking. Existing environment rows migrate with an empty note, and existing account-only rows migrate with an empty password. Tokens, private keys, and production deployment credentials remain outside this model and stay in GitLab CI or the target infrastructure.

Each `KnowledgeAsset` is a project-owned Markdown document. Its title and authored Markdown content are stored unchanged in SQLite. The client creates metadata first with an empty Markdown string, then authors the body on a dedicated full-screen editor route; title and body updates remain independent API operations. The client uses Milkdown for live editing and maps inline tokens such as `[[repository:record-id]]` to atomic controls that show current asset metadata and serialize back to the same Markdown token. New tokens use the stable English asset types `repository`, `member`, `environment`, and `knowledge` with an ASCII colon separator; legacy Chinese type aliases and full-width separators remain readable for compatibility. Supported targets are repository assets, project members, environment assets, and other knowledge assets. Resolution is restricted to the current project. The Markdown remains the source of truth: deleting or moving a target does not rewrite authored content, and the API returns the token as unresolved instead of silently pointing elsewhere.

The SQLite bootstrap creates the environment, account, and knowledge tables idempotently for existing installations. Existing projects and assets require no data rewrite; their environment and knowledge collections begin empty.

The ForgePilot rebrand preserves legacy database identifiers and the default `.data/asdp.sqlite` path. During bootstrap, only the untouched `project-asdp` sample project with its exact former default name and description is renamed; user-edited project records are never overwritten.

People may appear in the product's Asset module, but the domain must not model a person as project-owned data. A person belongs to the organization; `ProjectMember` grants project context, and `RequirementParticipant` grants requirement context.

Global platform users are stored independently from projects and exposed through the
top-level User Management module. A `User` has no `project_id`; future project access
is expressed through `ProjectMember` instead of assigning ownership to the user. A
project member selects one global user and stores only project-scoped metadata such as
the member's role. Requirements reference project members, not global users directly,
so participant roles remain meaningful within the project. Existing project people
records migrate to global users and project memberships by email.

The first implementation persists these records in SQLite through the Nuxt server API. Database access remains behind a repository layer so a future PostgreSQL migration can preserve the same identities, constraints, and API contracts.

Requirement lifecycle states are project-owned records, not application enums. Each
`RequirementStatus` has a stable project-local key, display name, color, ordering,
and initial/terminal flags. A requirement stores `status_id`; status deletion is
rejected while requirements reference it. Projects start with six editable states:
Draft, Clarifying, Ready, In Progress, Validating, and Delivered. This design lets
each project evolve its workflow vocabulary without deploying application code.

## Integration Contract with GitLab

ForgePilot is expected to use GitLab OAuth or scoped project tokens, REST/GraphQL APIs, and signed webhooks. Relevant resources include projects, branches, commits, merge requests, pipelines, jobs, logs, artifacts, and environments. Webhook events enter ForgePilot's event processing layer and advance or suspend the associated workflow run.

Integration code must be isolated behind adapters. GitLab-specific payloads must not leak into core domain entities. Store external IDs and immutable event records so synchronization is idempotent and recoverable.

The current single-tenant preview provides one global GitLab connection. An operator configures the GitLab base URL and a scoped Personal Access Token; ForgePilot validates it through the GitLab user API before saving it. The token is encrypted with AES-256-GCM using `FORGEPILOT_CREDENTIAL_ENCRYPTION_KEY`, or a generated local key under `.data` for development. Legacy `ASDP_*` configuration names remain supported for existing deployments. Read APIs return only connection metadata and a masked token hint. The browser never receives the saved token, and GitLab requests remain inside the server-side adapter.

Repository discovery uses this connection to list membership projects. Importing a result creates a ForgePilot `RepositoryAsset` with its GitLab project ID as `external_id`; it does not copy or replace the GitLab repository. The global credential is an initial operating model for local or controlled deployments. Organization-scoped ownership, administrator authorization, OAuth, token rotation policy, and per-project credentials remain required before a multi-tenant production release.

## Cross-Cutting Requirements

- Every automated action must record actor, model, input context, tool call, output, and resulting external reference.
- Agent permissions and credentials must be least-privilege, scoped, revocable, and short-lived where possible.
- Workflow steps must be resumable and idempotent; webhook delivery may be duplicated or delayed.
- Policies must support unattended execution, approval checkpoints, and immediate human takeover.
- Cost, token usage, elapsed time, retries, and failure reasons must be observable per run.

## Open Architecture Decisions

- Modular monolith versus separately deployed control-plane services.
- Persistent database, queue, event bus, and workflow-engine technology.
- Workspace isolation model: containers, Kubernetes jobs, or remote development environments.
- Artifact storage and long-term execution-log retention.
- Multi-tenant isolation and enterprise identity integration.
- Runtime monitoring integration after GitLab CI completes deployment.
