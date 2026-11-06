// Runs the real schema.sql in an in-process Postgres (PGlite) and walks the whole review workflow.
// Run with:  npm run test:db
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
const db = new PGlite()

// --- minimal stand-in for what Supabase provides
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`)
await db.exec(read('../schema.sql'))
await db.exec(read('../seed_checklist.sql'))
await db.exec(`insert into app_settings values ('team_code', 'heart2026')`)

const as = async (uid) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false)`) }
const signup = async (email, code = 'heart2026') => {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify({ name: email.split('@')[0], team_code: code })])
  return r.rows[0].id
}
const call = (fn, ...args) => db.query(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(',')}) as r`, args).then((x) => x.rows[0].r)
const rejects = (p, re) => assert.rejects(p, re)

const items = (await db.query(`select id, list, priority from checklist_items where list = 'schematic'`)).rows
let designer, lead, other, rid

test('sign-up needs the team code; first lead promoted by SQL', async () => {
  await assert.rejects(signup('outsider@x.com', 'wrong'), /Invalid team code/)
  designer = await signup('alex@x.com')
  lead = await signup('sam@x.com')
  other = await signup('jo@x.com')
  await db.query(`update profiles set role = 'lead' where id = $1`, [lead])
  assert.equal((await db.query(`select count(*)::int c from profiles`)).rows[0].c, 3)
})

test('designer creates a draft and nobody else can see it', async () => {
  await as(designer)
  rid = await call('create_review', 'TAH Controller', 'Main', 'B', ['schematic'], 'https://example.com/a365', 'notes')
  await db.exec(`set role authenticated`)
  assert.equal((await db.query(`select count(*)::int c from reviews`)).rows[0].c, 1)
  await as(lead); await db.exec(`set role authenticated`)
  assert.equal((await db.query(`select count(*)::int c from reviews`)).rows[0].c, 0, 'leads must not see drafts')
  await as(other); await db.exec(`set role authenticated`)
  assert.equal((await db.query(`select count(*)::int c from reviews`)).rows[0].c, 0)
})

test('direct writes are blocked', async () => {
  await as(designer); await db.exec(`set role authenticated`)
  await assert.rejects(db.query(`update reviews set status = 'approved'`), /permission denied/)
  await assert.rejects(db.query(`update profiles set role = 'lead'`), /permission denied/)
  await assert.rejects(db.query(`insert into review_items (review_id, item_id, lead_status) values ('${rid}', '${items[0].id}', 'ok')`), /permission denied/)
})

test('cannot submit with open items; N/A needs a comment', async () => {
  await as(designer)
  await rejects(call('submit_review', rid), /still open/)
  for (const it of items) await call('set_self_status', rid, it.id, 'verified')
  await call('set_self_status', rid, items[0].id, 'na')
  await rejects(call('submit_review', rid), /need a comment/)
  await call('add_comment', rid, items[0].id, 'No buses in this design')
  await rejects(call('set_self_status', rid, 'l001', 'verified'), /not part of this review/)
})

test('submit notifies leads and locks the designer out', async () => {
  await as(designer)
  await call('submit_review', rid)
  const n = (await db.query(`select user_id from notifications where review_id = $1`, [rid])).rows
  assert.deepEqual(n.map((x) => x.user_id), [lead])
  await rejects(call('set_self_status', rid, items[1].id, 'issue'), /locked/)
  await rejects(call('add_comment', rid, null, 'hi'), /locked/)
  await as(lead); await db.exec(`set role authenticated`)
  assert.equal((await db.query(`select count(*)::int c from reviews`)).rows[0].c, 1, 'lead sees submitted review')
  await as(other); await db.exec(`set role authenticated`)
  assert.equal((await db.query(`select count(*)::int c from reviews`)).rows[0].c, 0, 'unrelated designer still sees nothing')
})

test('only a lead (not the designer) can start; must start before reviewing', async () => {
  await as(designer)
  await rejects(call('start_review', rid), /Only leads/)
  await as(other)
  await rejects(call('start_review', rid), /Only leads/)
  await as(lead)
  await rejects(call('set_lead_status', rid, items[0].id, 'ok'), /Start the review/)
  await call('start_review', rid)
  assert.equal((await db.query(`select status from reviews where id = $1`, [rid])).rows[0].status, 'in_review')
})

test('cannot approve until critical items are confirmed; request changes needs comments', async () => {
  await as(lead)
  await rejects(call('decide_review', rid, 'approve', ''), /critical item/)
  const crit = items.filter((i) => i.priority === 'C')
  const flagged = crit[0].id
  await call('lead_accept_remaining', rid)
  await call('set_lead_status', rid, flagged, 'issue')
  await rejects(call('decide_review', rid, 'approve', ''), /unresolved issue/)
  await rejects(call('decide_review', rid, 'changes', 'fix it'), /Add a comment/)
  await call('add_comment', rid, flagged, 'Pull-up goes to 5V but the sensor is 3.3V')
  await call('decide_review', rid, 'changes', 'One critical problem')
  const r = (await db.query(`select status, round from reviews where id = $1`, [rid])).rows[0]
  assert.deepEqual(r, { status: 'changes_requested', round: 1 })
  const n = (await db.query(`select text from notifications where user_id = $1 order by id desc limit 1`, [designer])).rows[0]
  assert.match(n.text, /changes requested/)
  globalThis.flagged = flagged
})

test('designer sees the lead feedback, must reply, then resubmits as round 2', async () => {
  await as(designer); await db.exec(`set role authenticated`)
  const seen = (await db.query(`select body from comments where review_id = $1 and author_role = 'lead'`, [rid])).rows
  assert.equal(seen.length, 1)
  await as(designer)
  await rejects(call('submit_review', rid), /Reply to the 1 item/)
  await call('add_comment', rid, globalThis.flagged, 'Moved the pull-up to 3V3')
  await call('submit_review', rid)
  const r = (await db.query(`select status, round from reviews where id = $1`, [rid])).rows[0]
  assert.deepEqual(r, { status: 'submitted', round: 2 })
  const n = (await db.query(`select text from notifications where user_id = $1 order by id desc limit 1`, [lead])).rows[0]
  assert.match(n.text, /resubmitted/)
  const li = (await db.query(`select lead_status from review_items where review_id = $1 and item_id = $2`, [rid, globalThis.flagged])).rows[0]
  assert.equal(li.lead_status, null, 'flagged item must be re-reviewed')
})

test('lead approves round 2; designer is notified; state is final', async () => {
  await as(lead)
  await call('start_review', rid)
  await call('lead_accept_remaining', rid)
  await call('set_lead_status', rid, globalThis.flagged, 'ok')
  await call('decide_review', rid, 'approve', 'Looks good')
  assert.equal((await db.query(`select status from reviews where id = $1`, [rid])).rows[0].status, 'approved')
  const n = (await db.query(`select text from notifications where user_id = $1 order by id desc limit 1`, [designer])).rows[0]
  assert.match(n.text, /approved/)
  await as(designer)
  await rejects(call('set_self_status', rid, items[2].id, 'issue'), /locked/)
  await rejects(call('delete_review', rid), /Only drafts/)
})

test('leads cannot review their own design; roles are protected', async () => {
  await as(lead)
  const mine = await call('create_review', 'Lead board', '', '', ['schematic'], null, '')
  for (const it of items) await call('set_self_status', mine, it.id, 'verified')
  await call('submit_review', mine)
  await rejects(call('start_review', mine), /own design/)
  await as(designer)
  await rejects(call('set_role', designer, 'lead'), /Only leads/)
  await as(lead)
  await rejects(call('set_role', lead, 'designer'), /at least one lead/)
  await call('set_role', other, 'lead')
})

test('bad input is rejected', async () => {
  await as(designer)
  await rejects(call('create_review', '', '', '', ['schematic'], null, ''), /Project name/)
  await rejects(call('create_review', 'x', '', '', ['nope'], null, ''), /valid|Choose/)
  await rejects(call('create_review', 'x', '', '', ['schematic'], 'javascript:alert(1)', ''), /check constraint|violates/)
  await as(null)
  await rejects(call('create_review', 'x', '', '', ['schematic'], null, ''), /Not signed in/)
})

test('dashboard progress counts respect row security', async () => {
  await as(designer); await db.exec(`set role authenticated`)
  const mine = (await db.query(`select * from review_progress()`)).rows
  assert.equal(mine.length, 1)
  assert.equal(mine[0].answered, mine[0].total)
  await as(other); await db.exec(`set role authenticated`)
  const jo = (await db.query(`select * from review_progress()`)).rows
  assert.ok(jo.every((r) => r.total > 0))
})
