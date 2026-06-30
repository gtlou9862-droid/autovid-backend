import express from 'express'
import { supabase } from '../services/db.js'
import { authenticate, adminOnly } from '../middleware/auth.js'

const router = express.Router()
router.use(authenticate, adminOnly)

router.get('/stats', async (req, res) => {
  const [{ count: totalUsers }, { count: totalVideos }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
  ])
  const today = new Date(); today.setHours(0,0,0,0)
  const { count: videosToday } = await supabase.from('videos').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString())
  res.json({ totalUsers, totalVideos, videosToday })
})

router.get('/users', async (req, res) => {
  const { data: users } = await supabase.from('users').select('id,name,email,role,credits,created_at').order('created_at', { ascending: false })
  // Get video counts
  const usersWithCounts = await Promise.all((users || []).map(async u => {
    const { count } = await supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
    return { ...u, videoCount: count }
  }))
  res.json({ users: usersWithCounts })
})

router.patch('/users/:id/credits', async (req, res) => {
  const { credits } = req.body
  const { data, error } = await supabase.from('users').update({ credits }).eq('id', req.params.id).select('id,name,credits').single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body
  const { data, error } = await supabase.from('users').update({ role }).eq('id', req.params.id).select('id,name,role').single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/users/:id', async (req, res) => {
  const { error } = await supabase.from('users').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
