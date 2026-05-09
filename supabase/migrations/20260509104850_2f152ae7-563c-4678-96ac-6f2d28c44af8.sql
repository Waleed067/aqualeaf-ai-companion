
drop policy if exists "scans_public_read" on storage.objects;
create policy "scans_owner_select" on storage.objects for select using (
  bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
