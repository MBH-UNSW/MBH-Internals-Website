-- ONE-TIME SETUP – run after schema.sql and seed_checklist.sql.
-- 1) Choose the code new members must type to create an account (share it in your team chat):
insert into app_settings (key, value) values ('team_code', 'CHANGE-ME-heart-2026')
on conflict (key) do update set value = excluded.value;

-- 2) After you (the first lead) have created your account in the website, make yourself a lead:
--    update profiles set role = 'lead' where email = 'you@example.com';
--    From then on you can promote other leads from the Team page in the site.
