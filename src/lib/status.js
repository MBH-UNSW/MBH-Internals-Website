export const STATUS = {
  draft: { label: 'Draft', cls: 'st-draft', hint: 'Only you can see this' },
  submitted: { label: 'Waiting for reviewer', cls: 'st-wait', hint: 'A lead will pick this up' },
  in_review: { label: 'In review', cls: 'st-rev', hint: 'A lead is reviewing' },
  changes_requested: { label: 'Changes requested', cls: 'st-chg', hint: 'Sent back to the designer' },
  approved: { label: 'Approved', cls: 'st-ok', hint: 'Signed off by a lead' },
}

export const SCOPES = {
  schematic: { label: 'Schematic', desc: 'Connections, components, power, interfaces' },
  layout: { label: 'PCB layout', desc: 'Placement, routing, grounding, fabrication' },
  bionic: { label: 'Bionic Heart specifics', desc: 'Safety, motors, sensing, wireless power, fault handling (mark N/A with a reason if not relevant)' },
}

export const EVENT_TEXT = {
  created: 'created the request',
  submitted: 'submitted for review',
  started: 'started the review',
  changes_requested: 'requested changes',
  resubmitted: 'resubmitted',
  approved: 'approved',
}

export const ago = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
