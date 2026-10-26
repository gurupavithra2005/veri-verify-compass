<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# VeriAI — Architecture & Conventions

- **Pathless protected layout must keep children.** `src/routes/_authenticated/route.tsx` is the
  integration-managed auth gate. If it ever has no child route files, the router generator treats
  it as claiming "/" and the build fails with a duplicate-route conflict against
  `src/routes/index.tsx`. When removing pages under `_authenticated/`, leave at least one child.
- **Roles live only in `public.user_roles`** (institution_user default via signup trigger;
  admin/reviewer granted through trusted server-side operations only). Never read roles from
  client-editable metadata; check with `has_role` / `is_staff` RPCs or the `useRoles` hook.
- **Server functions** use `createServerFn` + `requireSupabaseAuth` middleware; admin-only
  operations re-verify `has_role(_user_id, 'admin')` inside the handler. Frontend gating is UX
  only — never the authorization layer.
- **Documents**: private storage bucket `application-documents`, object path
  `{applicationId}/{file}`; access via short-lived signed URLs created by the owning session.
  Extraction runs locally in the browser (pdfjs-dist for digital PDFs, tesseract.js OCR for
  images/scans); nothing is sent to external services.
- **Verification findings never approve or reject** — only an admin `recordDecision` can set
  verified/rejected. Findings are labeled "Potential Inconsistency — Manual Review Required".
- **Extraction module quirk**: `searchAfterLabel` in `src/lib/extraction/field-extractor.ts` must
  read the LAST regex capture group (label patterns may contain their own groups) and trims
  values at the next known field label (`NEXT_LABEL_SPLIT`) because PDF text layers join whole
  pages onto one line.
