import jwt from 'jsonwebtoken'
import { supabase } from '../services/db.js'

export async function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    const { data: user } = await supabase.from('users').select('*').eq('id', payload.id).single()
    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  next()
}
