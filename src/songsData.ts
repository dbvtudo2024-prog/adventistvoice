import { Song, ScoreRecord, FriendCompetitor } from './types';

// Let's define the curated song catalog with precise melodic notes and timestamps
// MIDI helper reference:
// 60 = C4, 61 = C#4, 62 = D4, 63 = D#4, 64 = E4, 65 = F4, 66 = F#4, 67 = G4, 68 = G#4, 69 = A4, 70 = A#4, 71 = B4
// 72 = C5, 73 = C#5, 74 = D5, 75 = D#5, 76 = E5, 77 = F5

export const ADVENTIST_SONGS: Song[] = [];

export const DEFAULT_LEADERBOARD: ScoreRecord[] = [];

export const SYSTEM_COMPETITORS: FriendCompetitor[] = [
  { name: 'Gabriela Mendonça', avatar: '🌸', hymnalHighscore: 9150, youthHighscore: 8400, joinedDate: 'Janeiro 2026' },
  { name: 'Mateus Silva', avatar: '⚡', hymnalHighscore: 8500, youthHighscore: 8780, joinedDate: 'Fevereiro 2026' },
  { name: 'Ana Júlia', avatar: '🎵', hymnalHighscore: 8200, youthHighscore: 8520, joinedDate: 'Março 2026' },
  { name: 'Lucas Reis', avatar: '🎸', hymnalHighscore: 7900, youthHighscore: 7500, joinedDate: 'Abril 2026' },
  { name: 'Fernanda Rocha', avatar: '✨', hymnalHighscore: 9410, youthHighscore: 8900, joinedDate: 'Maio 2026' }
];
