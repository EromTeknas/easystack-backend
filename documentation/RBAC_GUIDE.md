# EasyStack RBAC

EasyStack uses a hierarchical Role-Based Access Control (RBAC) model with two levels:

1. **Workspace Role** — controls a user's capabilities within the workspace.
2. **Project Role** — controls a user's permissions within an individual project.

A project always belongs to a workspace.

The authorization model is designed around the following principle:

> **Workspace role determines what a user can do at the workspace level, while project role determines what they can do inside a project.**

---

# 1. Roles

## Workspace Roles

| Role    | Description                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------ |
| `OWNER` | Full control over the workspace. Can create and manage projects, members, settings, and billing. |
| `ADMIN` | Administrative workspace access. Can create projects and manage workspace/project access.        |
| `USER`  | Regular workspace member. Cannot create projects and must be explicitly granted project access.  |

## Project Roles

| Role          | Description                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `OWNER`       | Full control over the project. Automatically assigned to the workspace ADMIN who creates the project. |
| `ADMIN`       | Administrative access to the project.                                                                 |
| `EDITOR`      | Can modify project content and configuration allowed for editors.                                     |
| `CONTRIBUTOR` | Can contribute content but has limited configuration permissions.                                     |
| `VIEWER`      | Read-only access to the project.                                                                      |

---

# 2. Project Creation

Only the following workspace roles can create projects:

```text
Workspace OWNER
Workspace ADMIN
```

A workspace `USER` cannot create projects.

## Project Creator Becomes Project OWNER

When an `ADMIN` creates a project, that user automatically becomes the:

```text
Project Role = OWNER
```

Example:

```text
Workspace
│
├── Sanket
│     Workspace Role = OWNER
│
├── Rahul
│     Workspace Role = ADMIN
│
└── Project A
      Owner = Rahul
```

Rahul is the `OWNER` of Project A because Rahul created it.

---

# 3. Workspace OWNER Behavior

The workspace `OWNER` has full administrative access to the workspace and all projects.

The workspace owner is effectively an `ADMIN` across every project.

```text
Workspace OWNER
       │
       ├── Project A → ADMIN
       ├── Project B → ADMIN
       ├── Project C → ADMIN
       └── Project D → ADMIN
```

The workspace owner does **not** need to be explicitly added to every project.

### Important

The workspace `OWNER` is not automatically the `OWNER` of every project.

Project ownership belongs to the user who created the project.

Example:

```text
Workspace OWNER = Sanket

Project A created by Rahul
Project B created by Amit
```

Effective project roles:

```text
Sanket
Project A → ADMIN
Project B → ADMIN

Rahul
Project A → OWNER

Amit
Project B → OWNER
```

This allows project ownership to remain associated with the project creator while the workspace owner retains administrative control.

---

# 4. Workspace ADMIN Behavior

A workspace `ADMIN` automatically has access to **all projects**.

The default project role for an ADMIN is:

```text
ADMIN
```

However, when an ADMIN creates a project, they become the:

```text
OWNER
```

of that project.

Example:

```text
Workspace Role: ADMIN

Project A → ADMIN
Project B → ADMIN
Project C → OWNER
```

If the user created Project C, Project C is the only project where their effective role is `OWNER`.

The ADMIN still has administrative access to all other projects.

---

# 5. Workspace USER Behavior

A workspace `USER`:

* Cannot create projects.
* Does not automatically have access to projects.
* Must be explicitly assigned to projects.
* Receives `VIEWER` by default when assigned to a project.
* Can be assigned a higher project role if authorized by the inviter.

Example:

```text
Workspace Role: USER

Project A → VIEWER
Project B → EDITOR
Project C → No Access
Project D → CONTRIBUTOR
```

---

# 6. Inviting a User

When inviting a user to a workspace, the inviter selects the workspace role:

```text
Invite User
────────────────────

Email:
user@example.com

Workspace Role:

○ ADMIN
○ USER
```

Project access is then determined by the selected workspace role.

---

# 7. Inviting as ADMIN

When a user is invited as:

```text
Workspace Role = ADMIN
```

they automatically receive access to every project.

Their default project role is:

```text
ADMIN
```

Example:

```text
Project A → ADMIN
Project B → ADMIN
Project C → ADMIN
Project D → ADMIN
```

The inviter does **not** need to select individual projects.

### Why?

Because workspace ADMINs are project administrators by default.

However, project ownership remains tied to the project creator.

For example:

```text
Rahul = Workspace ADMIN

Rahul creates Project A
    ↓
Rahul = Project OWNER

Existing projects:
Project B → ADMIN
Project C → ADMIN
Project D → ADMIN
```

---

# 8. Inviting as USER

When a user is invited as:

```text
Workspace Role = USER
```

they do not automatically receive project access.

The inviter must select the projects the user can access.

Example:

```text
Workspace Role: USER

Project Access
────────────────────────

☑ Website       VIEWER
☑ Mobile App    EDITOR
☐ Content       No Access
☑ Analytics     CONTRIBUTOR
```

If a project is selected without a specific role, the default is:

```text
VIEWER
```

---

# 9. Effective Project Role

The authorization engine should resolve the effective project role using the following rules.

## Workspace OWNER

```text
Workspace OWNER
       │
       ▼
ADMIN on every project
```

The workspace owner does not require a project membership record.

---

## Workspace ADMIN

```text
Workspace ADMIN
       │
       ├── Created the project
       │       │
       │       └── OWNER
       │
       └── Did not create the project
               │
               └── ADMIN
```

Therefore:

```text
Admin + Project Creator
        = Project OWNER

Admin + Not Project Creator
        = Project ADMIN
```

---

## Workspace USER

```text
Workspace USER
       │
       ├── Explicit Project Membership
       │       │
       │       └── Assigned Project Role
       │
       └── No Project Membership
               │
               └── NO ACCESS
```

---

# 10. Effective Role Resolution

Conceptually:

```text
resolveProjectRole(user, workspace, project)
```

should behave as follows:

```text
IF user is Workspace OWNER
    RETURN PROJECT ADMIN

ELSE IF user is Workspace ADMIN
    IF user.createdProject(project)
        RETURN PROJECT OWNER
    ELSE
        RETURN PROJECT ADMIN

ELSE IF user is Workspace USER
    IF project membership exists
        RETURN assigned project role
    ELSE
        RETURN NO ACCESS
```

This means the hierarchy is:

```text
Workspace OWNER
        │
        └── Project ADMIN

Workspace ADMIN
        │
        ├── Project OWNER
        │     └── If they created the project
        │
        └── Project ADMIN
              └── All other projects

Workspace USER
        │
        └── Explicit Project Role
```

---

# 11. Project Ownership

Project ownership is automatically determined at project creation time.

When an ADMIN creates a project:

```text
Project
├── createdBy = userId
└── owner = creator
```

The creator becomes the project `OWNER`.

Example:

```text
Workspace
│
├── Sanket
│   Workspace Role: OWNER
│
├── Rahul
│   Workspace Role: ADMIN
│
└── Amit
    Workspace Role: ADMIN
```

Projects:

```text
Project A
createdBy = Rahul
owner = Rahul

Project B
createdBy = Amit
owner = Amit
```

Effective roles:

```text
              Project A       Project B

Sanket        ADMIN           ADMIN
Rahul         OWNER           ADMIN
Amit          ADMIN           OWNER
```

---

# 12. Project Ownership vs Workspace Ownership

These are intentionally separate concepts.

### Workspace OWNER

Controls the entire workspace.

```text
Workspace OWNER
    │
    ├── Members
    ├── Projects
    ├── Billing
    ├── Settings
    └── Project Administration
```

### Project OWNER

Controls a specific project.

```text
Project OWNER
    │
    ├── Project settings
    ├── Project members
    ├── Project configuration
    └── Project resources
```

A workspace owner can therefore manage a project without being its project owner.

---

# 13. Access Matrix

| Workspace Role | Can Create Project | Existing Projects   | Projects Created by User | Default Project Access |
| -------------- | -----------------: | ------------------- | ------------------------ | ---------------------- |
| `OWNER`        |                Yes | `ADMIN`             | `ADMIN`                  | All projects           |
| `ADMIN`        |                Yes | `ADMIN`             | `OWNER`                  | All projects           |
| `USER`         |                 No | Explicit assignment | N/A                      | No access              |

For `USER`, project assignments determine the actual project role:

| Workspace Role | Project Assignment        | Effective Project Role |
| -------------- | ------------------------- | ---------------------- |
| `USER`         | None                      | No Access              |
| `USER`         | Assigned without role     | `VIEWER`               |
| `USER`         | Assigned as `VIEWER`      | `VIEWER`               |
| `USER`         | Assigned as `CONTRIBUTOR` | `CONTRIBUTOR`          |
| `USER`         | Assigned as `EDITOR`      | `EDITOR`               |
| `USER`         | Assigned as `ADMIN`       | `ADMIN`                |

---

# 14. Role Assignment Rules

The backend must enforce role assignment.

A user should only be able to grant roles they are authorized to grant.

For example:

```text
Workspace OWNER
    ↓
Can manage all workspace/project roles

Workspace ADMIN
    ↓
Can manage project access
    ↓
Cannot change Workspace OWNER
```

A regular workspace `USER` cannot manage workspace membership or assign project roles to other users unless explicitly granted a future permission that allows it.

---

# 15. Recommended Database Model

Workspace membership:

```text
WorkspaceMember
────────────────────
id
workspaceId
userId
role
createdAt
updatedAt
```

Project:

```text
Project
────────────────────
id
workspaceId
name
createdBy
createdAt
updatedAt
```

Project membership:

```text
ProjectMember
────────────────────
id
projectId
userId
role
createdAt
updatedAt
```

The project creator can be represented as the project owner.

For example:

```text
Project
    createdBy = Rahul

ProjectMember
    user = Rahul
    role = OWNER
```

Alternatively, `createdBy` can remain the source of truth for ownership and the project membership table can contain only explicit additional memberships.

The important part is that **project ownership must be deterministic and cannot accidentally be changed merely because the user's workspace role changes.**

---

# 16. Recommended Authorization Architecture

The authorization engine should separate:

### Workspace Permissions

```text
workspace.read
workspace.update
workspace.delete

workspace.members.read
workspace.members.invite
workspace.members.update
workspace.members.remove

workspace.projects.create
workspace.projects.read
workspace.projects.update
workspace.projects.delete
```

### Project Permissions

```text
project.read
project.update
project.delete

project.members.read
project.members.invite
project.members.update
project.members.remove
```

The effective permissions are then derived from the user's workspace role and project role.

---

# 17. Final RBAC Model

The EasyStack authorization hierarchy is:

```text
                        WORKSPACE
                            │
             ┌──────────────┼──────────────┐
             │              │              │
           OWNER          ADMIN           USER
             │              │              │
             │              │              │
        All Projects    All Projects    Selected Projects
             │              │              │
             ▼              ▼              ▼
           ADMIN       ADMIN / OWNER     Assigned Role
                            │
                            │
                  ┌─────────┴─────────┐
                  │                   │
             Created Project      Other Project
                  │                   │
                  ▼                   ▼
                OWNER               ADMIN
```

## Core Rules

1. **Only Workspace OWNER and ADMIN can create projects.**
2. **The user who creates a project becomes its Project OWNER.**
3. **Workspace OWNER has ADMIN access to every project.**
4. **Workspace ADMIN has ADMIN access to every project.**
5. **A Workspace ADMIN is OWNER only of projects they created.**
6. **Workspace USER cannot create projects.**
7. **Workspace USER has no project access by default.**
8. **Workspace USER must be explicitly assigned to projects.**
9. **USER project assignments default to VIEWER.**
10. **Explicit project roles override the default role.**
11. **Workspace ownership and project ownership are separate concepts.**
12. **Changing a user's workspace role must not silently change project ownership.**

This provides EasyStack with a simple mental model:

> **OWNER/ADMIN can create projects. The creator owns the project. Workspace ADMINs manage all projects. Regular USERS only get access to projects explicitly assigned to them.**
