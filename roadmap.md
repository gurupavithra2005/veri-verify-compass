# VeriAI — Phase 1 Roadmap

## Done
- Lovable Cloud enabled (auth + Postgres + storage)

## In progress
- [ ] DB migrations: profiles, user_roles (+has_role fn), applications, documents, document_requirements, verification_runs, verification_findings, application_status_history, review_comments, notifications, report_history + RLS + grants + triggers (profile on signup, application_number sequence, status-transition guard)
- [ ] Private storage bucket `application-documents` + storage RLS
- [ ] Enable email/password auth
- [ ] Design system (gov-tech navy/teal) + shared components (StatusBadge, AppLayout/sidebar, empty/loading states)
- [ ] Server functions: applications CRUD, documents, verification engine (checks 1–8), findings resolution, review workflow, admin actions, notifications, PDF report data
- [ ] Client OCR/extraction: pdfjs-dist (digital PDFs) + tesseract.js (images/scans), field extraction, confidence
- [ ] Pages: landing, auth (login/register/forgot/reset), institution dashboard, application wizard, application detail (documents/findings/timeline), verification results, PDF report, notifications, settings, admin dashboard, manual review, reviewer queue
- [ ] Install: pdfjs-dist, tesseract.js, jspdf
- [ ] Tests for key rules (submission gating, status permissions, mismatch finding)
- [ ] End-to-end verification via Playwright (register, create app, upload, extract, verify, report)
- [ ] README setup/test instructions

## Notes
- Roles: institution_user (default), reviewer, admin — stored in user_roles only, granted via trusted ops only.
- Verification findings are "Potential Inconsistency — Manual Review Required"; never auto approve/reject.
