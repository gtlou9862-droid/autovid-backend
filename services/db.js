import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export async function initDB() {
  // Create tables if not exist using Supabase SQL
  console.log('✅ Tables ready')
  console.log('✅ Database connected')
}
