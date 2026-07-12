# CyberChurch Onchain – Data Architecture

## Data Model – Users & Sessions

```mermaid
erDiagram
    User {
        string userId PK
        string walletAddress
        string email
        string displayName
        string currentAgentId
        string status
        datetime createdAt
        datetime updatedAt
    }

    Session {
        string sessionId PK
        string userId FK
        string currentAgentId
        string status
        string lastMessage
        datetime createdAt
        datetime updatedAt
    }

    %% Relationships
    User ||--o{ Session : "has many sessions"}
```

## Pipeline Governance – Source → API → Firestore

### Tier 1 – Source (Unity / Web3)

- Unity 3D WebGL frames and Web3 dashboard act only as interface layers.
- Frontend never writes directly to Firestore.
- All stateful actions are converted into standardized JSON requests to the API, including:
  - `userId` (from authenticated context),
  - `sessionId` (if an active session exists),
  - `currentAgentId`,
  - `userMessage`.

### Tier 2 – Stateless Middleware API

- Acts as the **exclusive write gatekeeper** to Firestore.
- For every state-changing request, the API must:
  - Validate the caller's authentication token.
  - Verify that the `userId` in the request matches the authenticated user.
  - Verify that any `sessionId` belongs to that `userId` before modifying it.
  - Enforce allowed values for `currentAgentId` and `status`.
- API is stateless: it does not keep in-memory user/session state between calls; all state lives in Firestore.

### Tier 3 – Persistence & Settlement (Firestore)

- All writes go through the API; there are **no** client-side direct writes to `users` or `sessions`.
- Every document write (create/update) must update both `createdAt` (on create) and `updatedAt` (on every change) to keep audit metadata synchronized.
- Firestore Security Rules (to be implemented) will:
  - Block unauthenticated access.
  - Restrict reads/writes so a user can only access documents where `userId` matches their identity.
  - Prepare for future integration with immutable settlement hooks (e.g., Base L2).