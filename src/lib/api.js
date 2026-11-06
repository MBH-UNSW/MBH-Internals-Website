import { supabase } from './supabase.js'

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message.replace(/^.*?exception:\s*/i, ''))
  return data
}

/** Call a database workflow function (all writes go through these). */
export const rpc = async (fn, args = {}) => unwrap(await supabase.rpc(fn, args))

export async function listReviews() {
  const [reviews, progress] = await Promise.all([
    supabase.from('reviews').select('*').order('updated_at', { ascending: false }).then(unwrap),
    supabase.rpc('review_progress').then(unwrap),
  ])
  const p = Object.fromEntries(progress.map((x) => [x.review_id, x]))
  return reviews.map((r) => ({ ...r, progress: p[r.id] }))
}

export async function getReview(id) {
  const [review, items, comments, events] = await Promise.all([
    supabase.from('reviews').select('*').eq('id', id).maybeSingle().then(unwrap),
    supabase.from('review_items').select('item_id,self_status,lead_status').eq('review_id', id).then(unwrap),
    supabase.from('comments').select('*').eq('review_id', id).order('id').then(unwrap),
    supabase.from('events').select('*').eq('review_id', id).order('id').then(unwrap),
  ])
  if (!review) return null
  return { review, items: Object.fromEntries(items.map((i) => [i.item_id, i])), comments, events }
}

export async function listNotifications() {
  return unwrap(await supabase.from('notifications').select('*').order('id', { ascending: false }).limit(30))
}
