# Project Routes API Reference

## Base Path
```
/api/projects
```

## Route Organization

Routes are organized by authentication requirement and execution order:

1. **Public routes** (no auth, defined first to avoid parameter collision)
2. **Protected routes** (require authentication, then by HTTP method)

## Public Routes

### Check Subdomain Availability
```
GET /api/projects/subdomain-available/:subdomain
```

**Purpose:** Check if a subdomain is available for a new project (rate-limited)

**Response:**
```json
{
  "success": true,
  "data": {
    "subdomain": "my-project",
    "available": true,
    "message": "Subdomain is available"
  }
}
```

### Get Project by Subdomain
```
GET /api/projects/by-subdomain/:subdomain
```

**Purpose:** Public lookup to get project info by subdomain

**Response:**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": 1,
      "name": "My Project",
      "subdomain": "my-project",
      "description": "Project description",
      "workspaceId": 5,
      "createdAt": "2026-03-22T10:00:00Z"
    }
  }
}
```

## Protected Routes (Require Authentication)

### Create Project
```
POST /api/projects
```

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "workspaceId": 5,
  "name": "My Project",
  "subdomain": "my-project",
  "description": "Optional project description"
}
```

**Behavior:**
- User must be workspace member
- Auto-adds OWNER/ADMIN workspace members with default roles
- Creates ProjectMember + ProjectMemberRole entries

**Response:**
```json
{
  "success": true,
  "data": {
    "projectId": 42
  },
  "statusCode": 201
}
```

### List Workspace Projects
```
GET /api/projects/workspaces/:workspaceId/projects
```

**Headers:** `Authorization: Bearer <token>`

**Authorization:**
- OWNER: sees all projects
- ADMIN: sees all projects
- USER: sees only explicitly assigned projects

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 42,
        "name": "My Project",
        "description": "Description",
        "createdAt": "2026-03-22T10:00:00Z",
        "updatedAt": "2026-03-22T10:00:00Z"
      }
    ],
    "total": 1,
    "workspaceId": "5"
  }
}
```

### Get Project Details
```
GET /api/projects/:projectId
```

**Headers:** `Authorization: Bearer <token>`

**Authorization:** Must be project member with valid project roles

**Response:**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": 42,
      "name": "My Project",
      "description": "Description",
      "workspaceId": 5,
      "createdAt": "2026-03-22T10:00:00Z",
      "updatedAt": "2026-03-22T10:00:00Z"
    }
  }
}
```

### Update Project (Full Replacement)
```
PUT /api/projects/:projectId
```

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "Updated Name",
  "subdomain": "updated-subdomain",
  "description": "Updated description"
}
```

**Authorization:** Must be workspace member with access

**Validation:**
- `name` required
- `subdomain` required and must be unique
- `subdomain` can only contain alphanumeric, hyphens, underscores

**Response:**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": 42,
      "name": "Updated Name",
      "subdomain": "updated-subdomain",
      "description": "Updated description",
      "workspaceId": 5,
      "createdAt": "2026-03-22T10:00:00Z",
      "updatedAt": "2026-03-22T11:00:00Z"
    }
  }
}
```

### Update Project (Partial)
```
PATCH /api/projects/:projectId
```

**Headers:** `Authorization: Bearer <token>`

**Body:** (at least one field required)
```json
{
  "name": "New Name",
  "description": "New description"
}
```

**Response:** Same as PUT

### Delete Project
```
DELETE /api/projects/:projectId
```

**Headers:** `Authorization: Bearer <token>`

**Authorization:** Must be workspace member with access

**Cascade Deletes:**
- All ProjectMember records
- All ProjectMemberRole records
- All project content/data

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Project deleted successfully"
  }
}
```

### Get Project Members
```
GET /api/projects/:projectId/members
```

**Headers:** `Authorization: Bearer <token>`

**Authorization:** Must be workspace member

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "userId": "123",
        "assignedAt": "2026-03-22T10:00:00Z",
        "roles": ["EDITOR", "PUBLISHER"]
      }
    ],
    "total": 1
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "name is required",
    "code": "BAD_REQUEST",
    "statusCode": 400,
    "requestId": "abc-123"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Unauthorized",
    "code": "UNAUTHORIZED",
    "statusCode": 401,
    "requestId": "abc-123"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "message": "You do not have access to this project",
    "code": "FORBIDDEN",
    "statusCode": 403,
    "requestId": "abc-123"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Project not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "requestId": "abc-123"
  }
}
```

## Route Order & Priority

The router processes routes in definition order. **Public routes must come before parameterized routes:**

```
✅ CORRECT ORDER:
1. GET /subdomain-available/:subdomain  (public, specific)
2. GET /by-subdomain/:subdomain         (public, specific)
3. POST /                               (protected, collection)
4. GET /workspaces/:workspaceId/...     (protected, nested)
5. GET /:projectId                      (protected, parameterized, catches last)

❌ WRONG ORDER:
1. GET /:projectId                      ← catches everything, breaks public routes!
2. GET /subdomain-available/:subdomain  ← never reached
```

## Authorization Flows

### Create Project
```
1. Verify user is authenticated
2. Verify user is workspace member
3. Create project
4. Auto-add OWNER/ADMIN workspace members with default roles
5. Return projectId
```

### List Projects
```
1. Verify user is authenticated
2. Get visible project IDs via authorizationService.getVisibleProjectIds()
3. OWNER/ADMIN: see all projects
4. USER: see only explicitly assigned projects
5. Return filtered list
```

### Get Project
```
1. Verify user is authenticated
2. Check workspace membership
3. Check project membership
4. Verify project roles exist
5. Return project details
```

---

**Last Updated:** March 22, 2026
**Controllers Used:** `projects.controller.ts`, `get-projects.controller.ts`
**Service:** `ProjectService`
