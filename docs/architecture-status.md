# Quizzy Architecture Status

Last updated: 23 September 2026  
Baseline: `5208284` (`phase 8`)
Current implementation branch: `main`

## Implemented

- Semantic design tokens for application surfaces, typography, spacing, state colors, radius, elevation, and motion.
- Reusable UI primitives: buttons, form controls, cards, badges, avatars, dialog/modal, tabs, toast, skeleton, empty state, headings, and progress.
- Quizzy Glyph foundation with the first navigation and utility icon set.
- URL-based React Router architecture with authentication and role boundaries.
- Shared responsive `AppShell`, sidebar, header, mobile navigation, user menu, and notification empty state.
- Production-style teacher and student home pages with loading, error, and honest empty states.
- Redesigned application workspace: compact sidebar, violet welcome banner with code-native artwork, mint/peach accents, stronger typography, and responsive main/agenda columns.
- Self-hosted Nunito Sans variable typography and higher-contrast surface tokens make white cards distinct from the lavender-gray application canvas without relying on remote font delivery.
- Shared teacher/student dashboard widgets; class metrics use loaded API records and display an unavailable value while data is missing.
- Searchable class collections with active/all filters, stable class-card color accents, and a copy-code action in the teacher overview.
- Interactive week/date navigation is presentation-only; it explicitly reports agenda unavailability until a schedule API exists.
- Mobile bottom navigation, keyboard-contained navigation drawer and dialogs, Escape dismissal, scroll locking, and reduced-motion support.
- Cloudflare Pages SPA redirect support through `public/_redirects`.
- Central frontend environment reader uses `VITE_API_URL` as the single authenticated class, material, discussion, and attendance API origin.
- Route-level lazy loading keeps the public landing bundle separate from Firebase authentication and dashboard pages.
- Authenticated create, join, list, overview, and member frontend flows with reusable API and auth-token services.
- Lambda Function URL class handler with Firebase certificate verification, bounded validation, structured errors, and ownership derived from the verified token.
- DynamoDB class repository with owner and member access patterns, transactional class-code reservation, and atomic idempotent class joining.
- Free-first AWS SAM template using provisioned capacity, exact-origin CORS, seven-day log retention, retained table data, and the account-level Lambda concurrency quota.
- Student class page with code validation, loading/error/empty states, real joined-class data, and duplicate-safe joins.
- Shared teacher/student class overview with owner/member authorization and an owner-only member roster.
- Backend unit coverage for authentication headers, validation, owner/member scoping, anonymous-account rejection, repository access patterns, transactional joining, and class-code reservation.
- Authenticated material list, reader, create, edit, publish/draft, and recoverable soft-delete flows inside each class workspace.
- Structured material editor and safe React renderer for headings, paragraphs, quotes, lists, dividers, HTTPS links, YouTube embeds, images, and externally hosted files.
- Student reading progress, completion state, bookmarks, saved-material collection, and progress collection backed by DynamoDB.
- Material authorization keeps draft management owner-only, exposes only published content to members, and derives every user identity from the verified Firebase token.
- Material creation/deletion and the class material count use DynamoDB transactions; material queries use the class partition and `MATERIAL#` sort-key prefix.
- Student dashboard continuation card resolves the latest recorded material instead of displaying prototype copy.
- Contextual discussion spaces are attached to individual materials, with class-level material selection for teacher and student navigation.
- Discussion threads support replies, verified-author names, teacher badges, timestamps, edit/delete-own-content rules, and recoverable deleted-message placeholders.
- Class owners can resolve threads, select a reply as the answer, reopen discussions, and automatically reopen a thread when its selected answer is deleted.
- Discussion data uses the material partition and `DISCUSSION#` sort-key prefix, keeping the initial access pattern query-based without adding a table or index.
- Attendance is implemented as a class-scoped vertical slice with teacher session creation, `draft → active → ended` lifecycle, teacher-defined venue/radius, student device geolocation, server-side Haversine validation, check-in, recap, and history.
- Attendance authorization keeps session management owner-only and check-in member-only. The authenticated identity is used for every student record, so client-supplied user IDs are not trusted.
- Attendance venue coordinates and radius are stored server-side. Students submit only their current coordinates and accuracy; the backend never accepts the venue/radius from a check-in request.
- Attendance check-in uses a DynamoDB transaction that rechecks the session is active and conditionally creates one check-in per student. Duplicate submissions return the existing record safely.
- Student attendance responses hide the teacher venue coordinates while still exposing session state, allowed radius, and the student's own check-in result.
- Teacher attendance recap resolves the current class roster against stored check-ins and reports present versus not-yet-recorded members without adding a new table or index.
- The AWS SAM IAM policy includes `dynamodb:ConditionCheckItem`, required by the attendance transaction's `ConditionCheck` operation, as well as `ssm:GetParameter` for the `/quizzy/dev/cloudinary-api-secret` parameter.
- Phase 9 self-paced quizzes are implemented and deployed: teacher CRUD/editor/settings/publish flows, published student list and attempt flow, server-side scoring, optional answer review, and teacher result recap.
- Quiz documents are class-partitioned `QUIZ#` aggregates capped at 30 questions. Student attempts use a separate `QUIZ#<id>` partition and a conditional write that permits one submission per student.
- Correct answers are removed from student quiz responses and scoring always reloads the canonical published quiz on the server. Authenticated token identity is authoritative for ownership and attempts.

## Partially implemented

- Authentication still uses Firebase Auth and the existing Firestore/local cache profile flow. Domain profile ownership will be clarified during backend integration.
- Landing and authentication retain the expressive prototype visual direction, with misleading infrastructure copy removed.
- Live quiz join remains unavailable until the realtime phase; the class-scoped self-paced quiz flow is now implemented.
- Class, material, discussion, and attendance data become live when `VITE_API_URL` points to the deployed Function URL; without it, the UI shows an explicit unavailable state.
- Attendance provides simple GPS/radius validation only. Face recognition and smart attendance verification remain future features as specified in the product blueprint.
- Material images and documents can now be uploaded directly from the browser to Cloudinary through an owner-only signed-upload flow. Existing HTTPS URLs remain supported.
- Uploads are limited to JPG, PNG, WebP, GIF, PDF, selected Office formats, and TXT. Image size is capped at 8 MB and document size at 15 MB before a signature is issued.
- The Cloudinary API secret remains backend-only and is referenced from a free Standard SSM SecureString during deployment; no S3 bucket is required for this phase.

## Not started

- Live quiz runtime.

## Legacy retained for migration

- `workers/` remains unchanged in responsibility and is still a reference for attendance distance and AI prompt concepts. Its older attendance endpoint is not the production attendance authority.
- `src/pages/Dashboard.jsx` and `src/pages/ClassDetail.jsx` are no longer active routes. They remain temporarily as migration references and must not be restored as production UI.

## Removed

- State-machine navigation from `src/App.jsx`.
- Separate teacher/student layout systems.
- Mock class data from active teacher and student dashboards.
- Residual Vite template stylesheet.
- Attendance placeholder routes from the active teacher/class navigation; these now point to the implemented attendance UI.

## Current validation

- The preceding discussion batch passed frontend lint and production build plus all 42 backend unit tests and backend syntax checks.
- Attendance adds 13 focused backend tests covering input/status validation, verified identity use, anonymous rejection, Haversine distance, draft visibility, student location privacy, outside-radius rejection, transactional active-session recheck, and teacher recap; all 13 pass in an isolated Node test harness.
- New attendance backend source files and the updated Lambda dispatcher pass Node syntax parsing in the isolated implementation workspace.
- New attendance frontend JavaScript/JSX files and route changes pass TypeScript's JavaScript/JSX parser/transpiler in the isolated implementation workspace.
- Full-repository `npm run validate` passed from the normal checkout before deployment, including frontend lint/build, all 55 backend tests, and backend syntax checks.
- Existing Firebase bundle-size warning from the previous batch remains approximately 528 kB minified; the attendance batch adds no frontend dependency.
- AWS SAM CLI `1.166.2` validation and build pass for the Node.js 22 ARM64 function package.
- The local Phase 9 and Cloudinary upload batch passes frontend lint and production build, all 68 backend tests, backend syntax checks, SAM lint validation, and SAM package build.
- CloudFormation pre-deployment validation returned no `FAIL` or `WARN` events. AWS Guard Rules reports three accepted free-first hardening exceptions: no customer-managed KMS key for the log group or DynamoDB table, and no DynamoDB point-in-time recovery.
- The deployed Function URL responds successfully at the transport layer and rejects unauthorized requests to `/classes` and `/classes/:id/uploads/signature` without a Firebase token with `401 Unauthorized`.
- In-app visual browser verification was unavailable in this session; responsive behavior for attendance and quizzes is parser/static validated, not visually certified yet.

## Deployment status

The `quizzy-dev` CloudFormation stack is deployed in `ap-southeast-1` and is `UPDATE_COMPLETE`. It contains the retained provisioned DynamoDB table and `OwnerIndex`, the Node.js 22 ARM64 Lambda function and least-privilege role with runtime SSM SecureString parameter resolution, a public Function URL protected by application-level Firebase token verification, and a seven-day CloudWatch log group.

Development CORS currently allows only `http://localhost:5173`. Set the local frontend `VITE_API_URL` to the stack's `ClassesFunctionUrl` output without a trailing slash before authenticated browser verification. Replace the allowed origin through a reviewed stack update before deploying the frontend to a hosted domain.

The account is on the AWS Paid plan with no remaining promotional credits. The stack therefore relies on ongoing monthly free allowances rather than credits. A healthy USD 1 monthly cost budget is active and alerts when actual spend exceeds USD 0.01.

## Next gate

Phase 9 self-paced quiz and Cloudinary signed-upload flows are now implemented and deployed to the `quizzy-dev` stack. The next step is live authenticated verification in the browser for quiz creation, quiz attempt, and image/document uploads, followed by Phase 10 realtime PIN join and live sessions.
