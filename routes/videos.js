import express from 'express'
import { supabase } from '../services/db.js'
import { authenticate } from '../middleware/auth.js'
import { generateVideo } from '../services/videoEngine.js'
import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'
dotenv.config()

const router = express.Router()
const CREDIT_COSTS = { 30: 20, 60: 40, 120: 60, 180: 70, 240: 80, 300: 90, 360: 100, 420: 110, 480: 120, 540: 130, 600: 140, 660: 150, 720: 160, 780: 170, 840: 180, 900: 200 }

router.get('/', authenticate, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const { data: videos } = await supabase
    .from('videos').select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  res.json({ videos: videos || [] })
})

router.get('/stats', authenticate, async (req, res) => {
  const { data: all } = await supabase.from('videos').select('id,created_at').eq('user_id', req.user.id)
  const today = new Date(); today.setHours(0,0,0,0)
  const todayVideos = (all || []).filter(v => new Date(v.created_at) >= today)
  res.json({ total: all?.length || 0, today: todayVideos.length, downloads: all?.length || 0 })
})

router.get('/:id', authenticate, async (req, res) => {
  const { data: video } = await supabase.from('videos').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single()
  if (!video) return res.status(404).json({ error: 'Video not found' })
  res.json(video)
})

router.post('/generate', authenticate, async (req, res) => {
  const { topic, style = 'Documentary', duration = 60, voice = 'Male (Deep)' } = req.body
  if (!topic) return res.status(400).json({ error: 'Topic is required' })

  const cost = CREDIT_COSTS[duration] || 60
  if (req.user.role !== 'admin' && req.user.credits < cost) {
    return res.status(400).json({ error: 'Not enough credits' })
  }

  const jobId = uuidv4()
  const title = `${topic.slice(0, 50)} - ${style}`

  // Create video record
  const { data: video, error } = await supabase.from('videos').insert({
    id: jobId, user_id: req.user.id, title, topic, style, duration, voice, status: 'processing'
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })

  // Deduct credits (not for admin)
  if (req.user.role !== 'admin') {
    await supabase.from('users').update({ credits: req.user.credits - cost }).eq('id', req.user.id)
  }

  // Generate video in background
  generateVideo({ topic, style, duration, voice, jobId }).then(async ({ script, videoPath }) => {
    const fileUrl = `/uploads/${jobId}_final.mp4`
    await supabase.from('videos').update({ status: 'done', file_url: fileUrl, script, title }).eq('id', jobId)
  }).catch(async (err) => {
    console.error('Video generation error:', err)
    await supabase.from('videos').update({ status: 'error' }).eq('id', jobId)
    // Refund credits on error
    if (req.user.role !== 'admin') {
      await supabase.from('users').update({ credits: req.user.credits }).eq('id', req.user.id)
    }
  })

  res.json(video)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('videos').delete().eq('id', req.params.id).eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
