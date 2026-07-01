import React, { useState } from 'react';
import { ScoreRecord, FriendCompetitor } from '../types';
import { Trophy, Users, History, UserPlus, Calendar, Trash2, Award, Sparkles, Star, Check, X } from 'lucide-react';
import { motion } from 'motion/react';

interface LeaderboardProps {
  history: ScoreRecord[];
  competitors: FriendCompetitor[];
  onAddCompetitor: (name: string, avatar: string) => void;
  onClearHistory: () => void;
  onClearCompetitors?: () => void;
  onDeleteCompetitor?: (name: string) => void;
  isLoading?: boolean;
}

const AVATAR_OPTIONS = ['🎤', '🎵', '🎹', '💫', '🦁', '🦉', '🎸', '🌟', '🕊️', '🔥'];

export default function Leaderboard({
  history,
  competitors,
  onAddCompetitor,
  onClearHistory,
  onClearCompetitors,
  onDeleteCompetitor,
}: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'lobby' | 'history'>('lobby');
  const [newFriendName, setNewFriendName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎤');
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmClearHistory, setShowConfirmClearHistory] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) {
      setErrorMessage('Por favor digite o nome do amigo.');
      return;
    }
    if (competitors.some((c) => c.name.toLowerCase() === newFriendName.trim().toLowerCase())) {
      setErrorMessage('Já existe um amigo cadastrado com esse nome.');
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
      <div className="lg:col-span-1 space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-white/10 glass-panel p-6 space-y-6"
        >
          <div className="flex items-center gap-2 pb-4 border-b border-white/5">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h3 className="font-display text-lg font-bold text-white uppercase tracking-tight">Estatísticas Gerais</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 text-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Total de Hinos
              </span>
              <span className="text-2xl font-extrabold text-amber-500 font-mono">{totalSongsSung}</span>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 text-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Média Precisão
              </span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">{averageAccuracy}%</span>
            </div>
          </div>

          {bestRecord ? (
            <div className="bg-slate-950/20 p-4 rounded-xl border border-white/5 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1 serif-font italic">
                <Award className="h-3.5 w-3.5 text-amber-500" /> Recorde Absoluto de Voz
              </span>
              <div className="flex justify-between items-center">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate serif-font">{bestRecord.songTitle}</p>
                  <p className="text-[10px] text-slate-400 italic">Por {bestRecord.userName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-amber-500 font-mono">{bestRecord.score} pts</p>
                  <p className="text-[10px] text-slate-400 font-semibold">{bestRecord.accuracy}% precisão</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400 italic p-4 bg-slate-950/20 rounded-xl border border-white/5 border-dashed serif-font">
              Cante seu primeiro louvor para gerar o recorde oficial!
            </div>
          )}
        </motion.div>

        {/* Add Friend Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 glass-panel p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-500" />
            <h3 className="font-display text-lg font-bold text-white uppercase tracking-tight">Adicionar Amigo</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed serif-font italic">
            Cadastre os seus amigos ou familiares de forma local para disputarem nos mesmos aparelhos e compararem refrões do hinário!
          </p>

          <form onSubmit={handleAddFriend} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                Nome do Cantor
              </label>
              <input
                type="text"
                maxLength={25}
                placeholder="Ex: João Silva"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                className="w-full bg-slate-950/80 text-xs text-white placeholder-slate-600 rounded-xl px-3 py-2 border border-white/5 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
                Escolha o Avatar
              </label>
              <div className="grid grid-cols-5 gap-2">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    type="button"
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    className={`h-9 w-9 text-lg rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
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
              Confirmar Cadastro
            </button>
          </form>
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
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lobby'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Amigos & Competidores
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setShowConfirmReset(false);
              setShowConfirmClearHistory(false);
              setDeleteConfirmName(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Histórico Recente
          </button>
        </div>

        {activeTab === 'lobby' ? (
          /* Competitive lobby scoreboard */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 glass-panel overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
              <div>
                <h4 className="font-display font-extrabold text-white text-sm uppercase tracking-tight">Amizades e Placar de Líderes</h4>
                <p className="text-xs text-slate-300 serif-font italic">Classificação combinada de louvores históricos.</p>
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
                    className={`inline-flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-all cursor-pointer font-bold ${
                      showConfirmReset
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30 shadow shadow-rose-500/10'
                        : 'text-slate-400 hover:text-rose-400 border-white/5 hover:border-rose-900/30 bg-slate-950/40'
                    }`}
                  >
                    <Trash2 className="h-3 w-3" />
                    {showConfirmReset ? 'Confirmar Zerar?' : 'Zerar Pontuações'}
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                  Competidores: {competitors.length}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 text-slate-400 border-b border-white/5 text-[10px] tracking-wider uppercase font-extrabold">
                    <th className="py-3 px-4">Rang</th>
                    <th className="py-3 px-4">Cantor</th>
                    <th className="py-3 px-4">Recorde Hinário</th>
                    <th className="py-3 px-4">Recorde CD Jovem</th>
                    <th className="py-3 px-4 text-right">Ação</th>
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
                          <td className="py-3.5 px-4 font-mono font-bold text-sm">
                            {isPodium ? (
                              <span className={`inline-flex items-center gap-1 ${medalColors[index]}`}>
                                🏆 {index + 1}
                              </span>
                            ) : (
                              <span className="text-slate-500 pl-4">{index + 1}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl bg-slate-950/60 h-8 w-8 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
                                {comp.avatar}
                              </span>
                              <div>
                                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                  {comp.name}
                                  {comp.isCustom && (
                                    <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 px-1 rounded text-amber-500 font-semibold uppercase tracking-wider">
                                      Amigo
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400">Membro desde {comp.joinedDate}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {comp.hymnalHighscore > 0 ? `${comp.hymnalHighscore} pts` : '-'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {comp.youthHighscore > 0 ? `${comp.youthHighscore} pts` : '-'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                                <Trophy className="h-3 w-3 text-amber-400" />
                                Competindo
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
                                        title="Confirmar exclusão"
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold hover:bg-rose-500/30 transition-all cursor-pointer shadow shadow-rose-500/10"
                                      >
                                        <Check className="h-3 w-3" />
                                        <span>Confirmar</span>
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmName(null)}
                                        title="Cancelar"
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
                                      title="Remover Competidor"
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
                <h4 className="font-display font-extrabold text-white text-sm uppercase tracking-tight">Histórico Vocal Recente</h4>
                <p className="text-xs text-slate-300 serif-font italic">Suas pontuações e registros passados salvos de forma offline.</p>
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
                  {showConfirmClearHistory ? 'Confirmar Limpar?' : 'Limpar tudo'}
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="overflow-x-auto pb-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 border-b border-white/5 text-[10px] tracking-wider uppercase font-extrabold">
                      <th className="py-3 px-4">Música / Louvor</th>
                      <th className="py-3 px-4">Cantor</th>
                      <th className="py-3 px-4">Pontuação</th>
                      <th className="py-3 px-4">Precisão</th>
                      <th className="py-3 px-4">Avaliação</th>
                      <th className="py-3 px-4 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[...history]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((record) => (
                        <tr key={record.id} className="hover:bg-white/[0.02] transition-colors align-middle">
                          <td className="py-3 px-4">
                            <p className="text-sm font-bold text-white serif-font">{record.songTitle}</p>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                              ⭐ Hino / Música
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-slate-300">
                            {record.userName}
                          </td>
                          <td className="py-3 px-4 text-sm font-mono font-black text-amber-500">
                            {record.score} pts
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-emerald-400 font-bold">
                            {record.accuracy}%
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${
                                    i < record.stars
                                      ? 'text-amber-500 fill-amber-500'
                                      : 'text-slate-800'
                                  }`}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center justify-end gap-1 font-mono">
                              <Calendar className="h-3 w-3 text-amber-500" />
                              {new Date(record.date).toLocaleDateString('pt-BR', {
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
                <p>Ainda não há histórico de cantorias salvas.</p>
                <p className="text-xs text-slate-600 mt-1">Cante primeiro para ver o histórico!</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
