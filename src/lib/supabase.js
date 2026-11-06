import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Demo mode (npm run dev:demo) swaps in a local in-browser database so the workflow can be tried with no backend.
export const demo = import.meta.env.VITE_DEMO === '1'
// The anon key is public by design. What it can do is limited by the database's row-level security.
export const configured = demo || Boolean(url && key)
export const supabase = demo ? (await import('./demo.js')).createDemoClient() : configured ? createClient(url, key) : null
