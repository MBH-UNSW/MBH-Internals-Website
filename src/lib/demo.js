// DEMO MODE ONLY (npm run dev:demo). Never shipped to production.
// Runs the real supabase/schema.sql in an in-browser Postgres (PGlite) and exposes the small slice of the
// supabase-js API that the app uses, so the whole designer ⇄ lead workflow can be tried with no backend.
import { PGlite } from '@electric-sql/pglite'
import schemaSql from '../../supabase/schema.sql?raw'
import seedSql from '../../supabase/seed_checklist.sql?raw'

const SESSION_KEY = 'ubh-demo-session'
const TEAM_CODE = 'demo'

const db = new PGlite('idb://ubh-demo')
let queue = Promise.resolve()
const exclusive = (fn) => (queue = queue.then(fn, fn))

const ready = (async () => {
  await db.exec(`
    do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}');
    create or replace function auth.uid() returns uuid language sql stable as
      $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    grant usage on schema auth to authenticated, anon;
    grant usage on schema public to authenticated, anon;
    create table if not exists public.demo_pw (email text primary key, pw text not null);
  `)
  await db.exec(schemaSql)
  await db.exec(seedSql)
  await db.exec(`insert into app_settings values ('team_code', '${TEAM_CODE}') on conflict (key) do nothing`)
  const { rows } = await db.query('select count(*)::int c from auth.users')
  if (rows[0].c === 0) {
    for (const [name, email, lead] of [['Alex Designer', 'alex@demo.test', false], ['Sam Lead', 'sam@demo.test', true], ['Jo Designer', 'jo@demo.test', false]]) {
      const u = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify({ name, team_code: TEAM_CODE })])
      await db.query(`insert into public.demo_pw values ($1, 'demo1234')`, [email])
      if (lead) await db.query(`update profiles set role = 'lead' where id = $1`, [u.rows[0].id])
    }
  }
})()

let uid = localStorage.getItem(SESSION_KEY)
const listeners = new Set()
const session = () => (uid ? { user: { id: uid } } : null)
const setSession = (id) => {
  uid = id
  id ? localStorage.setItem(SESSION_KEY, id) : localStorage.removeItem(SESSION_KEY)
  listeners.forEach((cb) => cb('SIGNED_IN', session()))
}

/** run sql as the signed-in user (row security applies, like the real thing) */
const asUser = (sql, params = []) =>
  exclusive(async () => {
    await ready
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role authenticated;`)
    try {
      return await db.query(sql, params)
    } finally {
      await db.exec('reset role')
    }
  })

const wrap = (p) => p.then((data) => ({ data, error: null }), (e) => ({ data: null, error: { message: String(e.message || e) } }))

class Query {
  constructor(table) { this.table = table; this.cols = '*'; this.where = []; this.params = []; this.ord = ''; this.lim = ''; this.one = false }
  select(c = '*') { this.cols = c; return this }
  eq(c, v) { this.params.push(v); this.where.push(`"${c}" = $${this.params.length}`); return this }
  in(c, arr) { this.params.push(arr); this.where.push(`"${c}" = any($${this.params.length})`); return this }
  order(c, { ascending = true } = {}) { this.ord = ` order by "${c}" ${ascending ? 'asc' : 'desc'}`; return this }
  limit(n) { this.lim = ` limit ${Number(n)}`; return this }
  maybeSingle() { this.one = true; return this }
  then(res, rej) {
    const sql = `select ${this.cols} from public."${this.table}"${this.where.length ? ' where ' + this.where.join(' and ') : ''}${this.ord}${this.lim}`
    return wrap(asUser(sql, this.params).then((r) => (this.one ? r.rows[0] ?? null : r.rows))).then(res, rej)
  }
}

export function createDemoClient() {
  return {
    auth: {
      async getSession() { await ready; return { data: { session: session() } } },
      onAuthStateChange(cb) {
        listeners.add(cb)
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
      },
      async signInWithPassword({ email, password }) {
        await ready
        const r = await db.query(`select u.id from auth.users u join public.demo_pw p on p.email = u.email where u.email = $1 and p.pw = $2`, [email, password])
        if (!r.rows[0]) return { error: { message: 'Invalid login credentials' } }
        setSession(r.rows[0].id)
        return { error: null }
      },
      async signUp({ email, password, options }) {
        await ready
        try {
          const u = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(options?.data || {})])
          await db.query(`insert into public.demo_pw values ($1, $2)`, [email, password])
          setSession(u.rows[0].id)
          return { data: { session: session() }, error: null }
        } catch (e) {
          return { data: null, error: { message: /Invalid team code/.test(e.message) ? 'Database error saving new user' : e.message } }
        }
      },
      async signOut() { setSession(null); return { error: null } },
    },
    from: (table) => new Query(table),
    rpc(fn, args = {}) {
      const keys = Object.keys(args)
      const call = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`
      return wrap(
        asUser(call, keys.map((k) => (args[k] === '' && k === 'p_link' ? null : args[k]))).then((r) => {
          const f = r.fields
          return f.length === 1 && f[0].name === fn ? r.rows[0]?.[fn] ?? null : r.rows
        }),
      )
    },
  }
}
