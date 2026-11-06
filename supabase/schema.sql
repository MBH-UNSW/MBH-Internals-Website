-- UBH PCB Review – database schema, security rules and workflow functions.
-- Run this whole file once in Supabase: SQL Editor → New query → paste → Run.
-- It is safe to re-run (drops and recreates the functions; keeps your data).
--
-- Security model
--   * Nobody writes to tables directly. Every change goes through the functions below,
--     which check who you are, your role and the review's state.
--   * Designers see only their own reviews. Leads also see every submitted review.
--   * Sign-up needs the team code stored in app_settings (see setup.sql).

create table if not exists app_settings (
  key   text primary key,
  value text not null
);
alter table app_settings enable row level security;          -- no policies = nobody but the database owner

create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (length(name) between 1 and 80),
  email      text not null,
  role       text not null default 'designer' check (role in ('designer', 'lead')),
  created_at timestamptz not null default now()
);

create table if not exists checklist_items (
  id       text primary key,
  list     text not null,
  priority text not null check (priority in ('C', 'H', 'M', 'L'))
);

create table if not exists reviews (
  id               uuid primary key default gen_random_uuid(),
  designer_id      uuid not null references profiles (id) on delete cascade,
  project          text not null check (length(project) between 1 and 120),
  board            text not null default '' check (length(board) <= 120),
  revision         text not null default '' check (length(revision) <= 40),
  scopes           text[] not null,
  link             text check (link is null or (length(link) <= 500 and link ~* '^https?://')),
  notes            text not null default '' check (length(notes) <= 2000),
  status           text not null default 'draft'
                   check (status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved')),
  round            int  not null default 1,
  reviewer_id      uuid references profiles (id) on delete set null,
  decision_summary text not null default '' check (length(decision_summary) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  decided_at       timestamptz
);

create table if not exists review_items (
  review_id   uuid not null references reviews (id) on delete cascade,
  item_id     text not null references checklist_items (id) on update cascade,
  self_status text check (self_status in ('verified', 'na', 'issue')),
  lead_status text check (lead_status in ('ok', 'issue')),
  updated_at  timestamptz not null default now(),
  primary key (review_id, item_id)
);

create table if not exists comments (
  id          bigint generated always as identity primary key,
  review_id   uuid not null references reviews (id) on delete cascade,
  item_id     text references checklist_items (id) on update cascade,   -- null = general comment
  author_id   uuid not null references profiles (id) on delete cascade,
  author_role text not null check (author_role in ('designer', 'lead')),
  body        text not null check (length(body) between 1 and 2000),
  round       int  not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_review_idx on comments (review_id);

create table if not exists events (
  id         bigint generated always as identity primary key,
  review_id  uuid not null references reviews (id) on delete cascade,
  actor_id   uuid references profiles (id) on delete set null,
  kind       text not null,
  round      int  not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists events_review_idx on events (review_id);

create table if not exists notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  review_id  uuid references reviews (id) on delete cascade,
  text       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read);

-- ---------------------------------------------------------------- helpers
create or replace function is_lead() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'lead');
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  select value into code from app_settings where key = 'team_code';
  if code is null or coalesce(new.raw_user_meta_data ->> 'team_code', '') <> code then
    raise exception 'Invalid team code';
  end if;
  insert into profiles (id, name, email)
  values (new.id,
          left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 80),
          new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function _label(r reviews) returns text
language sql stable set search_path = public as $$
  select '"' || r.project || case when r.board <> '' then ' – ' || r.board else '' end
         || case when r.revision <> '' then ' rev ' || r.revision else '' end || '"';
$$;

create or replace function _name(u uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name from profiles where id = u), 'Someone');
$$;

create or replace function _notify(p_user uuid, p_review uuid, p_text text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, review_id, text) values (p_user, p_review, p_text);
$$;

create or replace function _notify_leads(p_review uuid, p_text text, p_except uuid) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, review_id, text)
  select id, p_review, p_text from profiles where role = 'lead' and id <> p_except;
$$;

create or replace function _event(p_review uuid, p_kind text, p_round int, p_note text) returns void
language sql security definer set search_path = public as $$
  insert into events (review_id, actor_id, kind, round, note) values (p_review, auth.uid(), p_kind, p_round, coalesce(p_note, ''));
$$;

create or replace function _get_review(p_id uuid) returns reviews
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into r from reviews where id = p_id for update;
  if not found then raise exception 'Review not found'; end if;
  return r;
end $$;

create or replace function _check_item(r reviews, p_item text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from checklist_items where id = p_item and list = any (r.scopes)) then
    raise exception 'That item is not part of this review';
  end if;
end $$;

-- ---------------------------------------------------------------- designer actions
create or replace function create_review(p_project text, p_board text, p_revision text,
                                         p_scopes text[], p_link text, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(p_project), '') = '' then raise exception 'Project name is required'; end if;
  if p_scopes is null or cardinality(p_scopes) = 0
     or exists (select 1 from unnest(p_scopes) s where s not in (select list from checklist_items)) then
    raise exception 'Choose at least one checklist';
  end if;
  insert into reviews (designer_id, project, board, revision, scopes, link, notes)
  values (auth.uid(), trim(p_project), trim(coalesce(p_board, '')), trim(coalesce(p_revision, '')),
          p_scopes, nullif(trim(coalesce(p_link, '')), ''), coalesce(p_notes, ''))
  returning id into rid;
  perform _event(rid, 'created', 1, '');
  return rid;
end $$;

create or replace function update_review(p_id uuid, p_project text, p_board text, p_revision text,
                                         p_link text, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  r := _get_review(p_id);
  if r.designer_id <> auth.uid() then raise exception 'Only the designer can edit this request'; end if;
  if r.status not in ('draft', 'changes_requested') then raise exception 'This request is locked while it is with the reviewer'; end if;
  if coalesce(trim(p_project), '') = '' then raise exception 'Project name is required'; end if;
  update reviews set project = trim(p_project), board = trim(coalesce(p_board, '')),
         revision = trim(coalesce(p_revision, '')), link = nullif(trim(coalesce(p_link, '')), ''),
         notes = coalesce(p_notes, ''), updated_at = now()
   where id = p_id;
end $$;

create or replace function delete_review(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  r := _get_review(p_id);
  if r.designer_id <> auth.uid() then raise exception 'Only the designer can delete this request'; end if;
  if r.status <> 'draft' then raise exception 'Only drafts can be deleted'; end if;
  delete from reviews where id = p_id;
end $$;

create or replace function set_self_status(p_review uuid, p_item text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  r := _get_review(p_review);
  if r.designer_id <> auth.uid() then raise exception 'Only the designer can answer for the designer'; end if;
  if r.status not in ('draft', 'changes_requested') then raise exception 'This request is locked while it is with the reviewer'; end if;
  if p_status is not null and p_status not in ('verified', 'na', 'issue') then raise exception 'Bad status'; end if;
  perform _check_item(r, p_item);
  insert into review_items (review_id, item_id, self_status) values (p_review, p_item, p_status)
  on conflict (review_id, item_id) do update
    set self_status = excluded.self_status,
        -- if the designer changes an answer the lead already accepted, the lead must look again
        lead_status = case when review_items.lead_status = 'ok'
                                and review_items.self_status is distinct from excluded.self_status
                           then null else review_items.lead_status end,
        updated_at = now();
  update reviews set updated_at = now() where id = p_review;
end $$;

create or replace function submit_review(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews; n int; resubmit boolean;
begin
  r := _get_review(p_id);
  if r.designer_id <> auth.uid() then raise exception 'Only the designer can submit'; end if;
  if r.status not in ('draft', 'changes_requested') then raise exception 'Already with the reviewer'; end if;
  resubmit := (r.status = 'changes_requested');

  select count(*) into n from checklist_items ci
   where ci.list = any (r.scopes)
     and not exists (select 1 from review_items ri
                      where ri.review_id = r.id and ri.item_id = ci.id and ri.self_status is not null);
  if n > 0 then raise exception '% item(s) are still open – answer every item first', n; end if;

  select count(*) into n from review_items ri
   where ri.review_id = r.id and ri.self_status in ('na', 'issue')
     and not exists (select 1 from comments c where c.review_id = r.id and c.item_id = ri.item_id and c.author_id = r.designer_id);
  if n > 0 then raise exception '% N/A or Issue item(s) need a comment explaining why', n; end if;

  if resubmit then
    select count(*) into n from review_items ri
     where ri.review_id = r.id and ri.lead_status = 'issue'
       and not exists (select 1 from comments c
                        where c.review_id = r.id and c.item_id = ri.item_id
                          and c.author_id = r.designer_id and c.created_at > r.decided_at);
    if n > 0 then raise exception 'Reply to the % item(s) the reviewer flagged before resubmitting', n; end if;
    update review_items set lead_status = null, updated_at = now()
     where review_id = r.id and lead_status = 'issue';
    update reviews set status = 'submitted', round = round + 1, submitted_at = now(), updated_at = now() where id = r.id;
    perform _event(r.id, 'resubmitted', r.round + 1, '');
    if r.reviewer_id is not null then
      perform _notify(r.reviewer_id, r.id, _name(auth.uid()) || ' resubmitted ' || _label(r) || ' (round ' || (r.round + 1) || ')');
    else
      perform _notify_leads(r.id, _name(auth.uid()) || ' resubmitted ' || _label(r), auth.uid());
    end if;
  else
    update reviews set status = 'submitted', submitted_at = now(), updated_at = now() where id = r.id;
    perform _event(r.id, 'submitted', r.round, '');
    perform _notify_leads(r.id, _name(auth.uid()) || ' requested a review of ' || _label(r), auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------- lead actions
create or replace function start_review(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  r := _get_review(p_id);
  if not is_lead() then raise exception 'Only leads can review'; end if;
  if r.designer_id = auth.uid() then raise exception 'You cannot review your own design'; end if;
  if r.status = 'in_review' and r.reviewer_id = auth.uid() then return; end if;
  if r.status <> 'submitted' then raise exception 'This request is not waiting for review'; end if;
  update reviews set status = 'in_review', reviewer_id = auth.uid(), updated_at = now() where id = r.id;
  perform _event(r.id, 'started', r.round, '');
  perform _notify(r.designer_id, r.id, _name(auth.uid()) || ' started reviewing ' || _label(r));
end $$;

create or replace function set_lead_status(p_review uuid, p_item text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  r := _get_review(p_review);
  if not is_lead() or r.designer_id = auth.uid() then raise exception 'Only the reviewing lead can do this'; end if;
  if r.status <> 'in_review' or r.reviewer_id <> auth.uid() then raise exception 'Start the review first'; end if;
  if p_status is not null and p_status not in ('ok', 'issue') then raise exception 'Bad status'; end if;
  perform _check_item(r, p_item);
  insert into review_items (review_id, item_id, lead_status) values (p_review, p_item, p_status)
  on conflict (review_id, item_id) do update set lead_status = excluded.lead_status, updated_at = now();
  update reviews set updated_at = now() where id = p_review;
end $$;

create or replace function lead_accept_remaining(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r reviews; n int;
begin
  r := _get_review(p_id);
  if not is_lead() or r.designer_id = auth.uid() then raise exception 'Only the reviewing lead can do this'; end if;
  if r.status <> 'in_review' or r.reviewer_id <> auth.uid() then raise exception 'Start the review first'; end if;
  with up as (
    update review_items set lead_status = 'ok', updated_at = now()
     where review_id = r.id and lead_status is null and self_status in ('verified', 'na')
    returning 1)
  select count(*) into n from up;
  return n;
end $$;

create or replace function decide_review(p_id uuid, p_decision text, p_summary text) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews; n int;
begin
  r := _get_review(p_id);
  if not is_lead() or r.designer_id = auth.uid() then raise exception 'Only the reviewing lead can do this'; end if;
  if r.status <> 'in_review' or r.reviewer_id <> auth.uid() then raise exception 'Start the review first'; end if;
  if p_decision not in ('changes', 'approve') then raise exception 'Bad decision'; end if;

  if p_decision = 'changes' then
    select count(*) into n from review_items where review_id = r.id and lead_status = 'issue';
    if n = 0 then raise exception 'Flag at least one item that needs changing, or approve'; end if;
    select count(*) into n from review_items ri
     where ri.review_id = r.id and ri.lead_status = 'issue'
       and not exists (select 1 from comments c where c.review_id = r.id and c.item_id = ri.item_id
                         and c.author_id = auth.uid() and c.round = r.round);
    if n > 0 then raise exception 'Add a comment on each of the % flagged item(s) so the designer knows what to fix', n; end if;
    update reviews set status = 'changes_requested', decided_at = now(), decision_summary = coalesce(p_summary, ''), updated_at = now() where id = r.id;
    perform _event(r.id, 'changes_requested', r.round, coalesce(p_summary, ''));
    perform _notify(r.designer_id, r.id, _name(auth.uid()) || ' sent back ' || _label(r) || ' with changes requested');
  else
    select count(*) into n from review_items where review_id = r.id and (lead_status = 'issue' or self_status = 'issue');
    if n > 0 then raise exception '% item(s) still have an unresolved issue', n; end if;
    select count(*) into n from checklist_items ci
     where ci.list = any (r.scopes) and ci.priority = 'C'
       and not exists (select 1 from review_items ri where ri.review_id = r.id and ri.item_id = ci.id and ri.lead_status = 'ok');
    if n > 0 then raise exception '% critical item(s) have not been confirmed by you yet', n; end if;
    update reviews set status = 'approved', decided_at = now(), decision_summary = coalesce(p_summary, ''), updated_at = now() where id = r.id;
    perform _event(r.id, 'approved', r.round, coalesce(p_summary, ''));
    perform _notify(r.designer_id, r.id, _name(auth.uid()) || ' approved ' || _label(r));
  end if;
end $$;

-- ---------------------------------------------------------------- both
create or replace function add_comment(p_review uuid, p_item text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews; who text; body text := trim(coalesce(p_body, ''));
begin
  r := _get_review(p_review);
  if body = '' then raise exception 'Write something first'; end if;
  if p_item is not null then perform _check_item(r, p_item); end if;
  if r.designer_id = auth.uid() then
    if r.status not in ('draft', 'changes_requested') then raise exception 'This request is locked while it is with the reviewer'; end if;
    who := 'designer';
  elsif is_lead() then
    if r.status <> 'in_review' or r.reviewer_id <> auth.uid() then raise exception 'Start the review first'; end if;
    who := 'lead';
  else
    raise exception 'Not allowed';
  end if;
  insert into comments (review_id, item_id, author_id, author_role, body, round)
  values (r.id, p_item, auth.uid(), who, body, r.round);
end $$;

create or replace function mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read;
$$;

create or replace function set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_lead() then raise exception 'Only leads can change roles'; end if;
  if p_role not in ('designer', 'lead') then raise exception 'Bad role'; end if;
  if p_role = 'designer' and (select count(*) from profiles where role = 'lead' and id <> p_user) = 0 then
    raise exception 'There must be at least one lead';
  end if;
  update profiles set role = p_role where id = p_user;
end $$;

-- progress counts for the dashboard (runs as the caller, so row security still applies)
create or replace function review_progress()
returns table (review_id uuid, total int, answered int, lead_ok int, lead_flagged int, critical_open int)
language sql stable set search_path = public as $$
  select r.id,
    (select count(*)::int from checklist_items ci where ci.list = any (r.scopes)),
    (select count(*)::int from review_items ri where ri.review_id = r.id and ri.self_status is not null),
    (select count(*)::int from review_items ri where ri.review_id = r.id and ri.lead_status = 'ok'),
    (select count(*)::int from review_items ri where ri.review_id = r.id and ri.lead_status = 'issue'),
    (select count(*)::int from checklist_items ci
       where ci.list = any (r.scopes) and ci.priority = 'C'
         and not exists (select 1 from review_items ri where ri.review_id = r.id and ri.item_id = ci.id and ri.lead_status = 'ok'))
  from reviews r;
$$;

-- ---------------------------------------------------------------- row level security
alter table profiles        enable row level security;
alter table checklist_items enable row level security;
alter table reviews         enable row level security;
alter table review_items    enable row level security;
alter table comments        enable row level security;
alter table events          enable row level security;
alter table notifications   enable row level security;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (true);

drop policy if exists items_read on checklist_items;
create policy items_read on checklist_items for select to authenticated using (true);

drop policy if exists reviews_read on reviews;
create policy reviews_read on reviews for select to authenticated
  using (designer_id = auth.uid() or (is_lead() and status <> 'draft'));

drop policy if exists review_items_read on review_items;
create policy review_items_read on review_items for select to authenticated
  using (exists (select 1 from reviews r where r.id = review_id));

drop policy if exists comments_read on comments;
create policy comments_read on comments for select to authenticated
  using (exists (select 1 from reviews r where r.id = review_id));

drop policy if exists events_read on events;
create policy events_read on events for select to authenticated
  using (exists (select 1 from reviews r where r.id = review_id));

drop policy if exists notifications_read on notifications;
create policy notifications_read on notifications for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- privileges
revoke all on all tables in schema public from anon, authenticated;
grant select on profiles, checklist_items, reviews, review_items, comments, events, notifications to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function _label(reviews), _name(uuid), _notify(uuid, uuid, text),
  _notify_leads(uuid, text, uuid), _event(uuid, text, int, text), _get_review(uuid),
  _check_item(reviews, text), handle_new_user() from authenticated;
