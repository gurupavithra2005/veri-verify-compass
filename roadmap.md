# VeriAI — SIH26261 Missing-Feature Implementation

Constraints (standing):
- Never modify VER-2026-000009 or VER-2026-000011 (audit evidence record, now Verified).
- Never delete historical runs/findings/comments/notifications/report or status history.
- Test only on clearly-labelled isolated TEST applications.
- No weakening of auth/RLS/storage. No fabricated results. Findings stay advisory.

## Phase A — Reliability (P0 defects)
- [ ] A1 Fix field-extractor label pollution (P0) + regression tests
- [ ] A2 Separate upload vs extraction status; working retry; no false success toasts
- [ ] A3 Submission → automatic preliminary verification; duplicate-run guard; manual re-run kept
- [ ] A4 Admin dashboard stats/list scope consistency
- [ ] A5 Mobile overflow on application detail (~390px); write-error checks on comments/status/report/notifications

## Phase B — Verification completeness
- [ ] B1 Per-field extraction evidence (value, source passage, method, confidence, correction state) persisted on documents
- [ ] B2 Field corrections by owner (original retained + correction record)
- [ ] B3 Document classification (document type detection) + cross-document consistency using real extracted fields
- [ ] B4 Rule version + rules snapshot stored on each verification run
- [ ] B5 Missing-field / expiry handling based on real data

## Phase C — SIH-specific modules
- [ ] C1 Authorized-source verification framework (admin-configured sources; real Not Configured state; SSRF-safe; evidence records)
- [ ] C2 Institutional records registry (admin-managed, synthetic-demo-labelled) + engine comparison
- [ ] C3 Anomaly/possible-tampering checks (PDF metadata, date heuristics, signature presence) — evidence-based, advisory
- [ ] C4 Infrastructure evidence review (photo/video/floor-plan categories, evidence requests, inspection flag via review workflow)
- [ ] C5 Complete audit trail table + logging + staff-visible audit view
- [ ] C6 Dashboard/alert extensions + notifications for new events
- [ ] C7 Extended PDF report (rules version, evidence, corrections, connector results, audit summary)

## Phase D — Security & validation
- [ ] D1 Migrations reviewable; RLS/grants on every new table
- [ ] D2 Regression + e2e tests (Playwright) on isolated test application
- [ ] D3 Mobile verification
- [ ] D4 Implementation report with honest PASS/PARTIAL/BLOCKED/NOT TESTED statuses
