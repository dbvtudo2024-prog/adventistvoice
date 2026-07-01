import React, { useState, useEffect } from 'react';
import { ScoreRecord, FriendCompetitor } from '../types';
import { Trophy, Users, History, UserPlus, Calendar, Trash2, Award, Sparkles, Star, Check, X, Tv, Play, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { AppLanguage, translations } from '../utils/translations';

interface LeaderboardProps {
  history: ScoreRecord[];
  competitors: FriendCompetitor[];
  onAddCompetitor: (name: string, avatar: string) => void;
  onClearHistory: () => void;
  onClearCompetitors?: () => void;
  onDeleteCompetitor?: (name: string) => void;
  isLoading?: boolean;
  appLanguage: AppLanguage;
}

const AVATAR_OPTIONS = ['🎤', '🎵', '🎹', '💫', '🦁', '🦉', '🎸', '🌟', '🕊️', '🔥'];

export default function Leaderboard({
  history,
  competitors,
  onAddCompetitor,
  onClearHistory,
  onClearCompetitors,
  onDeleteCompetitor,
  appLanguage,
}: LeaderboardProps) {
  const t = translations[appLanguage];
  const [activeTab, setActiveTab] = useState<'lobby' | 'history'>('lobby');
  const [newFriendName, setNewFriendName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎤');
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmClearHistory, setShowConfirmClearHistory] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  // Projection / Leaderboard settings
  const [isProjecting, setIsProjecting] = useState(false);
  const [revealSequential, setRevealSequential] = useState(() => {
    return localStorage.getItem('adventist_voice_leaderboard_reveal') !== 'false';
  });

  // Query active projection on mount
  useEffect(() => {
    fetch('/api/projector/state')
      .then(res => res.json())
      .then(data => {
        if (data && data.playState === 'leaderboard') {
          setIsProjecting(true);
        }
      })
      .catch(() => {});
  }, []);

  const syncLeaderboard = (reveal: boolean) => {
    const sortedList = [...competitors]
      .sort(
        (a, b) =>
          Math.max(b.hymnalHighscore, b.youthHighscore) -
          Math.max(a.hymnalHighscore, a.youthHighscore)
      )
      .map(c => ({
        name: c.name,
        avatar: c.avatar,
        hymnalHighscore: c.hymnalHighscore,
        youthHighscore: c.youthHighscore,
        isCustom: c.isCustom
      }));

    const revealKey = Date.now();

    fetch('/api/projector/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playState: 'leaderboard',
        leaderboardData: sortedList,
        leaderboardReveal: reveal,
        revealKey: revealKey
      })
    })
      .then(() => setIsProjecting(true))
      .catch(() => {});
  };

  const stopLeaderboardProject = () => {
    fetch('/api/projector/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playState: 'idle',
        leaderboardData: [],
        leaderboardReveal: false
      })
    })
      .then(() => setIsProjecting(false))
      .catch(() => {});
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) {
      setErrorMessage(appLanguage === 'pt' ? 'Por favor digite o nome do amigo.' : appLanguage === 'en' ? 'Please enter your friend\'s name.' : 'Por favor ingresa el nombre de tu amigo.');
      return;
    }
    if (competitors.some((c) => c.name.toLowerCase() === newFriendName.trim().toLowerCase())) {
      setErrorMessage(appLanguage === 'pt' ? 'Já existe um amigo cadastrado com esse nome.' : appLanguage === 'en' ? 'A friend with this name is already registered.' : 'Ya existe un amigo registrado con este nombre.');
      return;
    }
    onAddCompetitor(newFriendName.trim(), selectedAvatar);
    setNewFriendName('');
    setErrorMessage('');
  };

  // Compute overall performance stats from local history
  const totalSongsSung = history.length;
  const bestRecord = history.length > 0 ? [...history].sort((a, b) => b.score - a.score)[0] : null;
  const averageAccuracy =
    history.length > 0
      ? Math.round(history.reduce((sum, h) => sum + h.accuracy, 0) / history.length)
      : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar: Performance and Profile Stats */}
      <div className="lg:col-span-1 space-y-6 flex flex-col">
        {/* Add Friend Form (PLACED ABOVE THE STATISTICS AS REQUESTED) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/10 glass-panel p-5 sm:p-6 space-y-4 order-1"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-500" />
            <h3 className="font-display text-base sm:text-lg font-bold text-white uppercase tracking-tight">{t.addFriendTitle}</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed serif-font italic">
            {appLanguage === 'pt' 
              ? 'Cadastre os seus amigos ou familiares de forma local para disputarem nos mesmos aparelhos e compararem refrões do hinário!'
              : appLanguage === 'en'
              ? 'Register your friends or family members locally to compete on the same device and compare scores!'
              : '¡Registra a tus amigos o familiares localmente para competir en el mismo dispositivo y comparar puntuaciones!'}
          </p>

          <form onSubmit={handleAddFriend} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                {appLanguage === 'pt' ? 'Nome do Cantor' : appLanguage === 'en' ? 'Singer Name' : 'Nombre del Cantor'}
              </label>
              <input
                type="text"
                maxLength={25}
                placeholder={t.friendNamePlaceholder}
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                className="w-full bg-slate-950/80 text-xs text-white placeholder-slate-600 rounded-xl px-3 py-2 border border-white/5 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
                {t.avatar}
              </label>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    type="button"
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    className={`h-8 w-8 sm:h-9 sm:w-9 text-base sm:text-lg rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      selectedAvatar === av
                        ? 'bg-amber-500/10 border-amber-500 scale-110 shadow-lg'
                        : 'bg-slate-950 border-white/5 hover:border-white/10'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && <p className="text-xs text-rose-400 font-semibold">{errorMessage}</p>}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10 uppercase tracking-widest"
            >
              {t.saveFriend}
            </button>
          </form>
        </motion.div>

        {/* Sidebar: Performance and Profile Stats (PLACED BELOW THE FRIEND FORM) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 glass-panel p-5 sm:p-6 space-y-6 order-2 mt-0 sm:mt-6"
        >
          <div className="flex items-center gap-2 pb-4 border-b border-white/5">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h3 className="font-display text-base sm:text-lg font-bold text-white uppercase tracking-tight">{t.statsTitle}</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-slate-950/40 p-3 sm:p-4 rounded-xl border border-white/5 text-center">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                {t.songsSung}
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-amber-500 font-mono">{totalSongsSung}</span>
            </div>
            <div className="bg-slate-950/40 p-3 sm:p-4 rounded-xl border border-white/5 text-center">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                {t.averageAccuracy}
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">{averageAccuracy}%</span>
            </div>
          </div>

          {bestRecord ? (
            <div className="bg-slate-950/20 p-3 sm:p-4 rounded-xl border border-white/5 space-y-2">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1 serif-font italic">
                <Award className="h-3.5 w-3.5 text-amber-500" /> {t.recordTitle}
              </span>
              <div className="flex justify-between items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-white truncate serif-font">{bestRecord.songTitle}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 italic">Por {bestRecord.userName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs sm:text-sm font-extrabold text-amber-500 font-mono">{bestRecord.score} pts</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-semibold">{bestRecord.accuracy}% precisão</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-5 text-xs text-slate-400 italic p-3 sm:p-4 bg-slate-950/20 rounded-xl border border-white/5 border-dashed serif-font">
              {appLanguage === 'pt' ? 'Cante seu primeiro louvor para gerar o recorde oficial!' : appLanguage === 'en' ? 'Sing your first praise to generate the official record!' : '¡Canta tu primera alabanza para generar el récord oficial!'}
            </div>
          )}
        </motion.div>
      </div>

      {/* Main Panel - Tab selectors and tables */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5 w-fit shadow-md backdrop-blur-xl">
          <button
            onClick={() => {
              setActiveTab('lobby');
              setShowConfirmReset(false);
              setShowConfirmClearHistory(false);
              setDeleteConfirmName(null);
            }}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lobby'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {appLanguage === 'pt' ? 'Amigos & Competidores' : appLanguage === 'en' ? 'Friends & Competitors' : 'Amigos y Competidores'}
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setShowConfirmReset(false);
              setShowConfirmClearHistory(false);
              setDeleteConfirmName(null);
            }}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            {appLanguage === 'pt' ? 'Histórico Recente' : appLanguage === 'en' ? 'Recent History' : 'Historial Reciente'}
          </button>
        </div>

        {activeTab === 'lobby' ? (
          /* Competitive lobby scoreboard */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 glass-panel overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-white/5 bg-slate-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-display font-extrabold text-white text-sm uppercase tracking-tight">
                  {appLanguage === 'pt' ? 'Amizades e Placar de Líderes' : appLanguage === 'en' ? 'Friendships & Leaderboard' : 'Amistades y Marcador de Líderes'}
                </h4>
                <p className="text-xs text-slate-300 serif-font italic">
                  {appLanguage === 'pt' ? 'Classificação combinada de louvores históricos.' : appLanguage === 'en' ? 'Combined historical praise ranking.' : 'Clasificación combinada de alabanzas históricas.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {competitors.some((c) => c.hymnalHighscore > 0 || c.youthHighscore > 0) && onClearCompetitors && (
                  <button
                    onClick={() => {
                      if (showConfirmReset) {
                        onClearCompetitors();
                        setShowConfirmReset(false);
                      } else {
                        setShowConfirmReset(true);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs border rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 transition-all cursor-pointer font-bold ${
                      showConfirmReset
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30 shadow shadow-rose-500/10'
                        : 'text-slate-400 hover:text-rose-400 border-white/5 hover:border-rose-900/30 bg-slate-950/40'
                    }`}
                  >
                    <Trash2 className="h-3 w-3" />
                    {showConfirmReset 
                      ? (appLanguage === 'pt' ? 'Confirmar Zerar?' : appLanguage === 'en' ? 'Confirm Reset?' : '¿Confirmar Reinicio?') 
                      : (appLanguage === 'pt' ? 'Zerar Pontuações' : appLanguage === 'en' ? 'Reset Scores' : 'Reiniciar Puntuaciones')}
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                  {appLanguage === 'pt' ? 'Competidores' : appLanguage === 'en' ? 'Competitors' : 'Competidores'}: {competitors.length}
                </span>
              </div>
            </div>

            {/* PROJEÇÃO EM SEGUNDA TELA CARD */}
            <div className="p-4 bg-amber-500/5 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="text-left space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold rounded-full uppercase tracking-wider">
                  <Tv className="h-3 w-3" /> {appLanguage === 'pt' ? 'Transmissão do Placar' : appLanguage === 'en' ? 'Scoreboard Broadcast' : 'Transmisión del Marcador'}
                </span>
                <h4 className="text-xs font-bold text-white uppercase tracking-tight">
                  {appLanguage === 'pt' ? 'Projetar Placar de Líderes' : appLanguage === 'en' ? 'Project Leaderboard' : 'Proyectar Marcador de Líderes'}
                </h4>
                <p className="text-[11px] text-slate-400 serif-font italic">
                  {appLanguage === 'pt' 
                    ? 'Abra a segunda tela para projetar as classificações atuais em tempo real para os espectadores.'
                    : appLanguage === 'en'
                    ? 'Open the second screen to project current rankings in real time for viewers.'
                    : 'Abra la segunda pantalla para proyectar las clasificaciones actuales en tiempo real para los espectadores.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] sm:text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={revealSequential}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setRevealSequential(val);
                      localStorage.setItem('adventist_voice_leaderboard_reveal', val ? 'true' : 'false');
                      if (isProjecting) {
                        syncLeaderboard(val);
                      }
                    }}
                    className="accent-amber-500 rounded border-white/10 bg-slate-950 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>
                    {appLanguage === 'pt' 
                      ? 'Revelar de baixo para cima (Suspense)' 
                      : appLanguage === 'en' 
                      ? 'Reveal bottom-up (Suspense)' 
                      : 'Revelar de abajo hacia arriba (Suspenso)'}
                  </span>
                </label>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {isProjecting && (
                    <button
                      onClick={() => syncLeaderboard(revealSequential)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-white/10 rounded-lg text-amber-400 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] font-semibold"
                      title="Reiniciar a classificação gradual na segunda tela"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{appLanguage === 'pt' ? 'Re-revelar' : appLanguage === 'en' ? 'Re-reveal' : 'Volver a revelar'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (isProjecting) {
                        stopLeaderboardProject();
                      } else {
                        syncLeaderboard(revealSequential);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      isProjecting
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow shadow-rose-600/20'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow shadow-amber-500/20'
                    }`}
                  >
                    <Tv className="h-3.5 w-3.5" />
                    {isProjecting 
                      ? (appLanguage === 'pt' ? 'Parar Projeção' : appLanguage === 'en' ? 'Stop Projection' : 'Parar Proyección') 
                      : (appLanguage === 'pt' ? 'Projetar no Placar' : appLanguage === 'en' ? 'Project Scoreboard' : 'Proyectar Marcador')}
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-950/40 text-slate-400 border-b border-white/5 text-[9px] sm:text-[10px] tracking-wider uppercase font-extrabold">
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                      {appLanguage === 'pt' ? 'Posição' : appLanguage === 'en' ? 'Rank' : 'Posición'}
                    </th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                      {appLanguage === 'pt' ? 'Cantor' : appLanguage === 'en' ? 'Singer' : 'Cantor'}
                    </th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                      {appLanguage === 'pt' ? 'Recorde Hinário' : appLanguage === 'en' ? 'Hymnal High' : 'Himnario Récord'}
                    </th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                      {appLanguage === 'pt' ? 'Recorde CD Jovem' : appLanguage === 'en' ? 'Youth CD High' : 'CD Joven Récord'}
                    </th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4 text-right">
                      {appLanguage === 'pt' ? 'Ação' : appLanguage === 'en' ? 'Action' : 'Acción'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {/* Sort competitors by highest aggregate scores */}
                  {[...competitors]
                    .sort(
                      (a, b) =>
                        Math.max(b.hymnalHighscore, b.youthHighscore) -
                        Math.max(a.hymnalHighscore, a.youthHighscore)
                    )
                    .map((comp, index) => {
                      const medalColors = ['text-amber-400', 'text-slate-300', 'text-amber-500/80'];
                      const isPodium = index < 3;

                      return (
                        <tr
                          key={comp.name}
                          className="hover:bg-slate-950/20 transition-colors align-middle"
                        >
                          <td className="py-3 px-3 sm:px-4 font-mono font-bold text-xs sm:text-sm">
                            {isPodium ? (
                              <span className={`inline-flex items-center gap-1 ${medalColors[index]}`}>
                                🏆 {index + 1}
                              </span>
                            ) : (
                              <span className="text-slate-500 pl-3 sm:pl-4">{index + 1}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <span className="text-xl sm:text-2xl bg-slate-950/60 h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
                                {comp.avatar}
                              </span>
                              <div>
                                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                  {comp.name}
                                  {comp.isCustom && (
                                    <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 px-1 rounded text-amber-500 font-semibold uppercase tracking-wider">
                                      Amigo
                                    </span>
                                  )}
                                </p>
                                <p className="text-[9px] sm:text-[10px] text-slate-400">
                                  {appLanguage === 'pt' ? 'Membro desde' : appLanguage === 'en' ? 'Member since' : 'Miembro desde'} {comp.joinedDate}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 sm:px-4">
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {comp.hymnalHighscore > 0 ? `${comp.hymnalHighscore} pts` : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4">
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {comp.youthHighscore > 0 ? `${comp.youthHighscore} pts` : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                                <Trophy className="h-3 w-3 text-amber-400" />
                                {appLanguage === 'pt' ? 'Competindo' : appLanguage === 'en' ? 'Competing' : 'Compitiendo'}
                              </span>
                              {onDeleteCompetitor && (
                                <div className="flex items-center gap-1.5">
                                  {deleteConfirmName === comp.name ? (
                                    <>
                                      <button
                                        onClick={() => {
                                          onDeleteCompetitor(comp.name);
                                          setDeleteConfirmName(null);
                                        }}
                                        title={appLanguage === 'pt' ? 'Confirmar exclusão' : appLanguage === 'en' ? 'Confirm deletion' : 'Confirmar eliminación'}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[9px] sm:text-[10px] font-bold hover:bg-rose-500/30 transition-all cursor-pointer shadow shadow-rose-500/10"
                                      >
                                        <Check className="h-2.5 w-2.5" />
                                        <span>{appLanguage === 'pt' ? 'Confirmar' : appLanguage === 'en' ? 'Confirm' : 'Confirmar'}</span>
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmName(null)}
                                        title={appLanguage === 'pt' ? 'Cancelar' : appLanguage === 'en' ? 'Cancel' : 'Cancelar'}
                                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setDeleteConfirmName(comp.name);
                                        setShowConfirmReset(false);
                                        setShowConfirmClearHistory(false);
                                      }}
                                      title={appLanguage === 'pt' ? 'Remover Competidor' : appLanguage === 'en' ? 'Remove Competitor' : 'Eliminar Competidor'}
                                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          /* Recent score logs list */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 glass-panel overflow-hidden shadow-2xl space-y-4"
          >
            <div className="p-4 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
              <div>
                <h4 className="font-display font-extrabold text-white text-sm uppercase tracking-tight">
                  {appLanguage === 'pt' ? 'Histórico Vocal Recente' : appLanguage === 'en' ? 'Recent Vocal History' : 'Historial Vocal Reciente'}
                </h4>
                <p className="text-xs text-slate-300 serif-font italic">
                  {appLanguage === 'pt' 
                    ? 'Suas pontuações e registros passados salvos de forma offline.' 
                    : appLanguage === 'en' 
                    ? 'Your past scores and records saved offline.' 
                    : 'Tus puntuaciones y registros pasados guardados localmente.'}
                </p>
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (showConfirmClearHistory) {
                      onClearHistory();
                      setShowConfirmClearHistory(false);
                    } else {
                      setShowConfirmClearHistory(true);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-all cursor-pointer font-bold ${
                    showConfirmClearHistory
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30 shadow shadow-rose-500/10'
                      : 'text-slate-400 hover:text-rose-400 border-white/5 hover:border-rose-900/30 bg-slate-950/40'
                  }`}
                >
                  <Trash2 className="h-3 w-3" />
                  {showConfirmClearHistory 
                    ? (appLanguage === 'pt' ? 'Confirmar Limpar?' : appLanguage === 'en' ? 'Confirm Clear?' : '¿Confirmar Limpiar?') 
                    : (appLanguage === 'pt' ? 'Limpar tudo' : appLanguage === 'en' ? 'Clear all' : 'Limpiar todo')}
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="overflow-x-auto pb-4 w-full">
                <table className="w-full text-left border-collapse min-w-[550px]">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 border-b border-white/5 text-[9px] sm:text-[10px] tracking-wider uppercase font-extrabold">
                      <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                        {appLanguage === 'pt' ? 'Música / Louvor' : appLanguage === 'en' ? 'Song / Praise' : 'Canción / Alabanza'}
                      </th>
                      <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                        {appLanguage === 'pt' ? 'Cantor' : appLanguage === 'en' ? 'Singer' : 'Cantor'}
                      </th>
                      <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                        {appLanguage === 'pt' ? 'Pontuação' : appLanguage === 'en' ? 'Score' : 'Puntuación'}
                      </th>
                      <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                        {appLanguage === 'pt' ? 'Precisão' : appLanguage === 'en' ? 'Accuracy' : 'Precisión'}
                      </th>
                      <th className="py-2.5 px-3 sm:py-3 sm:px-4">
                        {appLanguage === 'pt' ? 'Avaliação' : appLanguage === 'en' ? 'Rating' : 'Evaluación'}
                      </th>
                      <th className="py-2.5 px-3 sm:py-3 sm:px-4 text-right">
                        {appLanguage === 'pt' ? 'Data' : appLanguage === 'en' ? 'Date' : 'Fecha'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[...history]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((record) => (
                        <tr key={record.id} className="hover:bg-white/[0.02] transition-colors align-middle">
                          <td className="py-3 px-3 sm:px-4">
                            <p className="text-xs sm:text-sm font-bold text-white serif-font">{record.songTitle}</p>
                            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                              ⭐ {appLanguage === 'pt' ? 'Hino / Música' : appLanguage === 'en' ? 'Hymn / Song' : 'Himno / Canción'}
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-xs font-semibold text-slate-300">
                            {record.userName}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm font-mono font-black text-amber-500">
                            {record.score} pts
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-xs font-mono text-emerald-400 font-bold">
                            {record.accuracy}%
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-xs">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${
                                    i < record.stars
                                      ? 'text-amber-500 fill-amber-500'
                                      : 'text-slate-800'
                                  }`}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right text-[9px] sm:text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center justify-end gap-1 font-mono">
                              <Calendar className="h-3 w-3 text-amber-500" />
                              {new Date(record.date).toLocaleDateString(appLanguage === 'pt' ? 'pt-BR' : appLanguage === 'en' ? 'en-US' : 'es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-slate-500">
                <Users className="h-8 w-8 mx-auto text-slate-700 mb-3" />
                <p>{appLanguage === 'pt' ? 'Ainda não há histórico de cantorias salvas.' : appLanguage === 'en' ? 'No singing history saved yet.' : 'Aún no hay historial de cantos guardados.'}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
