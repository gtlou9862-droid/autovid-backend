import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import videoRoutes from './routes/videos.js'
import autopilotRoutes from './routes/autopilot.js'
import adminRoutes from './routes/admin.js'
import { initDB } from './services/db.js'
import { startCreditReset } from './services/scheduler.js'

dotenv.config()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/videos', videoRoutes)
app.use('/api/autopilot', autopilotRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }))

const PORT = process.env.PORT || 5000

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ AutoVid server running on port ${PORT}`)
    startCreditReset()
  })
}).catch(err => {
  console.error('Failed to init DB:', err)
  process.exit(1)
})

export default app
