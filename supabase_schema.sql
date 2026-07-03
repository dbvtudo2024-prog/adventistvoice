-- ====================================================================
-- SUPABASE SCHEMAS FOR ADVENTIST VOICE KARAOKE
-- ====================================================================
-- Copy and run this script inside the "SQL Editor" of your Supabase dashboard
-- (https://supabase.com) to create the custom songs table with correct columns 
-- and public Row-Level Security (RLS) policies.

-- 1. Create the custom_songs table
CREATE TABLE IF NOT EXISTS public.custom_songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  number_or_year TEXT NOT NULL,
  artist TEXT NOT NULL,
  bpm INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  lyrics JSONB NOT NULL,
  melody JSONB NOT NULL,
  description TEXT,
  language TEXT,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS) so Supabase permits traffic
ALTER TABLE public.custom_songs ENABLE ROW LEVEL SECURITY;

-- 3. Create public access policies so all singers can list, add, and edit custom songs
CREATE POLICY "Allow anyone to read custom songs" 
ON public.custom_songs 
FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Allow anyone to insert custom songs" 
ON public.custom_songs 
FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Allow anyone to update custom songs" 
ON public.custom_songs 
FOR UPDATE 
TO public 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow anyone to delete custom songs" 
ON public.custom_songs 
FOR DELETE 
TO public 
USING (true);
