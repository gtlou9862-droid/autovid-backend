
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
dotenv.config()

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })



// Step 1: Generate script with Groq AI (100% free)
export async function generateScript(topic, style, duration) {
  const wordCount = Math.floor(duration * 2.5)
  const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: 'Write a ' + style + ' style video script about: "' + topic + '". The script should be exactly ' + wordCount + ' words for a ' + duration + ' second video. Write ONLY the narration text. No stage directions, no brackets. Make it engaging for YouTube/TikTok. Start directly with the content.'
    }]
  }, {
    headers: {
      'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
      'Content-Type': 'application/json'
    }
  })
  return res.data.choices[0].message.content
}

// Step 2: Generate voiceover using gTTS (free)
export async function generateVoiceover(script, jobId) {
  const audioPath = path.join(UPLOADS_DIR, `${jobId}_audio.mp3`)
  // Use Python gTTS
  const escapedScript = script.replace(/"/g, '\\"').replace(/\n/g, ' ')
  await execAsync(`python3 -c "from gtts import gTTS; tts = gTTS(text=\\"${escapedScript}\\", lang='en'); tts.save('${audioPath}')"`)
  return audioPath
}

// Step 3: Fetch real stock video clips from Pexels
export async function fetchVideoClips(topic, count = 5) {
  const keywords = topic.split(' ').slice(0, 3).join(' ')
  const res = await axios.get('https://api.pexels.com/videos/search', {
    headers: { Authorization: process.env.PEXELS_API_KEY },
    params: { query: keywords, per_page: count, orientation: 'landscape' }
  })
  const videos = res.data.videos || []
  const clips = []
  for (const v of videos.slice(0, count)) {
    const file = v.video_files?.find(f => f.quality === 'sd' && f.width <= 1280) || v.video_files?.[0]
    if (file?.link) clips.push(file.link)
  }
  if (clips.length === 0) throw new Error('No video clips found for this topic. Try a different topic.')
  return clips
}

// Step 4: Download video clips
export async function downloadClips(clipUrls, jobId) {
  const paths = []
  for (let i = 0; i < clipUrls.length; i++) {
    const clipPath = path.join(UPLOADS_DIR, `${jobId}_clip${i}.mp4`)
    const res = await axios({ url: clipUrls[i], method: 'GET', responseType: 'stream' })
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(clipPath)
      res.data.pipe(writer)
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
    paths.push(clipPath)
  }
  return paths
}

// Step 5: Combine clips, add audio, add captions with FFmpeg
export async function renderVideo(clipPaths, audioPath, script, jobId, duration) {
  const outputPath = path.join(UPLOADS_DIR, `${jobId}_final.mp4`)
  const listFile = path.join(UPLOADS_DIR, `${jobId}_list.txt`)

  // Create concat list - loop clips to fill duration
  const clipDuration = Math.ceil(duration / clipPaths.length)
  let listContent = ''
  for (const cp of clipPaths) {
    listContent += `file '${cp}'\n`
  }
  fs.writeFileSync(listFile, listContent)

  // Build subtitle/caption content
  const words = script.split(' ')
  const wordsPerSub = 8
  let srtContent = ''
  let subIndex = 1
  const timePerSub = duration / Math.ceil(words.length / wordsPerSub)
  
  for (let i = 0; i < words.length; i += wordsPerSub) {
    const chunk = words.slice(i, i + wordsPerSub).join(' ')
    const startSec = (i / wordsPerSub) * timePerSub
    const endSec = startSec + timePerSub
    srtContent += `${subIndex}\n${formatSRT(startSec)} --> ${formatSRT(endSec)}\n${chunk}\n\n`
    subIndex++
  }
  const srtPath = path.join(UPLOADS_DIR, `${jobId}.srt`)
  fs.writeFileSync(srtPath, srtContent)

  // FFmpeg command: concat clips + audio + captions
  const ffmpegCmd = `ffmpeg -y \
    -f concat -safe 0 -i "${listFile}" \
    -i "${audioPath}" \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,subtitles='${srtPath}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Alignment=2'" \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 128k \
    -shortest \
    -t ${duration} \
    "${outputPath}"`

  await execAsync(ffmpegCmd, { timeout: 300000 })

  // Cleanup temp files
  try {
    fs.unlinkSync(listFile)
    fs.unlinkSync(srtPath)
    fs.unlinkSync(audioPath)
    for (const cp of clipPaths) fs.unlinkSync(cp)
  } catch {}

  return outputPath
}

function formatSRT(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`
}

// Main generation function
export async function generateVideo({ topic, style, duration, voice, jobId }) {
  const script = await generateScript(topic, style, duration)
  const audioPath = await generateVoiceover(script, jobId)
  const clipUrls = await fetchVideoClips(topic, 6)
  const clipPaths = await downloadClips(clipUrls, jobId)
  const videoPath = await renderVideo(clipPaths, audioPath, script, jobId, duration)
  return { script, videoPath }
}
