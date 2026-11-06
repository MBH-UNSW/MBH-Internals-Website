export default function Heart({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#c60c0c" d="M14 10c3-4 8-3 10 1 3-3 8-3 10 2 9-1 22 7 22 24 0 14-14 24-23 27C24 59 8 48 8 32c0-6 2-9 5-11-3-3-3-8 1-11z" />
      <circle cx="19" cy="14" r="3" fill="#8f1d1d" />
    </svg>
  )
}
