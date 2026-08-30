# Requirements and Assets — Initial Functional Scope

## Goal

Deliver the first usable ASDP project workspace. Users enter a project, manage requirements, maintain project-level code repositories and people, and reference those assets from each requirement.

This iteration includes a Nuxt server API and SQLite persistence. The browser accesses domain data only through the API. A global encrypted GitLab connection supports identity validation, repository discovery, and importing repository metadata; authentication, webhooks, and bidirectional GitLab synchronization are not yet included.

## Domain Rules

- A project contains many requirements, repository assets, and project members.
- A requirement may reference zero or more repositories and people.
- A project owns its requirement-status records; every requirement references one status.
- Status keys are project-local and unique. Exactly one status is designated as the initial status.
- Referenced statuses cannot be deleted until their requirements are reassigned.
- Repositories and people must belong to the same project as the requirement.
- Asset references use stable IDs rather than copied names.
- Removing an asset also removes its references from existing requirements.
- A person is organization-owned in the future domain model; the prototype stores a project member record locally.
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
- Reference multiple repositories and multiple project members.
- Display referenced assets on the requirement list and editor.

### Asset Management

- Create, edit, and remove repository assets with hosting provider (GitLab or GitHub), name, URL, and default branch.
- Create, edit, and remove people with name, email, and project role.
- Show where an asset is referenced before deletion.

## Acceptance Criteria

1. A newly created project can be opened immediately.
2. Repository and person records are stored in SQLite and remain after a server restart.
3. A requirement can reference more than one repository and person.
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
