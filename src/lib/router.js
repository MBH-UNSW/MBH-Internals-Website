import { useEffect, useState } from 'react'

const read = () => location.hash.replace(/^#/, '') || '/'
export const go = (path) => { location.hash = path }

export function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
