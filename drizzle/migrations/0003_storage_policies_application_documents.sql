-- Storage RLS for the private application-documents bucket.
-- Path layout: <application_id>/<document row id>/<version>/<filename>

CREATE POLICY "participants_read_application_documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'application-documents'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND (a.created_by = auth.uid() OR public.is_staff(auth.uid()))
  )
);

CREATE POLICY "owner_insert_application_documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'application-documents'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.created_by = auth.uid()
  )
);

CREATE POLICY "owner_update_application_documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'application-documents'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.created_by = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'application-documents'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.created_by = auth.uid()
  )
);

CREATE POLICY "owner_delete_application_documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'application-documents'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.created_by = auth.uid()
  )
);