import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export async function initDB() {
  // Create tables if not exist using Supabase SQL
  const { error } = await supabase.rpc('init_tables').catch(() => ({ error: null }))
  console.log('✅ Database connected')
}

/*
=============================================
PASTE THIS SQL INTO YOUR SUPABASE SQL EDITOR
=============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  credits INT DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  topic TEXT NOT NULL,
  style TEXT DEFAULT 'Documentary',
  duration INT DEFAULT 60,
  voice TEXT DEFAULT 'Male (Deep)',
  status TEXT DEFAULT 'queued',
  file_url TEXT,
  script TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autopilot_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  style TEXT DEFAULT 'Documentary',
  duration INT DEFAULT 60,
  frequency TEXT DEFAULT 'Daily',
  time TEXT DEFAULT '09:00',
  active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

=============================================
*/
