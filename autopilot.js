import express from 'express'
import { supabase } from '../services/db.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.get('/', authenticate, async (req, res) => {
  const { data } = await supabase.from('autopilot_schedules').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false })
  res.json({ schedules: data || [] })
})

router.post('/', authenticate, async (req, res) => {
  const { topic, style, duration, frequency, time } = req.body
  if (!topic) return res.status(400).json({ error: 'Topic required' })
  const { data, error } = await supabase.from('autopilot_schedules').insert({
    user_id: req.user.id, topic, style, duration, frequency, time, active: true
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/:id', authenticate, async (req, res) => {
  const { active } = req.body
  const { data, error } = await supabase.from('autopilot_schedules').update({ active }).eq('id', req.params.id).eq('user_id', req.user.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('autopilot_schedules').delete().eq('id', req.params.id).eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
