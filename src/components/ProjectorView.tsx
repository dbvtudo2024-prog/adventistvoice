import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { Tv, Music, RefreshCw, Trophy, Maximize, Minimize } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProjectorView() {
  const [song, setSong] = useState<Song | null>(null);
  const [songTime, setSongTime] = useState<number>(0);
  const [playState, setPlayState] = useState<'idle' | 'countdown' | 'playing' | 'calculating' | 'completed'>('idle');
  const [countdown, setCountdown] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const projectorContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize state from primary controller window
  useEffect(() => {
    const handleSyncMessage = (data: any) => {
      if (!data) return;
      if (data.type === 'init' || data.type === 'sync') {
        if (data.song !== undefined) setSong(data.song);
        if (data.songTime !== undefined) setSongTime(data.songTime);
        if (data.playState !== undefined) setPlayState(data.playState);
        if (data.countdown !== undefined) setCountdown(data.countdown);
        if (data.score !== undefined) setScore(data.score);
        if (data.currentUser !== undefined) setCurrentUser(data.currentUser);
      } else if (data.type === 'time') {
        if (data.songTime !== undefined) setSongTime(data.songTime);
      } else if (data.type === 'exit') {
        setSong(null);
        setPlayState('idle');
      }
    };

    // Expose update handler globally on the window so opener can call it directly
    (window as any).updateProjectorState = (data: any) => {
      handleSyncMessage(data);
    };

    // 1. Primary Sync: BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('adventist_voice_sync');
      channel.onmessage = (event) => {
        handleSyncMessage(event.data);
      };
    } catch (e) {
      console.warn("BroadcastChannel not available in this tab environment, relying on localStorage sync.");
    }

    // 2. Fallback Sync: LocalStorage Storage Event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'adventist_voice_sync_fallback' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          handleSyncMessage(data);
        } catch (err) {}
      } else if (e.key === 'adventist_voice_time_sync' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.songTime !== undefined) setSongTime(data.songTime);
          if (data.playState !== undefined) setPlayState(data.playState);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Direct window messaging listener (for iframe-to-tab postMessage)
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data) {
        handleSyncMessage(event.data);
      }
    };
    window.addEventListener('message', handleWindowMessage);

    // 4. Active Polling (Highly robust fallback for iframes/popups in development or sandboxes)
    const pollInterval = setInterval(() => {
      // Primary server-side sync relay (guarantees cross-origin iframe / window success)
      fetch('/api/projector/state')
        .then(res => res.json())
        .then(data => {
          if (data) {
            handleSyncMessage(data);
          }
        })
        .catch(() => {
          // Fallback to localStorage if server endpoint is not available or fails
          try {
            const savedSync = localStorage.getItem('adventist_voice_sync_fallback');
            if (savedSync) {
              const data = JSON.parse(savedSync);
              if (Date.now() - data.timestamp < 300000) {
                handleSyncMessage(data);
              }
            }
            
            const savedTime = localStorage.getItem('adventist_voice_time_sync');
            if (savedTime) {
              const data = JSON.parse(savedTime);
              if (data.songTime !== undefined) setSongTime(data.songTime);
              if (data.playState !== undefined) setPlayState(data.playState);
            }
          } catch (e) {}
        });
    }, 150);

    // Initial load from storage just in case the window opened after the start
    try {
      const saved = localStorage.getItem('adventist_voice_sync_fallback');
      if (saved) {
        const data = JSON.parse(saved);
        // Only trust it if it was written within the last 5 minutes
        if (Date.now() - data.timestamp < 300000) {
          handleSyncMessage(data);
        }
      }
    } catch (err) {}

    // Send request sync immediately on mount to establish handshake with main controller
    try {
      if (channel) {
        channel.postMessage({ type: 'request_sync' });
      }
    } catch (e) {}
    try {
      localStorage.setItem('adventist_voice_request_sync', Date.now().toString());
    } catch (e) {}

    return () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('message', handleWindowMessage);
      clearInterval(pollInterval);
    };
  }, []);

  // Fullscreen Change Listener and Toggle
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!projectorContainerRef.current) return;
    if (!document.fullscreenElement) {
      projectorContainerRef.current.requestFullscreen().catch((err) => {
        console.warn(`Error enabling fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Determine active and upcoming lyrics
  const activeLyric = song?.lyrics.find(
    (lyric) => songTime >= lyric.time && songTime <= lyric.endTime
  );

  const upcomingLyric = song?.lyrics.find(
    (lyric) => lyric.time > songTime
  );

  // Words list calculations
  const getLinkedWords = () => {
    if (!activeLyric) return [];
    
    const words = activeLyric.text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];

    const lineStart = activeLyric.time;
    const lineEnd = activeLyric.endTime;
    const lineDuration = lineEnd - lineStart;

    const totalChars = words.reduce((acc, w) => acc + w.length, 0);

    let accumulated = 0;
    return words.map((word) => {
      const weight = word.length / totalChars;
      const duration = weight * lineDuration;
      const startTime = lineStart + accumulated;
      const endTime = startTime + duration;
      accumulated += duration;
      
      return { text: word, startTime, endTime };
    });
  };

  return (
    <div ref={projectorContainerRef} className="min-h-screen w-screen bg-black text-white font-sans overflow-hidden flex flex-col justify-between p-6 sm:p-12 relative select-none">
      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.04)_0%,transparent_70%)] pointer-events-none" />

      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-white/5 pb-4 relative z-10 opacity-75">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <Tv className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white font-display uppercase">
              ADVENTIST <span className="text-amber-400 font-extrabold">VOICE</span>
            </h1>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block leading-none">Modo Projetor • Segunda Tela</span>
          </div>
        </div>

        {/* Absolute Centered Singer Badge */}
        {currentUser && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-display">
                Cantando: {currentUser}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {song && (
            <div className="text-right flex flex-col items-end mr-1">
              <span className="text-xs font-bold text-amber-400 font-display block truncate max-w-[200px] uppercase">
                {song.title}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                {song.artist}
              </span>
            </div>
          )}

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-950/40 rounded-xl border border-white/10 hover:border-amber-400/40 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4 text-amber-400 animate-pulse" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Core display stage */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 py-12 px-4">
        <AnimatePresence mode="wait">
          {/* STATE: IDLE - Waiting for song */}
          {playState === 'idle' && (
            <motion.div
              key="idle-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4 max-w-xl"
            >
              <div className="mx-auto h-20 w-20 bg-amber-500/5 text-amber-400 rounded-full flex items-center justify-center border border-amber-500/15 shadow-xl shadow-amber-950/20 animate-pulse">
                <Music className="h-10 w-10 text-amber-400/80" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight uppercase">
                  PROJETOR ATIVO
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto serif-font italic">
                  Aguardando o início do louvor no painel de controle principal para sincronizar os slides...
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Conectado em Tempo Real
              </div>
            </motion.div>
          )}

          {/* STATE: COUNTDOWN */}
          {playState === 'countdown' && (
            <motion.div
              key="countdown-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center space-y-3"
            >
              <span className="text-9xl font-display font-black text-amber-400 select-none block drop-shadow-[0_0_40px_rgba(245,158,11,0.4)]">
                {countdown}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                PREPARE-SE PARA O LOUVOR...
              </span>
            </motion.div>
          )}

          {/* STATE: PLAYING - Beautiful Fullscreen Lyrics Scrolling */}
          {playState === 'playing' && (
            <motion.div
              key="playing-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full text-center space-y-12"
            >
              {/* CURRENT ACTIVE LYRIC */}
              <div className="min-h-[140px] sm:min-h-[180px] flex items-center justify-center">
                {activeLyric ? (
                  <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-3 px-2 w-full text-center max-w-4xl mx-auto">
                    {getLinkedWords().map((word, wIdx) => {
                      const wordDuration = word.endTime - word.startTime;
                      let wordProgress = 0;
                      if (songTime > word.endTime) {
                        wordProgress = 100;
                      } else if (songTime < word.startTime) {
                        wordProgress = 0;
                      } else if (wordDuration > 0) {
                        wordProgress = ((songTime - word.startTime) / wordDuration) * 100;
                      }

                      const isActive = songTime >= word.startTime && songTime <= word.endTime;

                      return (
                        <span key={wIdx} className="relative inline-block select-none">
                          {/* Dim/Base background lyric word */}
                          <span className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white/20 tracking-tight serif-font italic transition-colors duration-150">
                            {word.text}
                          </span>
                          
                          {/* Glowing golden progressive overlay lyric word */}
                          <span
                            className="absolute inset-0 text-center text-3xl sm:text-5xl md:text-6xl font-extrabold text-amber-400 tracking-tight serif-font italic pointer-events-none transition-all duration-75 block whitespace-nowrap"
                            style={{
                              clipPath: `inset(0 ${100 - wordProgress}% 0 0)`,
                              WebkitClipPath: `inset(0 ${100 - wordProgress}% 0 0)`,
                              filter: isActive ? 'drop-shadow(0 0 15px rgba(245,158,11,0.9))' : 'none'
                            }}
                          >
                            {word.text}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                ) : song && songTime > (song.lyrics[song.lyrics.length - 1]?.endTime || 0) ? (
                  /* POSTLUDIO - Clean calculations display */
                  <div className="flex flex-col items-center justify-center text-center space-y-4 py-4 animate-fade-in">
                    <RefreshCw className="h-10 w-10 text-amber-400 animate-spin" />
                    <h3 className="text-2xl sm:text-3xl font-display font-black text-amber-400 uppercase tracking-wider">
                      Calculando Pontos
                    </h3>
                    <p className="text-sm text-slate-400 serif-font italic max-w-sm leading-relaxed">
                      Processando as notas... O resultado final aparecerá ao encerrar a música!
                    </p>
                  </div>
                ) : (
                  /* INSTRUMENTAL SILENCE */
                  <div className="flex flex-col items-center justify-center space-y-2 py-4">
                    <span className="text-slate-500 italic text-lg sm:text-xl serif-font tracking-wide animate-pulse">Instrumental...</span>
                    <div className="flex gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-[bounce_1s_infinite_100ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-[bounce_1s_infinite_200ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-[bounce_1s_infinite_300ms]" />
                    </div>
                  </div>
                )}
              </div>

              {/* UPCOMING NEXT LINE */}
              <div className="min-h-[40px] flex items-center justify-center">
                {upcomingLyric ? (
                  <p className="text-base sm:text-2xl text-slate-400/55 font-semibold italic serif-font tracking-wide animate-pulse bg-white/[0.02] border border-white/5 px-6 py-2.5 rounded-full max-w-xl truncate">
                    Próximo: {upcomingLyric.text}
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}

          {/* STATE: COMPLETED */}
          {playState === 'completed' && (
            <motion.div
              key="completed-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6 max-w-lg p-8 bg-slate-950/40 border border-white/5 rounded-2xl shadow-2xl"
            >
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-500 block mx-auto animate-bounce">
                <Trophy className="h-8 w-8 text-amber-400" />
              </div>

              <div className="space-y-1 text-center">
                <h3 className="text-3xl font-display font-extrabold text-white uppercase tracking-tight">Louvor Concluído!</h3>
                {currentUser && (
                  <p className="text-sm text-amber-400 font-bold uppercase tracking-wider">Excelente louvor, {currentUser}!</p>
                )}
                <p className="text-sm text-slate-300 serif-font italic">"Bom é cantar louvores ao nosso Deus..."</p>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-white/5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Pontuação do Cantor</span>
                <span className="text-3xl font-mono font-black text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">{score} pts</span>
              </div>

              <span className="text-xs text-amber-500/70 font-semibold block uppercase tracking-wider animate-pulse font-display">
                Glória a Deus pelo seu louvor! 🙌
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-white/5 pt-4 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-widest relative z-10 opacity-60">
        ❤️ ADVENTIST VOICE • PROJETOR DIGITAL INTEGRADO
      </footer>
    </div>
  );
}
