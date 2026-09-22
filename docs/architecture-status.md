# Quizzy Architecture Status

Last updated: 23 September 2026  
Baseline: `b2a27b9163e9d26b7b0f3a38a81dc9357eb7e78e` (`phase 7`)  
Current implementation branch: `chatgpt/attendance-phase-8`

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
- Free-first AWS SAM template using provisioned capacity, exact-origin CORS, seven-day log retention, retained table data, and bounded Lambda concurrency.
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
- The AWS SAM IAM policy includes `dynamodb:ConditionCheckItem`, required by the attendance transaction's `ConditionCheck` operation.

## Partially implemented

- Authentication still uses Firebase Auth and the existing Firestore/local cache profile flow. Domain profile ownership will be clarified during backend integration.
- Landing and authentication retain the expressive prototype visual direction, with misleading infrastructure copy removed.
- Quiz and live-join routes still show honest empty/unavailable states until their durable APIs exist.
- Class, material, discussion, and attendance data become live when `VITE_API_URL` points to the deployed Function URL; without it, the UI shows an explicit unavailable state.
- Attendance provides simple GPS/radius validation only. Face recognition and smart attendance verification remain future features as specified in the product blueprint.
- Attachment support currently accepts existing HTTPS image/file URLs. Direct binary upload and owned object storage remain a later infrastructure step.

## Not started

- AWS deployment and real-account end-to-end verification.
- Quiz CRUD, live quiz runtime, and owned binary attachment uploads.

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
- Full-repository `npm run lint`, `npm run build`, and the complete backend test suite were not rerun for this attendance batch because the isolated workspace does not contain the repository dependencies. Run `npm run validate` from a normal checkout before merging/deploying.
- Existing Firebase bundle-size warning from the previous batch remains approximately 528 kB minified; the attendance batch adds no frontend dependency.
- AWS SAM CLI remains unavailable in this session, so `sam validate --lint` and `sam build` were not run.
- In-app visual browser verification was unavailable in this session; responsive behavior for attendance is parser/static validated, not visually certified yet.

## Deployment status

The class, material, discussion, and attendance vertical slices are implemented in source but deliberately not deployed. No DynamoDB table, Lambda, Function URL, IAM role, or CloudWatch log group has been created by this implementation batch.

Before deployment, confirm region, account Free Tier eligibility, billing alerts, and exact allowed origins, then inspect the CloudFormation change set. Deployment still requires the owner's explicit approval.

## Next gate

The attendance implementation completes the next product slice previously defined as:

```text
attendance create and start/end
→ teacher location and radius
→ student geolocation and backend Haversine validation
→ check-in, recap, and history
```

The next required step is real-account deployment and end-to-end verification of class, material, discussion, and attendance flows. Keep this local until the owner explicitly approves AWS deployment. Do not introduce realtime quiz infrastructure before that verification gate is complete.
