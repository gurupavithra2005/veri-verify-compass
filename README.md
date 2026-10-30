# Veri Verify Compass

PROJECT: VeriAI

PHASE: Phase 1 — Core Application and Document Verification MVP



Act as a senior full-stack developer, AI engineer, database architect,

UI/UX designer, and application security engineer.



Build a complete, functional, responsive web application named:



VeriAI — AI-Powered Application Validation, Document Authentication

and Regulatory Compliance Verification Platform.



PROJECT OBJECTIVE

=================



Build a software-only platform that helps institutions submit applications,

upload supporting documents, extract information from documents, detect

missing information and document mismatches, check configured compliance

rules, generate verification reports, and submit applications for human review.



The application should demonstrate how AI-assisted document processing and

automated validation can improve the efficiency of institutional application

verification.



This is a prototype for a hackathon problem statement. Do not represent it

as an official AICTE portal or claim that it is integrated with official AICTE

systems unless an authorized integration is actually configured.



CORE REQUIREMENTS

=================



1. Build a real, working application, not just a static UI.

2. Use React, TypeScript, and Tailwind CSS.

3. Use shadcn/ui components where appropriate.

4. Use Supabase for authentication, PostgreSQL database, and private file storage.

5. Implement real database operations.

6. Implement role-based access control.

7. Implement actual document text extraction and validation.

8. Generate downloadable PDF verification reports.

9. Make all primary buttons and forms functional.

10. Use environment variables for secrets and API keys.

11. Never expose service-role keys or secret API keys in frontend code.

12. Do not use fake success messages, hardcoded verification outcomes,

    or placeholder buttons for features described as functional.

13. Do not invent official compliance requirements.

14. Make document requirements configurable or clearly label prototype rules.

15. Keep Phase 1 focused on the requirements specified below.



If an existing project is connected, inspect its current implementation before

changing it. Preserve working functionality and avoid unnecessary rewrites.



==================================================

SECTION 1: PROFESSIONAL UI/UX DESIGN

==================================================



Create a modern, professional government-technology and enterprise SaaS interface.



Design direction:

- Clean white and light-gray surfaces.

- Dark navy headings and navigation.

- Teal or blue-green accent color.

- Subtle borders and shadows.

- Rounded cards and buttons.

- Clear typography.

- Consistent spacing.

- Accessible colors and readable text.

- Responsive desktop, tablet, and mobile layouts.



Create a reusable design system.



The application should look suitable for a national-level hackathon

demonstration or enterprise software presentation.



Avoid:

- Excessive gradients.

- Too many animations.

- Unnecessary decorative elements.

- Fake statistics.

- Excessive empty space.

- Unreadable text.

- Buttons that do nothing.



Use Lucide icons where appropriate.



Create:

1. Public landing page.

2. Authentication pages.

3. Institution dashboard.

4. Application creation page.

5. Document management page.

6. Verification results page.

7. PDF report viewing and downloading interface.

8. Application tracking page.

9. Admin dashboard.

10. Admin manual-review page.

11. Notifications interface.

12. Profile and settings page.



Use a consistent sidebar navigation for authenticated users.



On mobile, make the sidebar collapsible and keep all forms usable.



==================================================

SECTION 2: LANDING PAGE

==================================================



Create a professional landing page for VeriAI.



Hero section:



Title:

"Smarter Document Verification. Faster Compliance."



Subtitle:

"An intelligent platform for document processing, application validation,

compliance checks, and transparent human review."



Primary CTA:

"Get Started"



Secondary CTA:

"Explore Features"



Show the following feature cards:



1. Intelligent Document Processing

2. Automated Information Validation

3. Compliance Rule Checking

4. Application Status Tracking

5. Verification Report Generation

6. Human Review Workflow



Include a section explaining the workflow:



Step 1: Submit Application

Step 2: Upload Documents

Step 3: Extract and Validate Information

Step 4: Review Verification Findings

Step 5: Generate Report and Complete Human Review



Add a dedicated section explaining why VeriAI is useful:

- Reduces repetitive manual checking.

- Makes missing information easier to identify.

- Highlights inconsistencies.

- Organizes verification results.

- Improves application status transparency.



Add a disclaimer:



"VeriAI is a prototype for AI-assisted application verification.

Verification findings are preliminary and do not constitute official approval,

certification, or a definitive determination of document authenticity."



Do not display fabricated government logos, approvals, or official partnerships.



==================================================

SECTION 3: AUTHENTICATION AND USER ROLES

==================================================



Use Supabase Authentication.



Implement:

- User registration.

- Email and password login.

- Logout.

- Forgot-password flow.

- Password reset flow.

- Session persistence.

- Protected routes.

- User profile management.



Create the following roles:



1. institution_user

2. admin

3. reviewer



Institution users can:

- Create their own applications.

- Edit their drafts.

- Upload supporting documents.

- View their own verification results.

- View and download their own reports.

- Respond to correction requests.

- Track application statuses.



Reviewers can:

- View applications assigned to them.

- Inspect documents and findings.

- Add internal review comments.

- Request corrections.

- Record review recommendations.



Admins can:

- View all applications.

- Assign applications to reviewers.

- Access the review queue.

- Update application workflow statuses.

- Record final administrative decisions.

- Inspect application audit history.



SECURITY REQUIREMENT:



Never allow users to make themselves admins by editing frontend requests.



Newly registered users must receive the institution_user role by default.



Admin and reviewer roles must be granted only through trusted administrative

operations, not through public registration.



Implement route-level access controls and database-level authorization.



==================================================

SECTION 4: INSTITUTION APPLICATION MANAGEMENT

==================================================



Build a complete application creation and tracking workflow.



Create a multi-step application form.



STEP 1: Institution Information



Fields:

- Institution Name

- Institution Type

- Institution Address

- State

- District

- Contact Person

- Contact Email

- Contact Phone Number

- Institution Registration Number, if applicable



STEP 2: Application Information



Fields:

- Application Title

- Application Reference Number, if supplied

- Academic Year

- Application Category

- Description

- Additional Notes



Generate a unique internal Application ID when the application is created.



Example display format:

VER-2026-000001



The underlying identifier must be unique, not just a hardcoded example.



For optional external references, do not require a value unless configured.



STEP 3: Required Document Checklist



Display the configured document categories for the application.



Initially support example categories such as:

- Institution Registration Proof

- Approval or Supporting Certificate

- Additional Supporting Document

- Other



IMPORTANT:

These example categories are not an authoritative AICTE document checklist.



Make the required-document configuration easy to modify later.



Each category must indicate:

- Required or optional.

- Uploaded or not uploaded.

- Processing status.

- Validation status.



STEP 4: Review and Submit



Display the complete application summary.



Allow:

- Save as Draft.

- Edit Draft.

- View Documents.

- Submit for Verification.



Validate required form fields and required document uploads before submission.



If required documents are missing, show the exact missing categories.



Do not silently discard entered information.



==================================================

SECTION 5: APPLICATION STATUS MANAGEMENT

==================================================



Implement these application statuses:



1. draft

2. submitted

3. processing

4. action_required

5. manual_review

6. verified

7. rejected



Display user-friendly labels:



Draft

Submitted

Processing

Action Required

Under Manual Review

Verified

Rejected



Create a reusable status badge component.



Each application should display:

- Application ID

- Institution Name

- Application Title

- Submission Date

- Current Status

- Last Updated Date

- Number of Documents

- Number of Findings



Create an application timeline showing significant status changes.



Example:



Application Created

    ↓

Documents Uploaded

    ↓

Application Submitted

    ↓

Document Processing

    ↓

Preliminary Verification

    ↓

Action Required OR Manual Review

    ↓

Authorized Officer Decision



Every status transition must be saved to the database.



Do not permit institution users to mark applications as verified or rejected.



Only authorized admin users may record the final administrative decision.



==================================================

SECTION 6: DOCUMENT UPLOAD AND MANAGEMENT

==================================================



Support these file types:

- PDF

- JPG

- JPEG

- PNG



Implement:

- Drag-and-drop upload.

- Browse files.

- Multiple document uploads.

- Document category selection.

- Upload progress.

- File-size validation.

- File-format validation.

- Document preview where supported.

- Download with authorization.

- Replace document.

- Upload timestamp.

- Document version history.

- Processing status indicators.

- Clear upload error messages.



Set a configurable file-size limit, initially 20 MB per file.



Reject unsupported file types and invalid uploads.



Use a PRIVATE Supabase Storage bucket named:



application-documents



Do not use publicly accessible document URLs.



Use authenticated access and short-lived signed URLs when a user needs to

preview or download a stored document.



Verify document ownership or reviewer/admin permissions on the server side.



Store document metadata in PostgreSQL.



Metadata should include:

- Document ID

- Application ID

- Original File Name

- Storage Path

- MIME Type

- File Size

- Document Category

- Uploaded By

- Uploaded At

- Version Number

- OCR Status

- Verification Status



Allow an institution user to replace a document while preserving the previous

version's audit history.



==================================================

SECTION 7: OCR AND DOCUMENT TEXT EXTRACTION

==================================================



Implement actual text extraction.



Do not simply show sample extracted text.



For searchable/digital PDFs:

- Use an appropriate PDF text extraction library, such as pdfjs-dist.



For image documents and scanned PDFs:

- Implement OCR using Tesseract.js or another suitable OCR solution.



If using browser-side processing, process the selected file locally where

possible and explain that performance depends on document quality and device

capability.



Keep file access restricted and do not transmit complete documents to an

external AI service without an explicitly configured integration.



OCR WORKFLOW:



1. User uploads a document.

2. Application identifies the file type.

3. Text extraction begins.

4. Display processing progress.

5. Extract text.

6. Identify candidate fields.

7. Save the extraction result.

8. Display the extracted data for review.

9. Allow the user or authorized reviewer to correct extraction errors.

10. Re-run validation after corrections.



Attempt to extract the following fields when present:



- Institution Name

- Institution Registration Number

- Application Reference Number

- Academic Year

- Issue Date

- Expiry Date

- Certificate Number



Not every document will contain every field.



Treat absent fields as unavailable, not automatically invalid.



Display extraction confidence where the chosen OCR implementation supports it.



Display these OCR statuses:



Not Processed

Processing

Completed

Needs Review

Failed



If a scanned document cannot be processed, display a clear error and allow

the user to retry.



Do not report successful OCR when extraction failed.



For long PDFs, add a configurable page limit for OCR processing and explain

which pages were processed.



Keep the implementation modular so an external OCR service can be added later.



==================================================

SECTION 8: AUTOMATED DOCUMENT VALIDATION

==================================================



Build a functional validation engine.



The first version should use extracted data, application form values,

required-document rules, and deterministic comparisons.



Do not require an external paid AI API for the basic validation workflow.



Implement these checks:



CHECK 1: Mandatory Document Validation



Verify whether every configured required document category is present.



CHECK 2: Institution Name Comparison



Compare the institution name in the application form with institution names

extracted from supporting documents.



Normalize capitalization and extra whitespace before comparison.



Do not treat harmless formatting differences as definite mismatches.



CHECK 3: Reference Number Comparison



Where a reference number is available in both the application and document,

compare them.



CHECK 4: Academic Year Comparison



Compare academic-year information where available.



CHECK 5: Date Validation



When issue and expiry dates are confidently extracted and an expiry date is

applicable, identify dates that appear expired or inconsistent.



If a date is missing or extraction confidence is low, mark the result

as needing review instead of assuming failure.



CHECK 6: Empty Required Fields



Identify missing mandatory application fields.



CHECK 7: OCR Review



Flag unreadable or low-confidence extracted information for manual inspection

where confidence data is available.



CHECK 8: Exact Duplicate Files



Optionally calculate a SHA-256 file hash and identify exact duplicate uploads

within an application's document collection.



Do not claim to detect all document fraud or image manipulation.



For each finding, store:



- Finding ID

- Application ID

- Document ID, when applicable

- Rule Code

- Finding Category

- Severity

- Field Name

- Application Value

- Extracted Document Value

- Explanation

- Recommended Action

- Finding Status

- Created At

- Resolved At



Use finding categories such as:

- Missing Document

- Missing Information

- Information Mismatch

- Date Inconsistency

- OCR Review Required

- Duplicate File



Use severity labels:

- Low

- Medium

- High



Each finding must have an understandable explanation.



Example:



Finding:

Institution Name Mismatch



Application Value:

ABC Engineering College



Extracted Document Value:

XYZ Engineering College



Explanation:

The institution names differ between the application form and the uploaded

supporting document.



Recommended Action:

Review the original document and correct the application or replace the

document if necessary.



Finding Status:

Open



IMPORTANT:

A mismatch or duplicate file does not prove fraud.

Do not display "Fraud Confirmed" based only on automated checks.



Use:

"Potential Inconsistency — Manual Review Required."



==================================================

SECTION 9: VERIFICATION RESULTS PAGE

==================================================



Build a detailed verification results interface.



Display:



1. Application ID.

2. Institution information.

3. Verification timestamp.

4. Number of documents processed.

5. Number of checks performed.

6. Number of passed checks.

7. Number of findings.

8. Overall preliminary result.

9. Detailed finding list.

10. Recommended actions.

11. Document-specific extraction results.

12. Resolved and unresolved findings.



Create a clear overview card.



Example result labels:



No Issues Detected

Issues Require Attention

Incomplete Verification

Manual Review Required



Only use "No Issues Detected" when all applicable checks completed

successfully and no configured rules produced findings.



If some required checks could not be completed, display:

"Incomplete Verification."



If mismatches or significant findings exist, display:

"Issues Require Attention" or "Manual Review Required."



Do not display a verification score as an official accreditation score.



If a numerical summary is useful, call it "Preliminary Check Completion"

or "Validation Summary" and explain how it is calculated.



Include filters:

- All Findings

- High Severity

- Medium Severity

- Low Severity

- Open

- Resolved



Allow authorized reviewers to mark findings as resolved and add comments.



Keep a record of original findings and changes.



==================================================

SECTION 10: APPLICATION DASHBOARD

==================================================



Create a functional dashboard for institution users.



Summary cards:

- Total Applications

- Draft Applications

- Submitted Applications

- Action Required

- Under Manual Review

- Verified Applications



All statistics must be calculated from actual database records belonging

to the authenticated user.



Do not hardcode dashboard counts.



Below the cards, show:

- Recent Applications

- Application Status Timeline

- Recent Notifications

- Documents Requiring Attention

- Quick Action: Create Application



Create an applications table with:

- Application ID

- Institution Name

- Application Title

- Academic Year

- Submission Date

- Status

- Findings Count

- Actions



Actions:

- View

- Edit Draft

- View Findings

- View Report



Implement pagination or efficient data loading.



Add search and filters by status, application title, and Application ID.



Institution users must never see another institution user's private application

or document information.



==================================================

SECTION 11: ADMIN DASHBOARD

==================================================



Create a separate protected admin dashboard.



Display database-derived statistics:

- Total Applications

- Awaiting Initial Processing

- Pending Manual Review

- Action Required

- Verified

- Rejected



Add an application review table.



Columns:

- Application ID

- Institution

- Submission Date

- Verification Status

- Number of Findings

- Assigned Reviewer

- Last Updated

- Action



Implement:

- Application search.

- Status filters.

- Institution filters.

- Finding severity filters.

- Sort by submission date.

- Pagination.



Allow the admin to open any authorized application and inspect:



- Application details.

- Original documents.

- Extracted document text.

- Extracted field values.

- Verification findings.

- Application status history.

- Previous reviewer comments.

- Existing reports.



Do not expose inaccessible files through public URLs.



==================================================

SECTION 12: MANUAL REVIEW WORKFLOW

==================================================



Human review must be a core part of Phase 1.



Build a review interface where an authorized reviewer can:



1. Open an assigned application.

2. Compare the application form and extracted document fields.

3. Preview supporting documents.

4. Review each verification finding.

5. Add internal review comments.

6. Resolve findings with a reason.

7. Request corrections from the institution.

8. Recommend verification or rejection.

9. Submit the review result.



Admins can:

- Assign a reviewer.

- Reassign an application.

- Request corrections.

- Record the final administrative decision.

- Enter a decision reason.



When requesting corrections:

- Require a clear reason.

- Show the requested actions to the institution.

- Notify the institution in the application interface.

- Allow document replacement or additional uploads.

- Preserve the prior application and document history.



When rejecting an application:

- Require a reason.

- Record the authorized decision maker.

- Record the timestamp.

- Notify the institution.



An application may only become "Verified" or "Rejected" following an

authorized administrative decision.



AI verification results must not automatically approve or reject applications.



==================================================

SECTION 13: PDF VERIFICATION REPORT

==================================================



Generate a genuine downloadable PDF report from stored application and

verification data.



Use a suitable client-side or server-side PDF generation library.



The report should look professional and include:



1. VeriAI branding.

2. Report title.

3. Application ID.

4. Institution Name.

5. Application Title.

6. Academic Year.

7. Submission Date.

8. Report Generation Date.

9. Documents Submitted.

10. OCR Processing Summary.

11. Validation Checks Performed.

12. Checks Passed.

13. Outstanding Findings.

14. Missing Documents.

15. Information Mismatches.

16. Recommended Corrective Actions.

17. Reviewer Comments, when permitted.

18. Administrative Decision, if available.

19. Decision Timestamp, if available.

20. Disclaimer.



The disclaimer must state:



"This report contains automated verification findings for review.

It is not, by itself, proof of document authenticity, official approval,

or regulatory certification."



Do not include passwords, API keys, unnecessary personal data,

or confidential reviewer-only comments in institution-facing reports.



The download button must produce an actual PDF file.



The PDF content must match the latest authorized stored data.



Do not merely rename an HTML document to .pdf.



If report history is stored, record:

- Application ID

- Report Generation Time

- Generated By

- Report Type



==================================================

SECTION 14: SUPABASE DATABASE DESIGN

==================================================



Design a relational PostgreSQL schema with appropriate constraints and indexes.



Use UUID primary keys where appropriate.



Create the following tables.



TABLE 1: profiles



Fields:

- id, linked to the authenticated Supabase user

- full_name

- email

- role

- created_at

- updated_at



TABLE 2: applications



Fields:

- id

- application_number

- institution_name

- institution_type

- institution_address

- state

- district

- contact_person

- contact_email

- contact_phone

- institution_registration_number

- application_title

- external_reference_number

- academic_year

- application_category

- description

- additional_notes

- status

- created_by

- submitted_at

- assigned_reviewer_id

- created_at

- updated_at



TABLE 3: documents



Fields:

- id

- application_id

- file_name

- storage_path

- mime_type

- file_size

- document_category

- uploaded_by

- version_number

- sha256_hash, if implemented

- ocr_status

- extracted_text

- extracted_fields as JSONB

- extraction_confidence, where available

- uploaded_at

- updated_at



TABLE 4: document_requirements



Fields:

- id

- document_category

- requirement_name

- description

- required

- active

- created_at

- updated_at



Do not imply these prototype requirements are official AICTE rules.



TABLE 5: verification_runs



Fields:

- id

- application_id

- run_number

- status

- checks_performed

- checks_passed

- findings_count

- started_at

- completed_at

- error_message

- executed_by



TABLE 6: verification_findings



Fields:

- id

- verification_run_id

- application_id

- document_id, nullable

- rule_code

- category

- severity

- field_name

- application_value

- document_value

- explanation

- recommended_action

- finding_status

- resolution_comment

- created_at

- resolved_at

- resolved_by



TABLE 7: application_status_history



Fields:

- id

- application_id

- previous_status

- new_status

- changed_by

- reason

- created_at



TABLE 8: review_comments



Fields:

- id

- application_id

- author_id

- comment

- visibility

- created_at



TABLE 9: notifications



Fields:

- id

- user_id

- application_id, nullable

- title

- message

- notification_type

- read_at

- created_at



TABLE 10: report_history



Fields:

- id

- application_id

- generated_by

- report_type

- generated_at



Add appropriate foreign keys, indexes, validation constraints, and timestamps.



Use database migrations or Supabase migrations for schema changes.



Do not rely only on frontend validation for security.



==================================================

SECTION 15: ROW LEVEL SECURITY AND STORAGE SECURITY

==================================================



Enable Row Level Security on every table containing application or user data.



Implement and test policies.



Institution users:

- Can read and update only their own permitted applications.

- Can create applications for their own account.

- Can upload and access documents belonging to their applications.

- Can read their own notifications.

- Cannot update their own role.

- Cannot assign themselves reviewers.

- Cannot make administrative decisions.

- Cannot read private reviewer-only comments.

- Cannot access other institutions' verification data.



Reviewers:

- Can access assigned applications according to their role.

- Can view the documents needed for their review.

- Can add authorized review comments.

- Cannot assign themselves unrestricted access.

- Cannot grant administrative roles.

- Cannot make final administrative decisions unless explicitly authorized.



Admins:

- Can access applications and perform authorized administrative actions.



Storage policies must enforce the same ownership and role restrictions.



Use private storage and short-lived signed URLs.



Never treat a hidden frontend button as sufficient authorization.



Prevent users from changing application ownership by modifying request payloads.



If application creation or role assignment requires privileged operations,

implement them through trusted backend logic.



==================================================

SECTION 16: APPLICATION VERIFICATION ENGINE

==================================================



Create a reusable verification service rather than placing all verification

logic directly inside React components.



Suggested logical modules:



1. documentProcessor

2. pdfTextExtractor

3. imageOcrProcessor

4. fieldExtractor

5. applicationValidator

6. complianceRuleChecker

7. findingManager

8. reportGenerator

9. notificationService

10. auditService



Recommended process:



A. Validate the submitted form.

B. Confirm the required document categories.

C. Read available extracted document information.

D. Check whether OCR completed successfully.

E. Compare institution names and reference numbers where available.

F. Compare academic-year information where available.

G. Check applicable dates.

H. Identify unresolved missing information.

I. Create verification findings.

J. Save verification run results.

K. Generate a summary.

L. Route the application to action_required or manual_review.

M. Preserve the result for reviewer inspection.



Handle processing errors safely.



If OCR fails, do not assume that all documents are invalid.



Display:

"Document processing failed. Please retry or request manual review."



If a value is unavailable, do not automatically generate a mismatch.



The engine must produce explainable results.



Ensure repeated verification runs do not create uncontrolled duplicate findings.

Each run should have its own identifier and preserve prior results.



==================================================

SECTION 17: FUNCTIONALITY REQUIREMENTS

==================================================



Every relevant control must work.



Examples:



- Login authenticates the user.

- Register creates an authenticated account.

- Forgot Password initiates a real reset flow.

- Create Application saves a draft to PostgreSQL.

- Upload Document uploads a real file to private storage.

- Preview Document opens the authorized file.

- Run Verification performs real configured checks.

- View Findings displays stored findings.

- Resolve Finding records an authorized resolution.

- Submit Application saves the correct status.

- Request Correction records a reason and updates the status.

- Replace Document preserves the prior version history.

- Download Report produces an actual PDF.

- Mark Notification Read updates the database.

- Admin Assign Reviewer persists the assignment.

- Filters and search operate on real records.

- Logout ends the session.



Include useful loading states, empty states, success messages, and errors.



Handle expired sessions, failed uploads, network problems, and verification errors.



Do not hide application errors behind generic success messages.



==================================================

SECTION 18: SAMPLE DATA AND TESTING

==================================================



Provide an optional development-only demo setup.



Clearly separate demo records from production data.



Do not create a public hardcoded admin account.



Do not use a fake authentication bypass.



Do not show fake verification success for unprocessed documents.



For testing, provide sample application data and instructions for using

non-sensitive sample documents.



Create test scenarios for:



TEST 1:

Institution submits all required fields and required documents.



Expected:

Application is stored and submitted successfully.



TEST 2:

Required document is missing.



Expected:

The application displays the missing category and prevents submission

when that document is mandatory.



TEST 3:

PDF contains selectable text.



Expected:

PDF text extraction works and extracted fields can be reviewed.



TEST 4:

Image contains readable text.



Expected:

OCR processes the image and shows the extraction result.



TEST 5:

Application institution name differs from extracted document institution name.



Expected:

The application receives an explainable mismatch finding.



TEST 6:

A document contains no extractable text.



Expected:

OCR or extraction failure is displayed clearly; the application does not

claim successful verification.



TEST 7:

Institution user attempts to access another user's application.



Expected:

Access is denied at the database/storage authorization level.



TEST 8:

Institution user attempts to assign themselves the admin role.



Expected:

The role change is rejected.



TEST 9:

Authorized admin records a decision.



Expected:

The status, decision reason, decision maker, and timestamp are stored.



TEST 10:

User downloads a verification report.



Expected:

The generated PDF contains the actual current application and verification

data, along with the required disclaimer.



TEST 11:

A previously uploaded document is replaced.



Expected:

The new document is available and the previous version's history is preserved.



TEST 12:

Application is submitted with low-confidence or unavailable OCR fields.



Expected:

The result clearly indicates manual review or incomplete verification

rather than making unsupported claims.



==================================================

SECTION 19: PERFORMANCE AND ACCESSIBILITY

==================================================



Implement:

- Responsive layouts.

- Pagination for large tables.

- Search and filtering.

- Debounced search where appropriate.

- Loading indicators.

- Accessible form labels.

- Keyboard-accessible controls.

- Clear validation messages.

- Efficient database queries.

- Sensible error boundaries.

- No unnecessary page reloads.



Keep OCR processing responsive by using progress indicators and allowing

the user to understand whether processing is still running.



Do not block unrelated page interactions unnecessarily.



==================================================

SECTION 20: OUT OF SCOPE FOR PHASE 1

==================================================



Do not attempt to implement all future advanced functionality now.



Keep the code modular so these features can be added in later phases:



- AI conversational compliance assistant.

- Advanced AI-based fraud analysis.

- Sophisticated document tampering detection.

- External official API integrations.

- Dynamic advanced compliance rule builder.

- Advanced risk scoring.

- Multilingual AI document interpretation.

- Advanced analytics and predictive models.



Do not simulate integrations with external services that have not been configured.



==================================================

SECTION 21: FINAL ACCEPTANCE CRITERIA

==================================================



Phase 1 is considered complete only when:



1. The application builds without TypeScript errors.

2. The interface works on desktop and mobile.

3. Supabase authentication is functional.

4. User roles and protected routes work.

5. PostgreSQL data persists correctly.

6. Row Level Security is enabled and tested.

7. Private document uploads work.

8. PDF text extraction works for supported digital PDFs.

9. OCR works for supported images and scanned PDFs.

10. Extracted information can be reviewed and corrected.

11. Configured document validation checks work.

12. Mismatches generate explainable findings.

13. Institution and admin dashboards use real database data.

14. Application status changes are recorded.

15. Admin review and correction requests work.

16. PDF reports are genuinely generated and downloadable.

17. Unauthorized users cannot access restricted documents or application data.

18. Errors are handled transparently.

19. No critical functionality depends on fake data or placeholder buttons.

20. Setup and deployment instructions are provided.



FINAL INSTRUCTIONS

==================



Start by inspecting the available project structure and checking whether

Supabase has already been connected.



Then implement Phase 1 in manageable steps.



Create the database schema and security policies before relying on database

features in the interface.



After implementation, run the available checks and fix errors.



If a required external service or credential is missing, explain exactly

what is needed and provide a clear setup path. Do not silently substitute

mock results.



At the end, provide:

- Features completed.

- Database tables created.

- Storage configuration.

- Security policies implemented.

- Environment variables required.

- External services requiring configuration.

- Steps to run and test the application.

- Known limitations.



Build this as a functional, maintainable, secure software MVP suitable

for a hackathon prototype.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://veri-verify-compass.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/52030722-016d-4fdc-8158-354c4d357b2f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
