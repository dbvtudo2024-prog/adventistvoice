import React, { useState, useEffect, useRef } from 'react';
import { Song, SongCategory, SongDifficulty } from '../types';
import { Music, Search, Trophy, Disc, Award, HelpCircle, Check, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SongSelectorProps {
  songs: Song[];
  onSelectSong: (song: Song) => void;
  highscores: { [songId: string]: { score: number; accuracy: number; stars: number } };
  onNavigateToLeaderboard: () => void;
}

export default function SongSelector({
  songs,
  onSelectSong,
  highscores,
  onNavigateToLeaderboard,
}: SongSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SongCategory | 'Todos'>('Todos');
  const [selectedDifficulty, setSelectedDifficulty] = useState<SongDifficulty | 'Todos'>('Todos');
  const [showHowTo, setShowHowTo] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleShowHowTo = () => {
    if (showHowTo) {
      setShowHowTo(false);
      setTimeLeft(0);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setShowHowTo(true);
      setTimeLeft(12);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);

      timerRef.current = setTimeout(() => {
        setShowHowTo(false);
        setTimeLeft(0);
      }, 12000);

      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Filter songs based on category, difficulty, & search query
  const filteredSongs = songs.filter((song) => {
    const matchesCategory = selectedCategory === 'Todos' || song.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'Todos' || song.difficulty === selectedDifficulty;
    const matchesSearch =
      song.title.toLowerCase().includes(search.toLowerCase()) ||
      song.artist.toLowerCase().includes(search.toLowerCase()) ||
      song.numberOrYear.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesDifficulty && matchesSearch;
  });

  const getDifficultyColor = (diff: SongDifficulty) => {
    switch (diff) {
      case 'Fácil':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Médio':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'Difícil':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl min-h-[220px] flex flex-col justify-center"
      >
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-20 h-48 w-48 rounded-full bg-sky-500/5 blur-3xl pointer-events-none" />

        {/* Canto Superior Direito Button */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
          <button
            onClick={handleShowHowTo}
            className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border transition-all cursor-pointer shadow-lg ${
              showHowTo 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20' 
                : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
            }`}
          >
            {showHowTo ? (
              <>
                <X className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-amber-400 animate-pulse" />
                <span>Voltar ({timeLeft}s)</span>
              </>
            ) : (
              <>
                <HelpCircle className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-amber-500" />
                <span>Como Funciona?</span>
              </>
            )}
          </button>
        </div>

        <div className="relative z-10 w-full pr-0 lg:pr-36">
          <AnimatePresence mode="wait">
            {!showHowTo ? (
              <motion.div
                key="original-text"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white uppercase">
                  Solte a voz e adore em <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">tempo real</span>
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed serif-font italic opacity-90 max-w-2xl">
                  "Então minh'alma canta a Ti Senhor..." O primeiro sistema de Karaokê Adventista com análise e pontuação vocal precisa direto no seu navegador. Escolha uma música do hinário ou dos CDs Jovem, ative seu microfone e divirta-se!
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="instructions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <h2 className="font-display text-base sm:text-lg font-bold text-amber-400 uppercase tracking-wide flex items-center gap-2 mb-3">
                  <HelpCircle className="h-4 sm:h-5 w-4 sm:w-5 text-amber-500 animate-bounce" />
                  Instruções Rápidas de Como Cantar
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                    <span className="block text-amber-400 font-bold text-xs sm:text-sm mb-1">1. Ligue o Microfone</span>
                    <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                      Clique em qualquer música e dê acesso ao microfone. Use fones para evitar captar o som dos alto-falantes.
                    </p>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                    <span className="block text-amber-400 font-bold text-xs sm:text-sm mb-1">2. Acerte o Tom</span>
                    <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                      A pauta virtual indica as notas do hino. Use a guia vocal sintetizada se precisar de ajuda com a melodia.
                    </p>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                    <span className="block text-amber-400 font-bold text-xs sm:text-sm mb-1">3. Veja seu Placar</span>
                    <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                      O detector mede a frequência da voz em tempo real. Cantar com afinação certa cria combos e mais pontos!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Advanced Filter and Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between glass-panel p-4 rounded-2xl shadow-xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por título, hino, CD ou cantor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-slate-950/40 pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 border border-white/5 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <span className="text-xs text-slate-400 font-medium mr-1 md:block hidden">Origem:</span>
          <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5">
            {(['Todos', 'Hinário', 'CD Jovem'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Difficulty Filter */}
          <span className="text-xs text-slate-400 font-medium mr-1 md:block hidden">Dificuldade:</span>
          <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5">
            {(['Todos', 'Fácil', 'Médio', 'Difícil'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedDifficulty === diff
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Song Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {songs.length === 0 ? (
          <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-amber-500/20 bg-slate-950/40 p-6 flex flex-col items-center justify-center">
            <Music className="h-10 w-10 text-amber-500/40 mb-3 animate-pulse" />
            <p className="text-slate-200 text-sm font-bold">O catálogo padrão de músicas está vazio</p>
            <p className="text-slate-400 text-xs mt-1.5 max-w-md leading-relaxed">
              Você pode adicionar suas próprias canções personalizadas ou hinos com letras, notas e arquivos de áudio acessando a aba <strong className="text-amber-400 font-bold">Estúdio Admin</strong> no menu superior!
            </p>
          </div>
        ) : filteredSongs.length > 0 ? (
          filteredSongs.map((song, idx) => {
            const hs = highscores[song.id];

            return (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -3 }}
                onClick={() => onSelectSong(song)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl glass-panel p-3.5 hover:border-amber-400/40 hover:bg-white/[0.06] transition-all shadow-md min-h-0 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.03] pb-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase border ${getDifficultyColor(song.difficulty)}`}>
                        {song.difficulty}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold truncate">
                        {song.numberOrYear}
                      </span>
                    </div>

                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 border border-white/5 text-amber-500 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all duration-300">
                      <Play className="h-3 w-3 fill-current opacity-0 group-hover:opacity-100 absolute transition-opacity duration-300" />
                      <div className="group-hover:opacity-0 transition-opacity duration-300">
                        {song.category === 'Hinário' ? (
                          <Music className="h-3.5 w-3.5" />
                        ) : (
                          <Disc className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-400 serif-font transition-colors truncate">
                    {song.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium italic truncate">Por {song.artist}</p>
                  <p className="mt-1 text-[11px] text-slate-300 line-clamp-1 leading-normal serif-font opacity-85">
                    {song.description || 'Música inspiradora para louvor.'}
                  </p>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
            <p className="text-slate-400 text-sm">Nenhum louvor encontrado com os filtros selecionados.</p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('Todos');
                setSelectedDifficulty('Todos');
              }}
              className="mt-3 text-xs text-indigo-400 font-bold hover:underline"
            >
              Limpar filtros de busca
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
