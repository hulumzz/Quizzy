# Quizzy Architecture Status

Last updated: 23 September 2026
Audited baseline: `4bdef7d` (`feat: add live quiz and secure Groq worker`)
Current implementation branch: `main`

## Executive status

Quizzy is no longer a prototype-only LMS. The current repository contains complete vertical slices for authentication, classes, materials, discussions, attendance, self-paced quizzes, Cloudinary uploads, the first live-quiz runtime, and an authenticated AI gateway.

The project is suitable for controlled end-to-end beta verification, but the latest live-quiz and AI changes must not yet be treated as production-complete. The main remaining work is deployment verification, live-load capacity, observability, automated regression coverage, and the product modules that are still intentionally planned rather than implemented.

## Current architecture

```text
React + Vite frontend
├─ Firebase Auth
├─ AWS Function URL API
│  ├─ classes
│  ├─ materials
│  ├─ discussions
│  ├─ attendance
│  ├─ self-paced quizzes
│  ├─ live quiz control/public state
│  └─ Cloudinary upload signing
├─ DynamoDB single-table storage
├─ SQS live-answer queue
│  └─ Lambda live-answer processor
├─ Cloudinary direct browser uploads
└─ Cloudflare Worker AI gateway
   └─ Groq models
```

Firebase remains the user identity provider. AWS is the authority for LMS domain data. Cloudinary stores uploaded learning assets. The Cloudflare Worker isolates the Groq API key from the browser.

## Implemented

### Application foundation

- Semantic design tokens and reusable UI primitives.
- Responsive shared application shell for teacher and student experiences.
- React Router URL architecture with authentication and role boundaries.
- Firebase authentication integration.
- Route-level lazy loading and Cloudflare Pages SPA redirect support.
- Explicit loading, error, empty, and unavailable states on the major application surfaces.

### Classes

- Authenticated create, join, list, overview, and member flows.
- DynamoDB owner/member access patterns.
- Transactional class-code reservation.
- Idempotent class joining.
- Owner-only member roster.
- Teacher and student class collections and workspace navigation.

### Materials

- Material create, edit, draft/publish, reader, and recoverable soft delete.
- Structured block content with headings, paragraphs, lists, quotes, links, YouTube, images, and files.
- Student progress, completion, bookmarks, and learning collections.
- Direct browser upload to Cloudinary through an owner-only signed-upload endpoint.
- Upload validation for supported images and documents.
- YouTube embedding through privacy-enhanced YouTube delivery rather than Quizzy bandwidth.

### Discussions

- Material-scoped threads and replies.
- Verified author identity and teacher markers.
- Edit/delete-own-content rules.
- Owner-controlled resolve/reopen/select-answer workflow.
- Query-based DynamoDB access without adding a table or index.

### Attendance

- Teacher attendance session creation.
- `draft -> active -> ended` lifecycle.
- Teacher-defined location and radius.
- Student device geolocation.
- Server-side Haversine validation.
- Duplicate-safe transactional check-in.
- Teacher recap and history.
- Student responses do not expose the teacher venue coordinates.

### Self-paced quizzes

- Teacher CRUD/editor/settings/publish flows.
- Student published quiz list and attempt flow.
- Server-side scoring.
- Optional answer review.
- Teacher result recap.
- One submission per student enforced by conditional write.
- Correct answers are removed from student question payloads before submission.
- Question types: `multiple_choice`, `true_false`, `short_answer`, `arrange`, and `image_hotspot`.

### Live quizzes

The live runtime now exists in `main`; it is no longer "not started".

- Teacher creates a live session from a published quiz.
- Six-character join code and QR-compatible public URL.
- Public participant join without a Quizzy account or class membership.
- Opaque participant token stored only in the participant browser session.
- Server-canonical state machine for lobby, question, reveal, and finished states.
- Public payload hides correct answers during the question phase and exposes them only during reveal.
- Join attempts are rate-limited per hashed source-network key.
- Live session/code/participant/answer data uses DynamoDB TTL.
- Public answers are authorized before enqueueing.
- SQS absorbs answer bursts.
- A separate Lambda processor rechecks canonical session state before writing answers.
- Duplicate answer writes are prevented transactionally.
- Host receives aggregate answer counts/distribution rather than individual answer payloads.
- Host and participant UIs currently poll compact state every two seconds.

### AI gateway

- `workers/` contains a dedicated Cloudflare Worker AI gateway.
- `POST /api/ai/assist` requires a Firebase bearer token.
- Groq credentials stay in a Worker secret.
- Explicit CORS allow-list.
- Request-body bounds and per-UID edge rate limiting.
- Supported tasks: `material_draft`, `quiz_draft`, and `assessment_feedback`.
- Quiz editor can request an AI-generated editable draft.
- Current configured Groq model IDs are valid as of the 23 September 2026 audit: `qwen/qwen3.8-27b` and `openai/gpt-oss-120b`.

## Production-readiness gaps

### P0 - must close before public live-quiz use

1. **Deploy and verify the latest AWS template.**
   The repository now contains DynamoDB TTL, SQS, a DLQ, and `LiveQuizAnswerProcessor`. The previously documented deployed stack predates this audited commit, so repository state must not be confused with verified cloud state.

2. **Fix live-answer DynamoDB capacity.**
   The table is still configured at one provisioned WCU. A processed live answer performs a transactional metadata update, answer write, and participant update. SQS protects the public request path from bursts, but one WCU is not adequate for near-realtime classroom answer processing. Choose a reviewed capacity strategy before real class use: on-demand, autoscaling/provisioned capacity sized for expected concurrency, or a dedicated write pattern.

3. **Add operational visibility for the queue processor.**
   The main Lambda has a seven-day explicit log group, but the live-answer processor does not yet have equivalent explicit log retention in the SAM template. Add bounded log retention plus monitoring for Lambda errors/throttles, SQS age/depth, and DLQ messages.

4. **Run real browser end-to-end verification.**
   Verify at minimum: teacher creates live session -> student joins by QR/code -> answer is queued -> answer count updates -> reveal -> next question -> finish. Test multiple devices, refresh/rejoin behavior, slow network, expired codes, duplicate answers, and timer boundaries.

5. **Replace development origins before hosted deployment.**
   AWS and Worker configuration still use localhost-oriented CORS defaults in repository configuration. Production origins must be explicit.

### P1 - engineering hardening

- Add frontend component/integration tests for critical class, material, quiz, attendance, and live flows.
- Add browser E2E tests for the highest-risk user journeys.
- Add CI so pull requests run frontend lint/build, backend tests/checks, Worker tests, and SAM validation.
- Root `npm run validate` currently does not execute Worker tests or SAM validation/build.
- Add load tests around live-answer queueing/processing and establish a supported classroom-size target.
- Add pagination or an explicit supported cap for host participant lists; the current participant query is limited to 100 items.
- Review AI token verification parity with the AWS verifier and keep auth validation requirements documented consistently.
- Define DLQ recovery/runbook behavior instead of relying only on retention.
- Add accessibility and responsive browser certification, not only static/parser validation.

## Product gaps after technical beta

These are intentional roadmap items, not regressions in the current implementation:

- persistent live score, leaderboard, streak/checkpoint, and final live results;
- realtime state transport to replace two-second polling where justified;
- assignments, submissions, revision requests, rubrics, grading, and teacher feedback;
- class learning sessions/timeline that group materials, tasks, and quizzes per meeting/date;
- teacher quiz bank/catalog with copy semantics, taxonomy, moderation, import/export;
- richer progress analytics and teacher reporting;
- production notification/schedule system;
- trusted institution/teacher authorization if Quizzy moves beyond the current open-community class-creation model;
- optional document conversion/preview pipeline such as PPT/PPTX -> PDF/thumbnail.

## Validation status

The repository includes focused backend tests for classes, materials, discussions, attendance, self-paced quizzes, Cloudinary signing, live quiz handlers/repository/queue/processor, plus Worker tests for the AI gateway.

The previous architecture document recorded successful validation for the pre-live-quiz deployment. This audit did not execute the repository test commands or deploy cloud resources; therefore the latest commit should be treated as **code-audited but requiring a fresh full validation run**:

```bash
npm run validate
npm --prefix workers test
npm --prefix backend run sam:validate
npm --prefix backend run sam:build
```

After deployment, repeat transport/auth smoke tests and complete the browser E2E matrix.

## Deployment status

The previously verified `quizzy-dev` stack in `ap-southeast-1` contained the retained DynamoDB table, OwnerIndex, Node.js 22 ARM64 API Lambda, Function URL, SSM-backed Cloudinary secret access, and seven-day API Lambda logs.

The current `main` branch adds SQS, a dead-letter queue, DynamoDB TTL, and the live-answer processor. Their presence in source control does not prove that the running stack has been updated. Verify CloudFormation outputs and resources after deploying the current template.

The Cloudflare AI Worker source is ready for deployment configuration, but production readiness still depends on the real `FIREBASE_PROJECT_ID`, exact production origin(s), and `GROQ_API_KEY` Worker secret.

## Recommended next gate

Treat the next milestone as **Production Beta Gate**, not another feature-expansion phase.

Exit criteria:

1. latest AWS and Worker code deployed from the audited commit;
2. live-answer capacity strategy corrected and load-tested;
3. CORS/secret configuration reviewed for the hosted frontend;
4. queue/Lambda/DLQ monitoring in place;
5. root/CI validation covers frontend, backend, Worker, and SAM;
6. end-to-end browser verification passes for class, material upload, attendance, self-paced quiz, live quiz, and AI quiz draft;
7. only after those gates pass, continue with persistent live scoring/leaderboards and the LMS task/session modules.

See `docs/phase-10-and-learning-roadmap.md` for the product sequence.
