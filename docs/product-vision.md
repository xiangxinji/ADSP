# ForgePilot Product Vision

## Product Identity

- **Name:** ForgePilot
- **Chinese name:** 铸航
- **Category:** Autonomous Software Delivery Platform（自主软件交付平台）
- **Tagline:** 从需求启航，让软件自主交付。

ForgePilot is an AI-native software engineering orchestration platform. A user states an outcome; ForgePilot turns it into an executable plan, coordinates AI agents to produce verified changes, and delegates delivery execution to established CI/CD systems.

## Product Goal

Create an end-to-end, policy-governed automation loop:

```text
Requirement
  → clarification and acceptance criteria
  → specification and architecture
  → execution plan and agent tasks
  → code, configuration, and documentation
  → automated quality checks
  → merge and delivery through GitLab CI
  → delivery status and operational feedback
  → diagnosis, correction, and continuous improvement
```

The target is not merely faster code generation. ForgePilot should make the complete engineering process observable, repeatable, traceable, and increasingly autonomous.

## Primary Capabilities

1. **Requirement Center** — capture natural-language goals, clarify ambiguity, and define acceptance criteria.
2. **Workflow Engine** — transform goals into dependency-aware, resumable execution graphs.
3. **Agent Orchestration** — assign architecture, implementation, review, testing, and diagnosis responsibilities.
4. **Execution Environments** — provide isolated workspaces with code, terminal, browser, and controlled credentials.
5. **Quality Gates** — coordinate tests, reviews, security checks, and policy decisions.
6. **Delivery Center** — connect workflow runs to commits, merge requests, pipelines, and environments.
7. **Governance** — manage permissions, approvals, audit history, cost, and model policies.
8. **Feedback Loop** — interpret pipeline or runtime failures and initiate repair workflows.

## Automation Principle

“Fully automated” means automation within explicit policies, not uncontrolled production access. Low-risk work may run unattended. Production releases, database migrations, permission changes, and other high-risk actions may require configurable approval. Every run must support pause, human takeover, retry, cancellation, and audit.

## Product Hierarchy

```text
Organization
├─ User
└─ Project
   ├─ Repository connection (GitLab or GitHub)
   ├─ Requirement
   │  └─ Workflow run
   │     ├─ Agent tasks
   │     ├─ Code and artifacts
   │     ├─ quality results
   │     └─ delivery references
   └─ Policies and environments
```

## Initial Product Entry

The first usable workflow starts from a project. A project is the context boundary for requirements, repositories, member roles, permissions, and workflow runs. User identities remain global. User Management provisions and resets user passwords; passwords are never displayed or returned by ForgePilot.

```text
Project workspace
├─ Assets
│  ├─ code repositories
│  ├─ project members selected from global users
│  ├─ development, testing, and production environments
│  └─ Markdown knowledge linked to project assets
├─ Workflow definitions
│  └─ root trigger, asset-operation nodes, exception paths, sync/async controls, and reusable workflow-call nodes
├─ Requirements
│  └─ referenced repositories and participants
├─ Workflow runs
└─ Delivery records
```

A project may contain multiple requirement versions, repositories, environment records, Markdown knowledge documents, reusable workflow definitions, and global users selected as project members with project-specific roles. Requirement versions are major-version lines displayed as `v{major}.x`; a requirement may target multiple version lines and the greatest configured major is always marked `latest`. Each repository selects either a multi-version branch strategy tied to those requirement versions or a development-production strategy limited to `dev` and `main`. Environments record an address, an optional note, a lifecycle type, and zero or more self-service test accounts whose passwords are optional. Any supplied non-sensitive test passwords are stored and displayed without masking; tokens, private keys, and production deployment credentials remain in CI/CD or the target infrastructure. Knowledge metadata is created in a focused form before its Markdown body is authored on a separate full-screen page. The live Milkdown editor preserves Markdown in the project database and renders stable project-asset references as editable inline controls. A requirement may reference multiple repositories and multiple project members. Assets and memberships are registered once at project level and reused across requirements and workflow definitions. A workflow definition describes a reusable trigger and asset-operation graph; it is not an execution record. A requirement represents business intent, and each execution attempt is a separate workflow run so failures and retries remain auditable.

Workflows can also call another saved workflow in the same project as a single node.
Each call waits for its child to finish, passes its upstream value into the child's
root, and forwards the child's final output. Operators can expand internal node states,
inputs, outputs, errors, and repeated invocations in the parent execution record.
Calls use immutable startup snapshots; cross-project and recursive calls are rejected.

Workflow composition is operation-first: workflow-ready operations appear as searchable
cards grouped by repository, member, environment, and knowledge, and can be dragged onto
the canvas without first selecting an asset. Every group includes a project-wide
"get all" operation whose output is an array of that group's asset model. These read-only
nodes always use the owning project and do not require or accept a single-asset binding.
New operation nodes take their asset identity from an input value by default, including
upstream or root output references. A fixed project asset is an optional per-node source.
Both modes preserve shared operation contracts and project ownership checks; input mode
does not grant access to another project's assets or accept unregistered repository URLs.

The current local preview has one global local-workspace directory. Repository working
copies are cloned into a project-specific `repositories/` child directory, while task
files and generated filesystem artifacts also stay beneath this operator-selected root.
Each project owns its filesystem namespace, so repository copies use
`<workspace>/projects/<project-id>/repositories/`. Additional Git worktrees use the
same project's `repositories/worktrees/` directory and are named
`<repository-name>_<branch-name>`. Every other project-owned filesystem operation is
likewise constrained to `<workspace>/projects/<project-id>/`. ForgePilot
validates the global directory before saving it; application data and encrypted
credentials remain separate control-plane state.

The current workflow preview supports explicit manual execution from the editor and
automatic execution after a project requirement is created or its status changes. Requirement creation stores
the requirement and a durable trigger event in one transaction. A single-process queue
then starts every ready `requirement-created` workflow in that project, using the created
requirement as its root value. Actual status transitions similarly enqueue
`requirement-status-changed` workflows with `requirementId`, `previousStatusId`, and
`statusId` as the immutable root. Saving an unchanged status or editing other requirement
fields does not trigger them. Each status-change trigger can listen to any destination
status or an explicit selection of one or more project statuses, including custom statuses.
The editor makes this choice explicit; an empty selection cannot be saved. Connected asset
commands execute in order within each path.
Sync and async nodes have one fixed execution port connected to one
child. They automatically repeat that child path for every element of the upstream array,
sequentially in array order or concurrently, respectively. Sync failure skips unstarted
elements; async waits for all elements. Empty arrays complete without child operations and
non-array inputs take the error outlet. Both control-node kinds can be nested and preserve
their original failures. Asset-operation nodes can add
exception ports selected from the operation contract's stable error codes and connect
each port to a handling child path. Successful commands follow only the normal outlet;
failed commands follow only the matching, connected exception outlet. A matching configured
port counts as handled even without a child, allowing explicit error suppression. Other paths are skipped.
Manual runs accept a JSON root value. Asset-operation inputs may read nested root fields with
`$root.xxx` or the previous value on their active path with `$prev.xxx`; resolved inputs and
typed contract outputs are retained in the run history. Control-node child paths receive
the current array element as `$prev`, so `$prev.id` addresses that item's asset without
manually configuring multiple ports. Each iteration retains independent inputs, outputs,
status, and errors, including when sync, async, and exception paths are nested.
The active node and each completed node's output or error are visible on a read-only run
snapshot, with historical attempts retained independently of later definition edits.
Failures without a matching handler stop their path without stopping independent async
siblings. Handled nodes display a distinct non-failing `handled` state and preserve the
original error for audit without failing the run. Sync iteration continues after handled
errors; only unhandled failures select a failing control result. Handler failures remain
failures unless explicitly caught in turn, and external mutations are never automatically repeated.
Queued requirement events survive server restarts. A trigger event and workflow pair has
at most one run, so recovery records interrupted work without replaying external mutations.
Other event types, cancellation, resume, approvals, and distributed scheduling are not enabled.

Requirement creation will eventually begin with a natural-language AI entry. ForgePilot will create a draft, derive acceptance criteria, recommend assets and participants, clarify missing information, and start execution according to project policy.

## Non-Goals

- Reimplementing Git repository hosting.
- Replacing GitLab CI runners or deployment engines.
- Holding production deployment credentials when CI or infrastructure systems can own them.
- Becoming a generic task-management product unrelated to autonomous software delivery.

## Open Product Decisions

- Whether the first release supports only ForgePilot-created repositories or existing company repositories as well.
- Which software outputs are supported first: web applications, backend services, mobile applications, or infrastructure.
- Which deployment target and source-control operating model should define each provider integration.
- Which actions are autonomous by default and which require approval.
