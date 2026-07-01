import React, { useState, useEffect } from 'react';
import { Song, ScoreRecord, FriendCompetitor } from './types';
import { ADVENTIST_SONGS, DEFAULT_LEADERBOARD, SYSTEM_COMPETITORS } from './songsData';
import SongSelector from './components/SongSelector';
import Leaderboard from './components/Leaderboard';
import KaraokeStage from './components/KaraokeStage';
import AdminManager from './components/AdminManager';
import ProjectorView from './components/ProjectorView';
import { Mic, Trophy, Music, User, Flame, Disc, Shield, Settings2, Edit3, Check, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLanguage, translations } from './utils/translations';

export default function App() {
  const isProjector = typeof window !== 'undefined' && window.location.search.includes('projector=true');

  if (isProjector) {
    return <ProjectorView />;
  }

  const [view, setView] = useState<'home' | 'singing' | 'leaderboard' | 'admin'>('home');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  
  // App language state
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => {
    try {
      return (localStorage.getItem('adventist_voice_lang') as AppLanguage) || 'pt';
    } catch (e) {
      return 'pt';
    }
  });
  const t = translations[appLanguage];

  // Scroll to Top state for mobile
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Local Data State
  const [scoreHistory, setScoreHistory] = useState<ScoreRecord[]>([]);
  const [competitors, setCompetitors] = useState<FriendCompetitor[]>([]);
  const [customSongs, setCustomSongs] = useState<Song[]>([]);
  const [userName, setUserName] = useState('Você (Cantor)');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('Você (Cantor)');

  // Dynamic highscore map per song ID
  const [highscores, setHighscores] = useState<{ [songId: string]: { score: number; accuracy: number; stars: number } }>({});

  // 1. Initial load from Local Storage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('adventist_karaoke_history');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        // Clean out any old mock data entries to keep the database completely fresh
        const hasMockData = parsed.some((rec: any) => rec.id === '1' || rec.id === '2' || rec.id === '3' || rec.id === '5');
        if (hasMockData) {
          setScoreHistory([]);
          localStorage.setItem('adventist_karaoke_history', JSON.stringify([]));
        } else {
          setScoreHistory(parsed);
        }
      } else {
        setScoreHistory([]);
        localStorage.setItem('adventist_karaoke_history', JSON.stringify([]));
      }

      const savedCompetitors = localStorage.getItem('adventist_karaoke_competitors');
      if (savedCompetitors) {
        setCompetitors(JSON.parse(savedCompetitors));
      } else {
        setCompetitors(SYSTEM_COMPETITORS);
        localStorage.setItem('adventist_karaoke_competitors', JSON.stringify(SYSTEM_COMPETITORS));
      }

      const savedCustomSongs = localStorage.getItem('adventist_karaoke_custom_songs');
      if (savedCustomSongs) {
        const parsedSongs: Song[] = JSON.parse(savedCustomSongs);
        setCustomSongs(parsedSongs);
        
        // Carrega arquivos de áudio binários do IndexedDB de forma assíncrona
        import('./utils/audioStorage').then(async ({ getSongAudio }) => {
          const songsWithAudio = await Promise.all(
            parsedSongs.map(async (song) => {
              const audioFile = await getSongAudio(song.id);
              if (audioFile) {
                return { ...song, audioFile };
              }
              return song;
            })
          );
          setCustomSongs(songsWithAudio);
        }).catch(err => console.error("Falha ao carregar áudios do IndexedDB:", err));
      }

      const savedUserName = localStorage.getItem('adventist_karaoke_name');
      if (savedUserName) {
        setUserName(savedUserName);
        setEditedName(savedUserName);
      }
    } catch (e) {
      console.error("Local storage lookup failed safely.", e);
    }
  }, []);

  // 1b. Automatic Second Screen Open (Projector) on startup / first click interaction
  useEffect(() => {
    const autoOpen = localStorage.getItem('adventist_voice_auto_open') === 'true';
    if (autoOpen) {
      const handleFirstInteraction = () => {
        window.removeEventListener('click', handleFirstInteraction);
        
        // Prevent multiple opens in the same session
        if (!sessionStorage.getItem('adventist_projector_opened')) {
          sessionStorage.setItem('adventist_projector_opened', 'true');
          const url = window.location.origin + window.location.pathname + '?projector=true';
          window.open(url, 'adventist_voice_projector', 'width=1280,height=720,menubar=no,status=no,titlebar=no,toolbar=no,location=no');
        }
      };
      window.addEventListener('click', handleFirstInteraction);
      return () => window.removeEventListener('click', handleFirstInteraction);
    }
  }, []);

  // 2. Synchronize score records into mapped highscores for the UI
  useEffect(() => {
    const map: { [songId: string]: { score: number; accuracy: number; stars: number } } = {};
    scoreHistory.forEach((rec) => {
      // We only store the highest score per song id
      if (!map[rec.songId] || map[rec.songId].score < rec.score) {
        map[rec.songId] = {
          score: rec.score,
          accuracy: rec.accuracy,
          stars: rec.stars,
        };
      }
    });
    setHighscores(map);
  }, [scoreHistory]);

  // Save the score history to LocalStorage
  const handleSaveScoreHistory = (newHistory: ScoreRecord[]) => {
    setScoreHistory(newHistory);
    try {
      localStorage.setItem('adventist_karaoke_history', JSON.stringify(newHistory));
    } catch(e){}
  };

  // Save competitors list to LocalStorage
  const handleSaveCompetitors = (newCompetitors: FriendCompetitor[]) => {
    setCompetitors(newCompetitors);
    try {
      localStorage.setItem('adventist_karaoke_competitors', JSON.stringify(newCompetitors));
    } catch(e){}
  };

  // Salva músicas customizadas no LocalStorage e sincroniza os áudios binários no IndexedDB
  const handleSaveCustomSongs = (newSongs: Song[]) => {
    // 1. Identifica músicas removidas para deletar seus arquivos de áudio do IndexedDB
    const newSongIds = new Set(newSongs.map(s => s.id));
    const deletedSongs = customSongs.filter(s => !newSongIds.has(s.id));
    
    import('./utils/audioStorage').then(async ({ saveSongAudio, deleteSongAudio }) => {
      // Limpa os arquivos de áudio das músicas excluídas
      for (const song of deletedSongs) {
        await deleteSongAudio(song.id);
      }
      // Armazena com segurança o arquivo de áudio das novas músicas
      for (const song of newSongs) {
        if (song.audioFile) {
          await saveSongAudio(song.id, song.audioFile);
        }
      }
    }).catch(err => console.error("Falha ao salvar/deletar áudios do IndexedDB:", err));

    setCustomSongs(newSongs);

    try {
      // Remove o campo 'audioFile' (objeto binário brutos) antes de serializar em texto no localStorage
      const songsToSerialize = newSongs.map(s => {
        const { audioFile, ...rest } = s;
        return rest;
      });
      localStorage.setItem('adventist_karaoke_custom_songs', JSON.stringify(songsToSerialize));
    } catch(e){}
  };

  // Changing name logic
  const handleConfirmNameChange = () => {
    const cleaned = editedName.trim() || 'Cantor Abençoado';
    setUserName(cleaned);
    setIsEditingName(false);
    try {
      localStorage.setItem('adventist_karaoke_name', cleaned);
    } catch(e){}

    // Update historical references for their username
    const updatedHistory = scoreHistory.map((rec) => {
      if (rec.userName === userName || rec.userName === 'Você (Cantor)' || rec.userName === 'Cantor Convidado') {
        return { ...rec, userName: cleaned };
      }
      return rec;
    });
    handleSaveScoreHistory(updatedHistory);
  };

  // Triggered when user successfully finishes a song on KaraokeStage
  const handleSaveNewScore = (newRecord: ScoreRecord) => {
    const updatedHistory = [newRecord, ...scoreHistory];
    handleSaveScoreHistory(updatedHistory);

    // Sync competitive state
    const currentSong = [...ADVENTIST_SONGS, ...customSongs].find(s => s.id === newRecord.songId);
    if (!currentSong) return;

    // Check if user has an existing competitor representation
    let userComp = competitors.find(c => c.name === userName);

    if (!userComp) {
      // Create user's competitor profile
      userComp = {
        name: userName,
        avatar: '🎤',
        hymnalHighscore: currentSong.category === 'Hinário' ? newRecord.score : 0,
        youthHighscore: currentSong.category === 'CD Jovem' ? newRecord.score : 0,
        joinedDate: 'Hoje',
        isCustom: true
      };
      const nextCompetitors = [userComp, ...competitors];
      handleSaveCompetitors(nextCompetitors);
    } else {
      // Update highscores on user's competitor profile representation
      const updatedCompetitors = competitors.map((c) => {
        if (c.name === userName) {
          return {
            ...c,
            hymnalHighscore: currentSong.category === 'Hinário' 
              ? Math.max(c.hymnalHighscore, newRecord.score) 
              : c.hymnalHighscore,
            youthHighscore: currentSong.category === 'CD Jovem' 
              ? Math.max(c.youthHighscore, newRecord.score) 
              : c.youthHighscore,
          };
        }
        return c;
      });
      handleSaveCompetitors(updatedCompetitors);
    }

    // Go to leaderboard to show the updated rank
    setView('leaderboard');
  };

  // Add customized friends to compete locally
  const handleAddCustomCompetitor = (name: string, avatar: string) => {
    const newFriend: FriendCompetitor = {
      name,
      avatar,
      hymnalHighscore: 0,
      youthHighscore: 0,
      joinedDate: 'Hoje',
      isCustom: true
    };
    const updated = [newFriend, ...competitors];
    handleSaveCompetitors(updated);
  };

  // Safe reset storage options
  const handleClearHistory = () => {
    handleSaveScoreHistory([]);
    handleSaveCompetitors(SYSTEM_COMPETITORS);
  };

  const handleClearCompetitorScores = () => {
    const cleared = competitors.map(c => ({
      ...c,
      hymnalHighscore: 0,
      youthHighscore: 0
    }));
    handleSaveCompetitors(cleared);
  };

  const handleDeleteCompetitor = (name: string) => {
    const updated = competitors.filter(c => c.name !== name);
    handleSaveCompetitors(updated);
  };

  // Overall User Stats Summaries
  const totalGainedStars = scoreHistory.length > 0 
    ? scoreHistory.reduce((total, r) => total + r.stars, 0)
    : 0;

  const userHighestScore = scoreHistory.length > 0
    ? Math.max(...scoreHistory.map(r => r.score))
    : 0;

  if (view === 'singing' && selectedSong) {
    return (
      <div className="h-screen w-screen bg-[#05070a] font-sans text-slate-100 overflow-hidden relative flex flex-col p-2 sm:p-4 selection:bg-amber-500 selection:text-slate-950">
        {/* Immersive Theme Atmosphere Background */}
        <div className="atmosphere" style={{ opacity: 0.15 }} />
        <div className="flex-1 w-full h-full relative z-10 flex flex-col min-h-0">
          <KaraokeStage
            song={selectedSong}
            onExit={() => {
              setSelectedSong(null);
              setView('home');
            }}
            currentUser={userName}
            onSaveScore={handleSaveNewScore}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070a] font-sans text-slate-100 overflow-x-hidden relative selection:bg-indigo-500 selection:text-white">
      {/* Immersive Theme Atmosphere Background */}
      <div className="atmosphere" />

      {/* Elegant Header Navbar */}
      <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Logo Brand Brand */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="h-10 w-10 shrink-0 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.4)]">
              <Mic className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white leading-none">
                ADVENTIST <span className="text-amber-500 font-black">VOICE</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-0.5">
                {appLanguage === 'pt' ? 'LOUVORES ADVENTISTAS' : appLanguage === 'en' ? 'ADVENTIST PRAISES' : 'ALABANZAS ADVENTISTAS'}
              </span>
            </div>
          </div>

          {/* User Profile name card and Tab layout selectors */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-end">
            
            {/* Language Selector Dropdown */}
            <div className="glass-panel px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md border border-white/5 hover:border-white/10 transition-colors">
              <span className="text-xs">🌐</span>
              <select
                value={appLanguage}
                onChange={(e) => {
                  const newLang = e.target.value as AppLanguage;
                  setAppLanguage(newLang);
                  localStorage.setItem('adventist_voice_lang', newLang);
                  // Broadcast to projector as well
                  fetch('/api/projector/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appLanguage: newLang })
                  }).catch(() => {});
                }}
                className="bg-transparent text-xs font-bold text-slate-100 border-none outline-none focus:ring-0 p-0 pr-6 cursor-pointer"
              >
                <option value="pt" className="bg-slate-950 text-slate-100">PT 🇧🇷</option>
                <option value="en" className="bg-slate-950 text-slate-100">EN 🇺🇸</option>
                <option value="es" className="bg-slate-950 text-slate-100">ES 🇪🇸</option>
              </select>
            </div>



            {/* Editable Profile Name Badge / Singer Selector */}
            <div className="glass-panel px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-md">
              <div className="h-6 w-6 rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-500 font-bold text-xs shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                🎤
              </div>
              
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={15}
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder={appLanguage === 'pt' ? 'Nome...' : appLanguage === 'en' ? 'Name...' : 'Nombre...'}
                    className="bg-slate-950 text-xs text-white rounded px-2 py-1 border border-white/10 w-24 sm:w-28 focus:outline-none"
                  />
                  <button
                    onClick={handleConfirmNameChange}
                    className="p-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded cursor-pointer transition-colors"
                  >
                    <Check className="h-3.5 w-3.5 font-bold" />
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded cursor-pointer transition-colors text-[10px] w-5 h-5 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-amber-500 uppercase tracking-wider font-extrabold leading-none mb-0.5">{t.activeSinger}</span>
                    <select
                      value={userName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserName(val);
                        setEditedName(val);
                        try {
                          localStorage.setItem('adventist_karaoke_name', val);
                        } catch(err){}
                      }}
                      className="bg-transparent text-xs font-bold text-slate-100 border-none outline-none focus:ring-0 p-0 pr-6 cursor-pointer min-w-[90px] max-w-[140px] truncate"
                    >
                      {!competitors.some(c => c.name === userName) && (
                        <option value={userName} className="bg-slate-950 text-slate-100">{userName}</option>
                      )}
                      {competitors.map((c) => (
                        <option key={c.name} value={c.name} className="bg-slate-950 text-slate-100">
                          {c.avatar} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => {
                      setEditedName(userName);
                      setIsEditingName(true);
                    }}
                    className="text-slate-500 hover:text-amber-400 transition-colors cursor-pointer p-1 rounded hover:bg-white/5"
                    title={appLanguage === 'pt' ? 'Editar nome' : appLanguage === 'en' ? 'Edit name' : 'Editar nombre'}
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Menu options selectors when not active singing */}
            {view !== 'singing' && (
              <div className="flex glass-panel p-1 rounded-xl shadow-lg">
                <button
                  onClick={() => setView('home')}
                  className={`px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    view === 'home'
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Music className="h-3.5 w-3.5" />
                  {t.songs}
                </button>
                <button
                  onClick={() => setView('leaderboard')}
                  className={`px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    view === 'leaderboard'
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  {t.scoreboard}
                </button>
                <button
                  onClick={() => setView('admin')}
                  className={`px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    view === 'admin'
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {t.adminStudio}
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Core Scope container screen */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'home' && (
          <SongSelector
            songs={[...ADVENTIST_SONGS, ...customSongs]}
            highscores={highscores}
            onSelectSong={(song) => {
              setSelectedSong(song);
              setView('singing');
            }}
            onNavigateToLeaderboard={() => setView('leaderboard')}
            appLanguage={appLanguage}
          />
        )}

        {view === 'singing' && selectedSong && (
          <KaraokeStage
            song={selectedSong}
            onExit={() => {
              setSelectedSong(null);
              setView('home');
            }}
            currentUser={userName}
            onSaveScore={handleSaveNewScore}
          />
        )}

        {view === 'leaderboard' && (
          <Leaderboard
            history={scoreHistory}
            competitors={competitors}
            onAddCompetitor={handleAddCustomCompetitor}
            onClearHistory={handleClearHistory}
            onClearCompetitors={handleClearCompetitorScores}
            onDeleteCompetitor={handleDeleteCompetitor}
            appLanguage={appLanguage}
          />
        )}

        {view === 'admin' && (
          <AdminManager
            customSongs={customSongs}
            onSaveCustomSongs={handleSaveCustomSongs}
            onExit={() => setView('home')}
            onSelectAndPlay={(song) => {
              setSelectedSong(song);
              setView('singing');
            }}
            appLanguage={appLanguage}
          />
        )}
      </main>

      {/* Bottom informational footings */}
      <footer className="border-t border-slate-900/60 bg-slate-950 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-center md:text-left">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              ❤️ Adventist Voice • Karaokê Adventista
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              {appLanguage === 'pt' 
                ? 'Desenvolvido com carinho para inspirar cultos jovens, momentos em família, comunhão e prática musical.'
                : appLanguage === 'en'
                ? 'Developed with love to inspire youth worship, family times, fellowship and musical practice.'
                : 'Desarrollado con amor para inspirar el culto juvenil, momentos familiares, comunión y práctica musical.'}
            </p>
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center md:justify-end gap-1.5 font-semibold">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            {appLanguage === 'pt'
              ? 'Salvo localmente no navegador (localStorage) • Sem coleta de dados.'
              : appLanguage === 'en'
              ? 'Saved locally in the browser (localStorage) • No data collection.'
              : 'Guardado localmente en el navegador (localStorage) • Sin recopilación de datos.'}
          </div>
        </div>
      </footer>

      {/* Scroll to top button for mobile / smaller screens */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 h-10 w-10 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transition-transform cursor-pointer border border-amber-400/30 sm:hidden"
            title={appLanguage === 'pt' ? 'Voltar ao topo' : appLanguage === 'en' ? 'Back to top' : 'Volver arriba'}
          >
            <ChevronUp className="h-5 w-5 stroke-[3px]" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
