import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { configured, demo, supabase } from './supabase.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [people, setPeople] = useState({})
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) { setPeople({}); setLoading(false) }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id
  const refreshPeople = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('id,name,email,role').order('name')
    if (error) throw new Error(error.message)
    setPeople(Object.fromEntries(data.map((p) => [p.id, p])))
  }, [])

  useEffect(() => {
    if (!uid) return
    refreshPeople().catch(() => {}).finally(() => setLoading(false))
  }, [uid, refreshPeople])

  const value = useMemo(() => ({
    configured,
    demo,
    loading,
    uid,
    me: uid ? people[uid] || null : null,
    people,
    refreshPeople,
    nameOf: (id) => people[id]?.name || 'Someone',
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signUp({ name, email, password, teamCode }) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, team_code: teamCode } } })
      if (error) {
        if (/database error/i.test(error.message)) throw new Error('Could not create the account. Check the team code.')
        throw new Error(error.message)
      }
      return { needsEmailConfirm: !data.session }
    },
    signOut: () => supabase.auth.signOut(),
  }), [loading, uid, people, refreshPeople])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
