# Jira & Git Workflow Rules

## 1. Branch Naming & Mapping Standard

- **Base Integration Branch**: `development` is the primary integration branch for all ongoing feature work.
- **Feature Branch Naming Convention**: Strictly follow `<Ticket-No>-<Branch-Name>`
  - Backend project tickets use `ESB-<Number>-<Description>` (e.g., `ESB-13-Implement-Assets-Management-Feature`, `ESB-11-Implement-User-Facing-Public-APIs`).
  - Frontend project tickets use `ESF-<Number>-<Description>` (e.g., `ESF-21-Implement-Assets-Management-Feature`, `ESF-19-Implement-Public-APIs-To-Serve-Feeds`).
- **Branch Creation**:
  - Feature branches MUST always be cut from an up-to-date `development` branch (`git checkout development && git pull && git checkout -b <Ticket-No>-<Branch-Name>`).
  - Never commit directly to `development` or production branches.

---

## 2. Jira Ticket Lifecycle & Status Transitions

- **Starting Work**:
  - Identify the target Jira ticket (or create one under the relevant project key `ESB` or `ESF`).
  - Transition the Jira issue to **In Progress** before beginning code changes.
  - Create the corresponding feature branch `<Ticket-No>-<Branch-Name>` from `development`.
- **During Implementation**:
  - Keep commits clean and descriptive.
  - Maintain documentation per `documentation-maintenance.md`.
- **Completing Work**:
  1. Verify automated tests pass (`npm test` / test runners).
  2. Verify build succeeds cleanly (`npm run build`).
  3. Merge feature branch into `development`.
  4. Post a structured completion comment to the Jira ticket.
  5. Transition the Jira ticket to **Done** (Closed).

---

## 3. Jira Commenting Standards

Every closed ticket must have a comprehensive completion comment containing:

1. **Feature & Architectural Summary**: Overview of what was implemented adhering to repository architecture (Route -> Controller -> Service -> Repo in backend; Route -> Component -> Hook -> Store -> API Service in frontend).
2. **Key Capabilities & Endpoints**: Specific routes, UI components, database models, or configurations added/modified.
3. **Verification & Quality Assurance**: Test suite execution results, build validation, and confirmation of zero errors.
4. **Git Delivery Information**: Merged feature branch name and target branch (`development`).
