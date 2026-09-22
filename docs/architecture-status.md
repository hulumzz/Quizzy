# Quizzy Architecture Status

Last updated: 23 September 2026  
Baseline: `a088f290450d4e9d46ca278f517bd6664ac39d5f`

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
- Central frontend environment reader uses `VITE_API_URL` as the single authenticated class, material, and discussion API origin.
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
- Student dashboard continuation card now resolves the latest recorded material instead of displaying prototype copy.
- Contextual discussion spaces are attached to individual materials, with class-level material selection for teacher and student navigation.
- Discussion threads support replies, verified-author names, teacher badges, timestamps, edit/delete-own-content rules, and recoverable deleted-message placeholders.
- Class owners can resolve threads, select a reply as the answer, reopen discussions, and automatically reopen a thread when its selected answer is deleted.
- Discussion data uses the material partition and `DISCUSSION#` sort-key prefix, keeping the initial access pattern query-based without adding a table or index.

## Partially implemented

- Authentication still uses Firebase Auth and the existing Firestore/local cache profile flow. Domain profile ownership will be clarified during backend integration.
- Landing and authentication retain the expressive prototype visual direction, with misleading infrastructure copy removed.
- Quiz, attendance, and live-join routes still show honest empty/unavailable states until their durable APIs exist.
- Class, material, and discussion data become live when `VITE_API_URL` points to the deployed Function URL; without it, the UI shows an explicit unavailable state.
- Attachment support currently accepts existing HTTPS image/file URLs. Direct binary upload and owned object storage remain a later infrastructure step.

## Not started

- AWS deployment and real-account verification.
- Attendance, quiz CRUD, live quiz runtime, and owned binary attachment uploads.

## Legacy retained for migration

- `workers/` remains unchanged in responsibility and is still a reference for attendance distance and AI prompt concepts.
- `src/pages/Dashboard.jsx` and `src/pages/ClassDetail.jsx` are no longer active routes. They remain temporarily as migration references and must not be restored as production UI.

## Removed

- State-machine navigation from `src/App.jsx`.
- Separate teacher/student layout systems.
- Mock class data from active teacher and student dashboards.
- Residual Vite template stylesheet.

## Current validation

- The discussion batch passed frontend lint and production build plus all 42 backend unit tests and backend syntax checks.
- Existing Firebase bundle-size warning remains (approximately 528 kB minified); no dependencies were added for the redesign.
- The checks below also record validation from the preceding implementation batches.
- `npm.cmd run build` passes.
- `npm.cmd run lint` passes after the frontend foundation changes.
- `npm.cmd --prefix backend test` passes all backend unit tests.
- `npm.cmd --prefix backend run check` passes Node syntax checks.
- AWS SAM CLI was unavailable, so `sam validate --lint` and `sam build` were not run.
- Local HTTP checks return `200` for `/`, `/login`, teacher/student class lists, and teacher/student class overview deep-link entry points.
- In-app visual browser verification was unavailable in this session; responsive behavior is build/static validated, not visually certified yet.

## Deployment status

The class, material, and discussion vertical slices are implemented locally but deliberately not deployed. No DynamoDB table, Lambda, Function URL, IAM role, or CloudWatch log group has been created.

Before deployment, confirm region, account Free Tier eligibility, billing alerts, and exact allowed origins, then inspect the CloudFormation change set.

## Next batch

The next planned product slice is attendance:

```text
attendance create and start/end
→ teacher location and radius
→ student geolocation and backend Haversine validation
→ check-in, recap, and history
```

Keep this local until the owner explicitly approves AWS deployment. Before introducing realtime quiz infrastructure, verify the class, material, discussion, and attendance flows end to end against the deployed API.
