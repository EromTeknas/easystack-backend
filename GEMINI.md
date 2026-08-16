# Easystack Backend Architecture Rules

This project enforces a strict **Route -> Controller -> Service -> Repo** pattern. Whenever you are adding new features, endpoints, or modifying existing ones, you MUST adhere to the following structure and guidelines.

## 1. Architectural Layers

*   **Route**: Defines the API endpoints. This layer is responsible for routing the HTTP request to the appropriate controller.
    *   **Middlewares**: Apply middlewares at the route level. The following middlewares should be used accordingly:
        *   `authenticate`: Use to ensure the user is authenticated.
        *   `authorize`: Use to check if the user has the required permissions/roles.
        *   `billingMiddleware`: Use to verify billing status or subscription limits.
*   **Controller**: Handles the incoming HTTP request and returns the response. It extracts parameters/body from the request, passes them to the Service layer, and formats the Service's output into an HTTP response. **No business logic** should exist here.
*   **Service**: Contains all the core business logic. It orchestrates operations, applies business rules, and calls the Repo layer for data access.
*   **Repo (Repository)**: Handles all data persistence and retrieval. It acts as the interface to the database.

## 2. Infrastructure & Tools

*   **Prisma**: Used as the ORM. If new entities, tables, or fields are required for a feature, update the Prisma schema accordingly.
*   **Redis**: Available for caching or key-value storage. Use it where performance optimizations or temporary data storage is needed.

## 3. Enforcement

*   Never skip a layer (e.g., a Controller should not call a Repo directly).
*   Keep files within their respective domain folders or layer folders as per the existing `src` structure.
