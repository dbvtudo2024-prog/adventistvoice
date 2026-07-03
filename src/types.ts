export interface MelodyNote {
  time: number; // Start time in seconds
  duration: number; // Duration in seconds
  note: number; // MIDI note (60 = C4, 72 = C5, etc.)
  text: string; // The syllable/word aligned with this note
}

export interface LyricLine {
  time: number; // Start time of this line in seconds
  endTime: number; // End time of this line in seconds
  text: string;
}

export type SongCategory = 'Hinário' | 'CD Jovem';
export type SongDifficulty = 'Fácil' | 'Médio' | 'Difícil';
export type SongLanguage = 'pt' | 'en' | 'es';

export interface Song {
  id: string;
  title: string;
  category: SongCategory;
  numberOrYear: string; // e.g. "Hino 54" or "CD 2004"
  artist: string;
  bpm: number;
  difficulty: SongDifficulty;
  lyrics: LyricLine[];
  melody: MelodyNote[];
  description?: string;
  audioFile?: File;
  audioUrl?: string;
  language?: SongLanguage;
}

export interface ScoreRecord {
  id: string;
  songId: string;
  songTitle: string;
  userName: string;
  score: number; // 0 - 10000 points
  accuracy: number; // 0 - 100%
  date: string; // ISO Date
  stars: number; // 1 to 5 stars
  maxStreak: number;
}

export interface FriendCompetitor {
  name: string;
  avatar: string;
  hymnalHighscore: number;
  youthHighscore: number;
  joinedDate: string;
  isCustom?: boolean;
}
