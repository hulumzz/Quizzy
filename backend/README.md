# Quizzy class, material, and discussion backend

This directory contains the authenticated class, learning-material, and contextual-discussion vertical slices:

```text
Firebase ID token
→ Lambda Function URL
→ class, material, and discussion handlers
→ DynamoDB
```

No AWS resource is created by installing dependencies, running tests, or running `sam build`.

## Security model

- The browser sends `Authorization: Bearer <Firebase ID token>`.
- Lambda verifies the signature against Google's published Firebase certificates and validates `alg`, `kid`, `exp`, `iat`, `auth_time`, `aud`, `iss`, and `sub`.
- The class owner always comes from the verified token subject. `ownerId`, `teacherId`, or role values from the request body are ignored.
- Anonymous Firebase accounts may list an empty scope but cannot create or join classes.
- Class overview requires the caller to be the owner or a stored member. The member roster is owner-only.
- Join writes the class membership, user membership lookup, and member count in one DynamoDB transaction. Repeated join requests return the existing membership without incrementing the count again.
- Material create, update, and soft-delete operations are owner-only. Students can only list and read published material in a class they joined.
- Progress and bookmarks are stored under the verified student identity. Teachers cannot write student learning state through these routes.
- Material content is bounded to 60 validated blocks and approximately 70 KB after normalization. Image/file attachments are HTTPS references only; this slice does not accept binary uploads.
- Discussion access inherits material access. Students cannot open discussions for drafts or classes they have not joined.
- Message authors can edit or soft-delete only their own content. Only the class owner can resolve a thread or select an answer.
- Discussion content is bounded to 3,000 characters, and user identity, display name, and teacher markers are derived from the verified token and stored class access rather than request claims.
- The current open-community rule allows any non-anonymous Firebase account to create its own class. The UI role is not treated as an authorization claim; institution-verified teacher roles would require trusted custom claims or a server-owned approval flow later.
- Function URL CORS must contain exact frontend origins. Do not deploy with `*`.
- The Function URL uses public AWS invocation because browsers do not have AWS credentials; application access remains protected by Firebase bearer verification.
- Reserved concurrency is capped at five executions and writable request bodies are bounded to reduce accidental or abusive spend.

## API routes

All routes require a valid Firebase bearer token.

```text
GET  /classes?scope=owned
GET  /classes?scope=joined
POST /classes
POST /classes/join
GET  /classes/:classId
GET  /classes/:classId/members
GET  /classes/:classId/materials
POST /classes/:classId/materials
GET  /classes/:classId/materials/:materialId
PUT  /classes/:classId/materials/:materialId
DELETE /classes/:classId/materials/:materialId
PUT  /classes/:classId/materials/:materialId/progress
PUT  /classes/:classId/materials/:materialId/bookmark
DELETE /classes/:classId/materials/:materialId/bookmark
GET  /learning/bookmarks
GET  /learning/progress
GET  /classes/:classId/materials/:materialId/discussions
POST /classes/:classId/materials/:materialId/discussions
PUT  /classes/:classId/materials/:materialId/discussions/:discussionId
DELETE /classes/:classId/materials/:materialId/discussions/:discussionId
POST /classes/:classId/materials/:materialId/discussions/:discussionId/replies
PUT  /classes/:classId/materials/:materialId/discussions/:discussionId/replies/:replyId
DELETE /classes/:classId/materials/:materialId/discussions/:discussionId/replies/:replyId
PUT  /classes/:classId/materials/:materialId/discussions/:discussionId/status
```

`POST /classes/join` accepts `{ "code": "ABC234" }`. Clients should send a UUID-like `x-idempotency-key`; the server also checks the existing membership so retries do not add a student twice.

Material writes accept `{ "title", "summary", "status", "blocks" }`. Supported initial block types are `paragraph`, `heading`, `bullet_list`, `numbered_list`, `quote`, `divider`, `link`, `youtube`, `image`, and `file`. Progress writes accept `{ "percent": 0..100 }`.

Discussion and reply writes accept `{ "content" }`. Status writes accept `{ "status": "open" | "resolved", "answerId": null | "<replyId>" }`; only the class owner can call the status route.

## Local checks

```powershell
cd backend
npm.cmd install
npm.cmd test
npm.cmd run check
```

If AWS SAM CLI is installed:

```powershell
npm.cmd run sam:validate
npm.cmd run sam:build
```

## Deployment preparation

Before any deployment:

1. Confirm account-specific AWS Free Tier eligibility and regional Function URL support.
2. Create billing and Free Tier usage alerts.
3. Choose the exact deployment region.
4. Pass the real Firebase project ID and exact Cloudflare Pages origin to SAM.
5. Review the generated CloudFormation change set before applying it.
6. Put the resulting `ClassesFunctionUrl` output into frontend `VITE_API_URL`.

Example build/deploy commands are intentionally not automated because deployment creates billable cloud resources and requires an explicit owner decision.
