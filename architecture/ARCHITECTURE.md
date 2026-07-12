# CyberChurch Onchain – Data Architecture

## Data Model – Users & Sessions

```mermaid
erDiagram
    User {
        string id PK
        string walletAddress
        string email
        string displayName
        string status
        datetime createdAt
        datetime updatedAt
    }

    Session {
        string id PK
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
## Data Pipeline – Users & Sessions (Source → API → Firestore)

### 1. Comes out of (Source: Unity / Web3)

- Unity WebGL client and Web3 dashboard send:
  - Authenticated user context (userId, or ID token / session token).
  - Web3 wallet data (walletAddress) on sign-in.
  - Session-related data (sessionId, currentAgentId, userMessage) during conversations.
- No anonymous, unauthenticated writes are allowed to users or sessions.

### 2. Goes into (Processing: API / Routing Layer)

- API gateway validates:
  - Authentication (token valid, user active).
  - Basic schema of every request body (required fields present, types correct).
- Routing logic enforces:
  - `currentAgentId` must be one of: `peacemaker`, `integration_model`, `christian_psychology`, `biblical_counseling`.
  - `sessionId` must belong to the authenticated `userId` before reading/writing.
- No direct client writes to Firestore; all writes go through validated API endpoints.

### 3. Goes out of (Output: Firestore)

- Writes to `users/{userId}`:
  - Only via authenticated server logic (for profile updates, wallet binding, etc.).
  - Fields use standardized names: `walletAddress`, `status`, `createdAt`, `updatedAt`.
- Writes to `sessions/{sessionId}`:
  - Only via routing/API layer after validation.
  - Must always include `userId` (owner), `currentAgentId`, `status`, and timestamp updates.
- Firestore Security Rules (to be implemented) ensure:
  - A user can only read and modify their own `users/{userId}` and `sessions/{sessionId}` docs.
  - No client can write arbitrary documents or fields outside the standardized schema.