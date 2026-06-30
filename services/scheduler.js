import cron from 'node-cron'
import { supabase } from './db.js'
import { generateVideo } from './videoEngine.js'

export function startCreditReset() {
  // Reset credits to 1000 for all regular users every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Resetting daily credits...')
    const { error } = await supabase.from('users').update({ credits: 1000 }).eq('role', 'user')
    if (error) console.error('Credit reset error:', error)
    else console.log('✅ Credits reset for all users')
  })

  // Run autopilot schedules every hour
  cron.schedule('0 * * * *', async () => {
    console.log('🤖 Checking autopilot schedules...')
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    
    const { data: schedules } = await supabase.from('autopilot_schedules').select('*, users(credits, role)').eq('active', true)
    if (!schedules) return

    for (const sched of schedules) {
      if (sched.time !== currentTime) continue
      
      // Check frequency
      const lastRun = sched.last_run ? new Date(sched.last_run) : null
      const shouldRun = checkFrequency(sched.frequency, lastRun, now)
      if (!shouldRun) continue

      const user = sched.users
      const cost = 60
      if (user.role !== 'admin' && user.credits < cost) {
        console.log(`Skipping autopilot for user ${sched.user_id}: not enough credits`)
        continue
      }

      const jobId = require('uuid').v4()
      try {
        await supabase.from('videos').insert({
          id: jobId, user_id: sched.user_id, title: `Auto: ${sched.topic}`,
          topic: sched.topic, style: sched.style, duration: sched.duration,
          voice: 'Male (Deep)', status: 'processing'
        })

        if (user.role !== 'admin') {
          await supabase.from('users').update({ credits: user.credits - cost }).eq('id', sched.user_id)
        }

        generateVideo({ topic: sched.topic, style: sched.style, duration: sched.duration, voice: 'Male (Deep)', jobId }).then(async ({ script, videoPath }) => {
          await supabase.from('videos').update({ status: 'done', file_url: `/uploads/${jobId}_final.mp4`, script }).eq('id', jobId)
        }).catch(async () => {
          await supabase.from('videos').update({ status: 'error' }).eq('id', jobId)
        })

        await supabase.from('autopilot_schedules').update({ last_run: now.toISOString() }).eq('id', sched.id)
        console.log(`✅ Autopilot video queued for: ${sched.topic}`)
      } catch (e) {
        console.error('Autopilot error:', e)
      }
    }
  })

  console.log('✅ Scheduler started (credit reset + autopilot)')
}

function checkFrequency(frequency, lastRun, now) {
  if (!lastRun) return true
  const diff = now - lastRun
  const hour = 3600000
  if (frequency === 'Daily') return diff >= 24 * hour
  if (frequency === 'Every 12 hours') return diff >= 12 * hour
  if (frequency === 'Every 6 hours') return diff >= 6 * hour
  if (frequency === 'Weekly') return diff >= 7 * 24 * hour
  return false
}
