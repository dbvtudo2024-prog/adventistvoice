import { createClient } from "@supabase/supabase-js";
import { Song } from "../types";

const URL_KEY = "adventist_voice_supabase_url";
const ANON_KEY_KEY = "adventist_voice_supabase_anon_key";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: "env" | "local" | "none";
}

export function getSupabaseCredentials(): SupabaseConfig {
  const localUrl = localStorage.getItem(URL_KEY)?.trim() || "";
  const localKey = localStorage.getItem(ANON_KEY_KEY)?.trim() || "";

  if (localUrl && localKey) {
    return { url: localUrl, anonKey: localKey, source: "local" };
  }

  const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || "").trim();
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey, source: "env" };
  }

  return { url: "", anonKey: "", source: "none" };
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (url.trim() && key.trim()) {
    localStorage.setItem(URL_KEY, url.trim());
    localStorage.setItem(ANON_KEY_KEY, key.trim());
  }
}

export function clearSupabaseCredentials() {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(ANON_KEY_KEY);
}

export function isSupabaseConfiguredClient(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return !!url && !!anonKey && (url.startsWith("http://") || url.startsWith("https://"));
}

export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey);
  } catch (err) {
    console.error("Error creating Supabase client:", err);
    return null;
  }
}

// Client-side fetch direct from Supabase
export async function fetchCustomSongsClient(): Promise<Song[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured on the client.");

  const { data, error } = await supabase
    .from("custom_songs")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) return [];

  // Map database snake_case columns back to camelCase Song properties
  return data.map((song: any) => ({
    id: song.id,
    title: song.title,
    category: song.category,
    numberOrYear: song.number_or_year,
    artist: song.artist,
    bpm: song.bpm,
    difficulty: song.difficulty,
    lyrics: song.lyrics,
    melody: song.melody,
    description: song.description,
    language: song.language,
  }));
}

// Client-side direct write to Supabase
export async function saveCustomSongsClient(songs: Song[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured on the client.");

  // Map camelCase to snake_case for Supabase columns
  const mappedSongs = songs.map((song) => ({
    id: song.id,
    title: song.title,
    category: song.category,
    number_or_year: song.numberOrYear,
    artist: song.artist,
    bpm: song.bpm,
    difficulty: song.difficulty,
    lyrics: song.lyrics,
    melody: song.melody,
    description: song.description || null,
    language: song.language || null,
  }));

  const { error } = await supabase
    .from("custom_songs")
    .upsert(mappedSongs, { onConflict: "id" });

  if (error) {
    throw error;
  }

  return true;
}
