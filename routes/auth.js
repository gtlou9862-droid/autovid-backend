import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabase } from '../services/db.js'
import { authenticate } from '../middleware/auth.js'
import dotenv from 'dotenv'
dotenv.config()

const router = express.Router()

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' })
  try {
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single()
    if (existing) return res.status(400).json({ error: 'Email already registered' })
    const hash = await bcrypt.hash(password, 10)
    const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user'
    const credits = role === 'admin' ? 999999999 : 1000
    const { data: user, error } = await supabase.from('users').insert({ name, email, password: hash, role, credits }).select().single()
    if (error) throw error
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
    const { password: _, ...safeUser } = user
    res.json({ token, user: safeUser })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single()
    if (!user) return res.status(400).json({ error: 'Invalid email or password' })
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(400).json({ error: 'Invalid email or password' })
    // Reset credits daily if needed (simplified check)
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
    const { password: _, ...safeUser } = user
    res.json({ token, user: safeUser })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/me', authenticate, (req, res) => {
  const { password, ...safeUser } = req.user
  res.json({ user: safeUser })
})

export default router
