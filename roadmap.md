# VeriAI — Phase 1 Roadmap

## Done
- Lovable Cloud enabled (auth + Postgres + storage)
- DB migrations: profiles, user_roles (+has_role/is_staff), applications, documents, document_requirements, verification_runs, verification_findings, application_status_history, review_comments, notifications, report_history + RLS + grants + triggers (profile on signup, application_number sequence VER-YYYY-NNNNNN, status-transition guard)
- Private storage bucket `application-documents` + storage RLS (20 MB limit, path `{applicationId}/{file}`)
- Email/password auth + forgot/reset password pages; email confirmation ON (test account: institution.test@qa.veriai.app, institution_user + admin for testing)
- Design system (gov-tech navy/teal) + shared components (StatusBadge, AppShell sidebar, states)
- Server functions: applications CRUD/submission (server-side required-field + required-document validation), documents replace/retire, verification engine (checks 1–8 incl. SHA-256 duplicates), findings resolution (staff), review workflow, admin assign/status/decision, notifications, PDF report (jsPDF + disclaimer)
- Client OCR/extraction: pdfjs-dist (digital PDFs) + tesseract.js (images/scans), field extraction (labeled capture fixed to use last regex group + next-label trimming), SHA-256 hashing, confidence, page limits
- Pages: landing (/), auth, dashboard, applications list, wizard, application detail (edit/upload/extract/replace/preview/verify/findings/resolve/comments/timeline/report), review queue, admin dashboard, notifications, settings
- Build + typecheck green; vitest suite passes
- E2E verified via Playwright: register → wizard → upload (2 categories) → extraction (95% conf) → server-side submission blocking on missing docs → submit → run verification (8 checks; matching-name run: 1 duplicate finding → manual_review; mismatch run: name mismatch + duplicate → action_required) → PDF report download verified (%PDF, correct contents)

## Remaining (not blockers)
- [ ] Reviewer-specific flows exercised with a dedicated reviewer account (assigned queue, resolve findings in UI)
- [ ] Replace-document version history asserted in UI test (server function verified)
- [ ] README demo/test scenario walkthrough expansion

## Notes
- Roles: institution_user (default), reviewer, admin — stored in user_roles only, granted via trusted ops only.
- Verification findings are "Potential Inconsistency — Manual Review Required"; never auto approve/reject.
- Route rule: a pathless `_authenticated` layout must always have at least one child route, otherwise the router treats it as claiming "/" and conflicts with index.tsx.
