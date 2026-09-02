# Requirements and Assets — Initial Functional Scope

## Goal

Deliver the first usable ForgePilot project workspace. Users enter a project, manage requirements, maintain project-level code repositories, memberships, environments, and Markdown knowledge, and reference applicable assets from each requirement or knowledge document.

This iteration includes a Nuxt server API and SQLite persistence. The browser accesses domain data only through the API. A global encrypted GitLab connection supports identity validation, repository discovery, and importing repository metadata; authentication, webhooks, and bidirectional GitLab synchronization are not yet included.

## Domain Rules

- A project contains many requirements, repository assets, project members, and environment assets.
- A project contains many knowledge assets whose title and Markdown content are persisted in SQLite.
- Knowledge Markdown may reference repositories, project members, environments, or other knowledge through `[[asset type：record id]]` tokens.
- Knowledge references resolve only within the owning project. Missing, deleted, unknown, or cross-project targets remain in the Markdown and are reported as unresolved.
- An environment has one HTTP(S) address, an optional note, one lifecycle type (`development`, `testing`, or `production`), and zero or more test accounts with optional passwords.
- Environment account passwords are for non-sensitive, self-service test accounts and are stored and displayed without masking. Tokens, private keys, and production deployment credentials are not accepted.
- A requirement may reference zero or more repositories and project members.
- A project owns major requirement versions, and a requirement may reference zero or more versions.
- Users enter only a non-negative major number; the display is always `v{major}.x` and the greatest major is `latest`.
- A project owns its requirement-status records; every requirement references one status.
- Status keys are project-local and unique. Exactly one status is designated as the initial status.
- Referenced statuses cannot be deleted until their requirements are reassigned.
- Repositories and project memberships must belong to the same project as the requirement.
- Each repository uses either the `multi-version` branch strategy or the `development-production` strategy, defaulting to `multi-version`.
- Under `multi-version`, `main` / `test` represent the `latest` release / test branches and `vN.x` / `vN.x-test` represent the corresponding requirement version's release / test branches.
- Under `development-production`, the repository uses only `dev` and `main` as its development and production branches.
- Asset references use stable IDs rather than copied names.
- Removing an asset also removes its references from existing requirements.
- A user is global and does not belong to a project. A project member selects one global user and stores a project-specific role.
- Requirements and workflow runs are different objects. Workflow runs are outside this iteration.

## Required Screens and Actions

### Project Entry

- View projects.
- Create a project with name and description.
- Enter a project workspace.

### Requirement Management

- List requirements by title, status, priority, and update time.
- Create, edit, and delete requirements.
- Maintain description and acceptance criteria.
- Assign a lifecycle status maintained by the current project.
- Create and edit statuses with a key, name, color, order, and initial/terminal flags.
- Delete only unused, non-initial statuses.
- Create, edit, and delete unused major versions from requirement management.
- Reference multiple versions and display the derived `latest` label.
- Reference multiple repositories and multiple project members.
- Display referenced assets on the requirement list and editor.

### Asset Management

- Create, edit, and remove repository assets with hosting provider (GitLab or GitHub), version branch strategy, name, note, and URL; query provider-owned default-branch metadata when needed instead of persisting it.
- Add project members by selecting global users, edit their project roles, and remove their memberships.
- Create, edit, and remove development, testing, and production environments with an HTTP(S) address, an optional note, and optional test accounts whose passwords may be empty.
- Create, edit, and remove knowledge assets with a title and Markdown body.
- Insert and display knowledge references to repositories, project members, environments, and other knowledge.
- Show where an asset is referenced before deletion.
- Show the configured operations inside every asset submodule and drive record-level
  action labels, icons, and behavior from the shared asset-operation registry.
- Mark server commands that can be reused by workflow definitions with stable operation
  IDs; keep client-only management actions out of workflow execution.

## Acceptance Criteria

1. A newly created project can be opened immediately.
2. Repository and project membership records are stored in SQLite and remain after a server restart.
3. A requirement can reference more than one repository and project member.
4. Editing a requirement preserves its existing asset references.
5. Deleting a referenced asset leaves no broken labels or IDs in requirements.
6. An empty project provides clear actions for adding its first requirement or asset.
7. The application passes `npm run build`.
8. API validation rejects references to assets outside the requirement's project.
9. Existing enum-based requirement statuses migrate to status records without data loss.
10. API validation rejects a requirement status from another project.
11. Existing repository records migrate to the GitLab provider, and new records can select GitLab or GitHub.
12. A saved GitLab Token is encrypted at rest, never returned to the browser, and can list repositories visible to its identity.
13. A GitLab repository can be selected from the project asset dialog and stored with its external project ID.
14. Project members are selected from global users and store only a project-specific role.
15. Existing project people migrate to global users, project memberships, and requirement-member references without data loss.
16. Environment records and all of their account-and-password pairs remain after a server restart.
17. Environment addresses reject unsupported protocols or embedded credentials.
18. Removing an environment cascades its account records without affecting other project assets.
19. A repository note can be recorded, edited, displayed in the asset list, and preserved after a server restart.
20. Manual repository registration accepts no external project ID and does not require global GitLab settings.
21. Repository branch strategy accepts only `multi-version` or `development-production`, defaults historical and new omitted values to `multi-version`, and remains editable.
21. Knowledge titles and Markdown content remain available after a server restart.
22. `[[asset type：record id]]` tokens resolve only to supported assets in the same project.
23. Deleting a referenced asset preserves the authored Markdown and marks that reference as unresolved.
24. The knowledge editor can insert valid reference tokens without requiring users to copy record IDs manually.
25. A requirement can reference multiple project-local major versions stored as comma-separated stable IDs.
26. Version names always render as `v{major}.x`, and exactly the greatest configured major is marked `latest`.
27. API validation rejects version IDs from another project and prevents deletion while referenced.
28. Environments can be stored without test accounts; account passwords are optional and, when supplied, are stored and returned as clear text for self-service test use, while existing account-only records migrate with an empty password.
29. An environment note can be recorded, edited, displayed in the asset list, and preserved after a server restart; existing environment rows migrate with an empty note.
30. Every asset submodule displays its configured operation catalog, and record actions
    use the same configuration rather than hard-coded labels and icons.
31. `repository.clone` and `repository.update` execute through the generic asset-operation
    service and are marked workflow-ready; client-only operations are rejected by the
    server execution endpoint.
32. `repository.local-clone-status` reports whether the fixed project-local clone path is
    a Git working copy with an `origin` matching the repository asset, and
    `repository.create-worktree` creates a worktree for an existing supplied branch under
    `repositories/worktrees/<repository-name>_<branch-name>` without overwriting a path.
