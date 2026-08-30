# ASDP Architecture Overview

## Status

This is a living architecture document. It records agreed boundaries and early conceptual design; implementation technology beyond the current Nuxt 4 shell is not yet decided.

## System Context and Responsibility Boundary

ASDP is the orchestration and intelligence control plane. GitLab and the runtime environment remain execution systems.

| System | Responsibility |
|---|---|
| ASDP | Requirements, specifications, planning, agent coordination, code-change workflows, result interpretation, retry, audit, and policy |
| GitLab | Repositories, branches, commits, merge requests, permissions, and review history |
| GitLab CI | Build, test, security scan, artifact generation, deployment, and rollback jobs |
| Runtime infrastructure | Kubernetes, cloud services, servers, databases, secrets, logs, and metrics |

ASDP must not require direct production credentials when GitLab CI or the target infrastructure can perform the operation.

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
                           status synchronized to ASDP
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

## Core Domain Model

```text
Organization 1─* Project
Project      1─* RepositoryConnection
Project      1─* Requirement
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
Project 1─* RepositoryAsset
Project 1─* ProjectMember *─1 User

Requirement *─1 RequirementStatus
Requirement *─* RepositoryAsset through RequirementRepository
Requirement *─* ProjectMember through RequirementParticipant
Requirement 1─* WorkflowRun
```

`RequirementRepository` records how a repository participates, such as primary target, dependency, or read-only reference, together with branch or write-scope constraints. `RequirementParticipant` records responsibility such as requester, owner, contributor, reviewer, or approver.

Each `RepositoryAsset` stores a provider discriminator (`gitlab` or `github`) alongside its URL and default branch. Existing records migrate to `gitlab`. Provider-specific synchronization and delivery behavior stays behind source-control and delivery adapters.

People may appear in the product's Asset module, but the domain must not model a person as project-owned data. A person belongs to the organization; `ProjectMember` grants project context, and `RequirementParticipant` grants requirement context.

The first implementation persists these records in SQLite through the Nuxt server API. Database access remains behind a repository layer so a future PostgreSQL migration can preserve the same identities, constraints, and API contracts.

Requirement lifecycle states are project-owned records, not application enums. Each
`RequirementStatus` has a stable project-local key, display name, color, ordering,
and initial/terminal flags. A requirement stores `status_id`; status deletion is
rejected while requirements reference it. Projects start with six editable states:
Draft, Clarifying, Ready, In Progress, Validating, and Delivered. This design lets
each project evolve its workflow vocabulary without deploying application code.

## Integration Contract with GitLab

ASDP is expected to use GitLab OAuth or scoped project tokens, REST/GraphQL APIs, and signed webhooks. Relevant resources include projects, branches, commits, merge requests, pipelines, jobs, logs, artifacts, and environments. Webhook events enter ASDP's event processing layer and advance or suspend the associated workflow run.

Integration code must be isolated behind adapters. GitLab-specific payloads must not leak into core domain entities. Store external IDs and immutable event records so synchronization is idempotent and recoverable.

The current single-tenant preview provides one global GitLab connection. An operator configures the GitLab base URL and a scoped Personal Access Token; ASDP validates it through the GitLab user API before saving it. The token is encrypted with AES-256-GCM using `ASDP_CREDENTIAL_ENCRYPTION_KEY`, or a generated local key under `.data` for development. Read APIs return only connection metadata and a masked token hint. The browser never receives the saved token, and GitLab requests remain inside the server-side adapter.

Repository discovery uses this connection to list membership projects. Importing a result creates an ASDP `RepositoryAsset` with its GitLab project ID as `external_id`; it does not copy or replace the GitLab repository. The global credential is an initial operating model for local or controlled deployments. Organization-scoped ownership, administrator authorization, OAuth, token rotation policy, and per-project credentials remain required before a multi-tenant production release.

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
