import React, { useState, useRef, useEffect } from 'react';
import { Song, LyricLine, MelodyNote, SongCategory, SongDifficulty, SongLanguage } from '../types';
import { AppLanguage, translations } from '../utils/translations';
import { 
  Plus, Trash2, Play, Pause, Save, RotateCcw, FileAudio, Music, 
  Settings2, HelpCircle, CheckCircle2, ChevronRight, Sliders, 
  Trash, Calendar, ArrowLeft, ArrowRight, ShieldCheck, RefreshCw,
  PlusCircle, Edit, Undo
} from 'lucide-react';

interface AdminManagerProps {
  customSongs: Song[];
  onSaveCustomSongs: (songs: Song[]) => void;
  onExit: () => void;
  onSelectAndPlay: (song: Song) => void;
  appLanguage: AppLanguage;
  loginEmail: string | null;
  onLogin: (email: string | null) => void;
}

export default function AdminManager({ 
  customSongs, 
  onSaveCustomSongs, 
  onExit, 
  onSelectAndPlay,
  appLanguage,
  loginEmail,
  onLogin
}: AdminManagerProps) {
  const t = translations[appLanguage];

  // Login Form States
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Navigation View Mode
  const [adminView, setAdminView] = useState<'list' | 'add' | 'sync'>('list');
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  
  // Form State (New Song Information)
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState<SongCategory>('Hinário');
  const [numberOrYear, setNumberOrYear] = useState('');
  const [bpm, setBpm] = useState(80);
  const [difficulty, setDifficulty] = useState<SongDifficulty>('Médio');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<SongLanguage>('pt');
  const [rawLyricsText, setRawLyricsText] = useState(
    "Exemplo de linha 1 do hino\nExemplo de linha 2 do hino\nExemplo de linha 3 do hino"
  );

  // Synchronization Process State
  const [syncedLines, setSyncedLines] = useState<LyricLine[]>([]);
  const [syncingLineIndex, setSyncingLineIndex] = useState(0);
  const [isLinePressed, setIsLinePressed] = useState(false); // false = ready to start, true = ready to end

  // Audio Playback during synchronization
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [songTime, setSongTime] = useState(0);
  
  // Simulated metronome clock if no real MP3 is uploaded
  const [useVirtualPlayer, setUseVirtualPlayer] = useState(true);
  const virtualTimerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Handle Drag & Drop of Audio Files
  const [isDragging, setIsDragging] = useState(false);

  // Projection / singing stage settings
  const [scoreMode, setScoreMode] = useState(() => {
    return localStorage.getItem('adventist_voice_score_mode') || 'complete';
  });
  const [autoOpen, setAutoOpen] = useState(() => {
    return localStorage.getItem('adventist_voice_auto_open') === 'true';
  });

  const broadcastSettings = (mode: string, open: boolean) => {
    fetch('/api/projector/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scoreDisplayMode: mode,
        autoOpenProjector: open
      })
    }).catch(() => {});
  };

  // Clean-up Audio URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      stopVirtualTimer();
    };
  }, [audioUrl]);

  // Sync virtual clock with simulation loop
  const startVirtualTimer = () => {
    stopVirtualTimer();
    setAudioPlaying(true);
    const interval = 100; // 100ms updates for precise syncing
    virtualTimerRef.current = window.setInterval(() => {
      setSongTime(prevTime => prevTime + (interval / 1000));
    }, interval);
  };

  const stopVirtualTimer = () => {
    if (virtualTimerRef.current) {
      clearInterval(virtualTimerRef.current);
      virtualTimerRef.current = null;
    }
    setAudioPlaying(false);
  };

  const togglePlayback = () => {
    if (useVirtualPlayer) {
      if (audioPlaying) {
        stopVirtualTimer();
      } else {
        startVirtualTimer();
      }
    } else if (audioElRef.current) {
      if (audioPlaying) {
        audioElRef.current.pause();
      } else {
        audioElRef.current.play().catch(e => console.error("Falha ao tocar áudio real:", e));
      }
    }
  };

  // Real Audio event Handlers
  const handleAudioTimeUpdate = () => {
    if (audioElRef.current) {
      setSongTime(audioElRef.current.currentTime);
    }
  };

  const handleAudioPlay = () => setAudioPlaying(true);
  const handleAudioPause = () => setAudioPlaying(false);

  // Process MP3 / audio file selection
  const handleAudioFileChange = (file: File) => {
    if (file) {
      setAudioFile(file);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const u = URL.createObjectURL(file);
      setAudioUrl(u);
      setUseVirtualPlayer(false);
      setSongTime(0);
      stopVirtualTimer();
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        handleAudioFileChange(file);
      }
    }
  };

  // Move from Info Form (Step 1) to Synchronization Stage (Step 2)
  const handleProceedToSync = () => {
    if (!title.trim()) {
      alert("Por favor, preencha o título da música.");
      return;
    }
    if (!artist.trim()) {
      alert("Por favor, preencha o nome do autor / artista.");
      return;
    }

    // Split lyrics text by line breaks, filter empty or spacer lines
    const currentLinesText = rawLyricsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const parsedLines = currentLinesText.map((lineText, idx) => {
      // 1. First choice: line at exact same index has exact same text
      const existingLineAtIndex = syncedLines[idx];
      if (existingLineAtIndex && existingLineAtIndex.text === lineText) {
        return {
          text: lineText,
          time: existingLineAtIndex.time,
          endTime: existingLineAtIndex.endTime
        };
      }
      
      // 2. Second choice: find line with exact text match elsewhere in syncedLines
      const matchedLine = syncedLines.find(sl => sl.text === lineText);
      if (matchedLine) {
        return {
          text: lineText,
          time: matchedLine.time,
          endTime: matchedLine.endTime
        };
      }

      // 3. Fallback: line is new, metadata is set to zero
      return {
        text: lineText,
        time: 0,
        endTime: 0
      };
    });

    if (parsedLines.length === 0) {
      alert("Por favor, digite ao menos uma linha de letra.");
      return;
    }

    setSyncedLines(parsedLines);
    setSyncingLineIndex(0);
    setIsLinePressed(false);
    setSongTime(0);
    setAdminView('sync');
  };

  // Interactive Tap to Sync Logic
  const handleTapSync = () => {
    if (syncingLineIndex >= syncedLines.length) return;

    const currentTimeSnap = parseFloat(songTime.toFixed(2));
    const linesCopy = [...syncedLines];

    if (!isLinePressed) {
      // Step A: Mark of the Start of the active focus line
      linesCopy[syncingLineIndex] = {
        ...linesCopy[syncingLineIndex],
        time: currentTimeSnap,
        endTime: parseFloat((currentTimeSnap + 4.0).toFixed(2)) // temporary tentative 4 seconds block
      };
      setIsLinePressed(true);
    } else {
      // Step B: Mark the End of the active focus line and transition
      let startOfLine = linesCopy[syncingLineIndex].time;
      let finalEnd = currentTimeSnap;
      
      // Ensure duration is always positive and normalized
      if (finalEnd <= startOfLine) {
        finalEnd = parseFloat((startOfLine + 1.5).toFixed(2));
      }

      linesCopy[syncingLineIndex] = {
        ...linesCopy[syncingLineIndex],
        time: startOfLine,
        endTime: finalEnd
      };

      const nextIndex = syncingLineIndex + 1;
      if (nextIndex < syncedLines.length) {
        // Auto-start the next line's marker at the same millisecond the previous line ended
        linesCopy[nextIndex] = {
          ...linesCopy[nextIndex],
          time: finalEnd,
          endTime: parseFloat((finalEnd + 4.0).toFixed(2)) // temporary 4s duration
        };
        setSyncingLineIndex(nextIndex);
        setIsLinePressed(true);
      } else {
        setIsLinePressed(false);
        setSyncingLineIndex(nextIndex);
      }
    }

    setSyncedLines(linesCopy);
  };

  // Undo synchronization event
  const handleUndoSync = () => {
    const linesCopy = [...syncedLines];
    
    if (isLinePressed) {
      if (syncingLineIndex === 0) {
        // Reset very first line
        linesCopy[0] = { ...linesCopy[0], time: 0, endTime: 0 };
        setIsLinePressed(false);
      } else {
        // Cancel the current auto-started line and revert to the previous line
        linesCopy[syncingLineIndex] = { ...linesCopy[syncingLineIndex], time: 0, endTime: 0 };
        const prevIdx = syncingLineIndex - 1;
        // Make previous line active again, resetting its endTime back to temporary
        linesCopy[prevIdx] = {
          ...linesCopy[prevIdx],
          endTime: parseFloat((linesCopy[prevIdx].time + 4.0).toFixed(2))
        };
        setSyncingLineIndex(prevIdx);
        setIsLinePressed(true);
      }
    } else {
      // If we finished sync or was paused, go to previous line and make active
      if (syncingLineIndex > 0) {
        const prevIdx = syncingLineIndex - 1;
        linesCopy[prevIdx] = {
          ...linesCopy[prevIdx],
          endTime: parseFloat((linesCopy[prevIdx].time + 4.0).toFixed(2))
        };
        setSyncingLineIndex(prevIdx);
        setIsLinePressed(true);
      }
    }
    
    setSyncedLines(linesCopy);
  };

  // Keyboard shortcuts listener for Spacebar and Backspace inside Sync screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (adminView !== 'sync') return;
      const activeElem = document.activeElement;
      // Avoid triggering if editing numbers directly
      if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
        return;
      }
      
      if (e.code === 'Space') {
        e.preventDefault();
        handleTapSync();
      } else if (e.code === 'Backspace' || e.code === 'KeyZ') {
        e.preventDefault();
        handleUndoSync();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adminView, syncingLineIndex, isLinePressed, songTime, syncedLines]);

  // Direct manual fine-tuning edits
  const handleManualLineEdit = (index: number, field: 'time' | 'endTime', value: number) => {
    const updated = [...syncedLines];
    const normalized = parseFloat(Math.max(0, value).toFixed(2));
    updated[index] = {
      ...updated[index],
      [field]: normalized
    };
    
    // Quick validation correction
    if (field === 'time' && updated[index].endTime <= normalized) {
      updated[index].endTime = parseFloat((normalized + 2.0).toFixed(2));
    } else if (field === 'endTime' && updated[index].time >= normalized) {
      updated[index].time = parseFloat(Math.max(0, normalized - 2.0).toFixed(2));
    }

    setSyncedLines(updated);
  };

  // Fast preview helper: makes the audio/timer playhead jump exactly to the starting line segment to audition
  const handleAuditionLine = (line: LyricLine) => {
    setSongTime(line.time);
    if (!useVirtualPlayer && audioElRef.current) {
      audioElRef.current.currentTime = line.time;
      if (!audioPlaying) {
        audioElRef.current.play().catch(() => {});
        setAudioPlaying(true);
      }
    } else if (useVirtualPlayer) {
      if (!audioPlaying) {
        startVirtualTimer();
      }
    }
  };

  // Proportional Word melody builder for perfect integration with pitch grading engine
  const buildMidiMelodyFromLyrics = (lyrics: LyricLine[]): MelodyNote[] => {
    const melody: MelodyNote[] = [];
    const notesPool = [60, 62, 64, 65, 67, 69, 71, 72]; // scale arpeggios: C4, D4, E4, F4, G4, A4, B4, C5

    lyrics.forEach((lyric) => {
      const words = lyric.text.split(/\s+/).filter(w => w.length > 0);
      const lineDuration = lyric.endTime - lyric.time;
      if (words.length === 0 || lineDuration <= 0) return;

      const totalChars = words.reduce((acc, word) => acc + word.length, 0);
      let offsetAccumulator = 0;

      words.forEach((word, wordIndex) => {
        const charWeight = word.length / totalChars;
        const wordDuration = charWeight * lineDuration;
        const noteStartTime = lyric.time + offsetAccumulator;

        // Create elegant pitch patterns to guide the vocal synthesizer
        const midiPitch = notesPool[wordIndex % notesPool.length];

        melody.push({
          time: parseFloat(noteStartTime.toFixed(2)),
          duration: parseFloat(Math.max(0.15, wordDuration - 0.05).toFixed(2)),
          note: midiPitch,
          text: word
        });

        offsetAccumulator += wordDuration;
      });
    });

    return melody;
  };

  // Compile and Save Custom Song to database
  const handleSaveCompiledSong = () => {
    // Basic verification of timings
    const timingIssues = syncedLines.some(line => line.time === 0 && line.endTime === 0);
    if (timingIssues) {
      const confirmSave = window.confirm(
        "Atenção: Algumas linhas estão com tempo zerado. Deseja salvar mesmo assim?"
      );
      if (!confirmSave) return;
    }

    const generatedMelody = buildMidiMelodyFromLyrics(syncedLines);
    let nextCustomSongs: Song[];
    const isEditMode = !!editingSongId;
    const finalSongId = editingSongId || `custom-${Date.now()}`;

    const updatedSong: Song = {
      id: finalSongId,
      title: title.trim(),
      category: category,
      numberOrYear: numberOrYear.trim() || (category === 'Hinário' ? 'Hino Avulso' : 'CD Jovem'),
      artist: artist.trim(),
      bpm: bpm,
      difficulty: difficulty,
      description: description.trim() || 'Música personalizada cadastrada através da área de criação.',
      lyrics: syncedLines,
      melody: generatedMelody,
      audioFile: audioFile || undefined,
      language: language
    };

    if (isEditMode) {
      nextCustomSongs = customSongs.map(s => s.id === finalSongId ? updatedSong : s);
    } else {
      nextCustomSongs = [updatedSong, ...customSongs];
    }

    onSaveCustomSongs(nextCustomSongs);

    // Reset workflow State
    setEditingSongId(null);
    setTitle('');
    setArtist('');
    setNumberOrYear('');
    setDescription('');
    setLanguage('pt');
    setRawLyricsText('');
    setAudioFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    stopVirtualTimer();
    setSongTime(0);

    alert(`Sucesso! "${updatedSong.title}" foi ${isEditMode ? 'atualizada' : 'compilada'} e salva localmente no navegador.`);
    setAdminView('list');
  };

  // Remove a Custom song
  const handleDeleteCustomSong = (id: string, titleName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir "${titleName}"? Esta ação removerá a música e seus recordes locais permanentemente.`)) {
      const nextList = customSongs.filter(s => s.id !== id);
      onSaveCustomSongs(nextList);
    }
  };

  // Turn into manual editing mode of an existing song
  const handleEditCustomSong = (song: Song) => {
    setEditingSongId(song.id);
    setTitle(song.title);
    setArtist(song.artist);
    setCategory(song.category);
    setNumberOrYear(song.numberOrYear);
    setBpm(song.bpm);
    setDifficulty(song.difficulty);
    setDescription(song.description || '');
    setLanguage(song.language || 'pt');
    
    // Convert current list of sentences to plain-text separated lines
    const lyricsJoined = song.lyrics.map(l => l.text).join('\n');
    setRawLyricsText(lyricsJoined);

    // Track active sync alignments
    setSyncedLines(song.lyrics);
    setSyncingLineIndex(0);
    setIsLinePressed(false);

    // Audio backup track matching
    if (song.audioFile) {
      setAudioFile(song.audioFile);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(song.audioFile);
      setAudioUrl(url);
      setUseVirtualPlayer(false);
    } else {
      setAudioFile(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setUseVirtualPlayer(true);
    }

    setSongTime(0);
    setAdminView('add');
  };

  // Open empty wizard to add a new song
  const handleAddNewSongClick = () => {
    setEditingSongId(null);
    setTitle('');
    setArtist('');
    setCategory('Hinário');
    setNumberOrYear('');
    setBpm(80);
    setDifficulty('Médio');
    setDescription('');
    setLanguage('pt');
    setRawLyricsText(
      "Exemplo de linha 1 do hino\nExemplo de linha 2 do hino\nExemplo de linha 3 do hino"
    );
    setSyncedLines([]);
    setSyncingLineIndex(0);
    setIsLinePressed(false);
    setAudioFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setUseVirtualPlayer(true);
    setSongTime(0);
    setAdminView('add');
  };

  // Enforce non-admin security constraints
  if (loginEmail !== 'ronaldosonic@gmail.com' && adminView !== 'list') {
    setAdminView('list');
  }

  // Handle Login submission
  const handleSubmitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail) {
      setLoginError(appLanguage === 'pt' ? 'O e-mail é obrigatório.' : 'Email is required.');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setLoginError(appLanguage === 'pt' ? 'Por favor, insira um e-mail válido.' : 'Please enter a valid email.');
      return;
    }
    setLoginError('');
    onLogin(trimmedEmail);
  };

  if (!loginEmail) {
    return (
      <div className="w-full max-w-md mx-auto py-12 px-4 text-left">
        <div 
          className="glass-panel p-8 rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-slate-950/60 backdrop-blur-xl relative"
        >
          {/* Decorative ambient glow */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-12 w-12 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] mb-4">
              <ShieldCheck className="h-6 w-6 text-slate-950" />
            </div>
            <h2 className="font-display text-xl font-bold tracking-tight text-white">
              {appLanguage === 'pt' ? 'Acessar Configurações' : appLanguage === 'en' ? 'Access Settings' : 'Acceder a Configuración'}
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
              {appLanguage === 'pt' 
                ? 'Entre com seu e-mail para configurar a tela e gerenciar os louvores do Karaokê.' 
                : appLanguage === 'en' 
                ? 'Enter your email to configure the screen and manage Karaoke praises.' 
                : 'Ingrese su correo para configurar la pantalla y administrar las alabanzas de Karaoke.'}
            </p>
          </div>

          <form onSubmit={handleSubmitLogin} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                {appLanguage === 'pt' ? 'E-mail' : appLanguage === 'en' ? 'Email' : 'Correo electrónico'}
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="exemplo@gmail.com"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                {appLanguage === 'pt' ? 'Senha (opcional)' : appLanguage === 'en' ? 'Password (optional)' : 'Contraseña (opcional)'}
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            {loginError && (
              <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg text-left">
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-xs font-black text-slate-950 shadow-md hover:shadow-lg transition-all cursor-pointer mt-2"
            >
              {appLanguage === 'pt' ? 'Entrar' : appLanguage === 'en' ? 'Sign In' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-500 leading-normal">
              {appLanguage === 'pt'
                ? 'Nota: Use qualquer e-mail para acessar. Apenas o e-mail do administrador oficial (ronaldosonic@gmail.com) terá acesso para adicionar e editar músicas.'
                : appLanguage === 'en'
                ? 'Note: Use any email to access. Only the official administrator email (ronaldosonic@gmail.com) will have access to add and edit songs.'
                : 'Nota: Use cualquier correo para acceder. Solo el correo del administrador oficial (ronaldosonic@gmail.com) tendrá acceso para agregar y editar canciones.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-slate-100 font-sans">
      
      {/* Header Dashboard Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6 mb-8 text-left">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black rounded-md uppercase tracking-widest leading-none">
              {appLanguage === 'pt' ? 'Módulo Configuração' : appLanguage === 'en' ? 'Settings Module' : 'Módulo Configuración'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white m-0">
            {appLanguage === 'pt' ? (
              <>Painel de <span className="text-amber-500">Configurações & Louvores</span></>
            ) : appLanguage === 'en' ? (
              <>Settings & <span className="text-amber-500">Praise Panel</span></>
            ) : (
              <>Panel de <span className="text-amber-500">Configuraciones y Alabanzas</span></>
            )}
          </h1>
          <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
            {appLanguage === 'pt' 
              ? 'Ajuste as preferências de tela ou configure novos louvores para cantar em família ou na igreja.'
              : appLanguage === 'en'
              ? 'Adjust screen preferences or configure new praises to sing at family or church.'
              : 'Ajusta las preferencias de pantalla o configura nuevas alabanzas para cantar em família ou na igreja.'}
          </p>
          
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-slate-300 font-semibold font-mono">
              👤 {loginEmail}
            </span>
            <span className={`text-[10px] px-2 py-1 rounded-lg font-bold border ${
              loginEmail === 'ronaldosonic@gmail.com' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
            }`}>
              {loginEmail === 'ronaldosonic@gmail.com' 
                ? (appLanguage === 'pt' ? 'Administrador' : 'Administrator')
                : (appLanguage === 'pt' ? 'Membro' : 'Member')
              }
            </span>
            <button
              onClick={() => onLogin(null)}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors font-bold ml-1 hover:underline cursor-pointer"
            >
              [{appLanguage === 'pt' ? 'Sair' : 'Logout'}]
            </button>
          </div>
        </div>
        
        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-white/5 hover:border-white/15 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-md select-none"
        >
          <ArrowLeft className="h-4 w-4" />
          {appLanguage === 'pt' ? 'Voltar às Músicas' : appLanguage === 'en' ? 'Back to Songs' : 'Volver a las Canciones'}
        </button>
      </div>

      {/* VIEW A: LIST SONGS DASHBOARD */}
      {adminView === 'list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-950/40 border border-white/5 p-4 rounded-xl">
            <div className="text-left font-display">
              <h3 className="text-sm font-bold text-slate-200">
                {appLanguage === 'pt' ? 'Adicione e Sincronize' : appLanguage === 'en' ? 'Add & Synchronize' : 'Agrega y Sincroniza'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {appLanguage === 'pt' ? (
                  <>Você tem <span className="text-amber-400 font-black">{customSongs.length}</span> músicas customizadas salvas localmente.</>
                ) : appLanguage === 'en' ? (
                  <>You have <span className="text-amber-400 font-black">{customSongs.length}</span> custom songs saved locally.</>
                ) : (
                  <>Tienes <span className="text-amber-400 font-black">{customSongs.length}</span> canciones personalizadas guardadas localmente.</>
                )}
              </p>
            </div>
            
            <button
              onClick={handleAddNewSongClick}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25 transition-all duration-300 cursor-pointer select-none"
            >
              <PlusCircle className="h-4 w-4" />
              {appLanguage === 'pt' ? 'Nova Música' : appLanguage === 'en' ? 'New Song' : 'Nueva Canción'}
            </button>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
            <div className="p-4.5 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-extrabold flex items-center gap-1.5 font-display">
                <Music className="h-4 w-4 text-amber-500" />
                {appLanguage === 'pt' ? 'Músicas Customizadas' : appLanguage === 'en' ? 'Custom Songs' : 'Canciones Personalizadas'} ({customSongs.length})
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {appLanguage === 'pt' ? 'ID ÚNICOS' : appLanguage === 'en' ? 'UNIQUE IDS' : 'IDS ÚNICOS'}
              </span>
            </div>

            {customSongs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-slate-900/60 border border-white/5 flex items-center justify-center text-slate-500 mb-4 animate-bounce">
                  🎵
                </div>
                <h4 className="text-sm font-bold text-slate-300">
                  {appLanguage === 'pt' ? 'Nenhuma Música Cadastrada' : appLanguage === 'en' ? 'No Songs Registered' : 'Ninguna Canción Registrada'}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                  {appLanguage === 'pt' 
                    ? 'Seja o primeiro a carregar um louvor da sua preferência! Você poderá inserir a letra e calibrar o ritmo passo a passo.'
                    : appLanguage === 'en'
                    ? 'Be the first to load a song of your choice! You can input the lyrics and calibrate the rhythm step by step.'
                    : '¡Sé el primero en cargar una alabanza de tu elección! Podrás ingresar la letra y calibrar el ritmo paso a paso.'}
                </p>
                <button
                  onClick={handleAddNewSongClick}
                  className="px-4 py-2 text-xs font-bold text-amber-400 border border-amber-500/20 hover:border-amber-400/50 hover:bg-amber-500/5 rounded-xl transition-all cursor-pointer"
                >
                  {appLanguage === 'pt' ? 'Criar Primeiro Louvor' : appLanguage === 'en' ? 'Create First Song' : 'Crear Primera Alabanza'}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5 bg-slate-950/20">
                {customSongs.map((song) => (
                  <div key={song.id} className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-all">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase py-0.5 px-1.5 border border-amber-500/20 text-amber-500 bg-amber-500/5 rounded">
                          {song.category}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono">
                          {song.numberOrYear}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 ml-1 flex items-center gap-0.5">
                          <Sliders className="h-2.5 w-2.5" />
                          {song.lyrics.length} estrofes
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1.5 truncate serif-font">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-semibold italic mt-0.5">
                        Por {song.artist} • <span className="opacity-70 font-mono text-[10px]">BPM {song.bpm} • {song.difficulty}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onSelectAndPlay(song)}
                        className="p-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title={appLanguage === 'pt' ? 'Ir para tela de Karaokê' : appLanguage === 'en' ? 'Go to Karaoke stage' : 'Ir al escenario de Karaoke'}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span className="hidden sm:inline">{appLanguage === 'pt' ? 'Cantar' : appLanguage === 'en' ? 'Sing' : 'Cantar'}</span>
                      </button>

                      <button
                        onClick={() => handleEditCustomSong(song)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-white/20 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title={appLanguage === 'pt' ? 'Editar' : appLanguage === 'en' ? 'Edit' : 'Editar'}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{appLanguage === 'pt' ? 'Editar' : appLanguage === 'en' ? 'Edit' : 'Editar'}</span>
                      </button>
                      
                      <button
                        onClick={() => handleDeleteCustomSong(song.id, song.title)}
                        className="p-2 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500/50 text-red-400 hover:text-white rounded-lg transition-all cursor-pointer"
                        title={appLanguage === 'pt' ? 'Excluir permanentemente' : appLanguage === 'en' ? 'Delete permanently' : 'Eliminar permanentemente'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips card details */}
          <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl flex items-start gap-3 w-full">
            <HelpCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-left">
              <h5 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                {appLanguage === 'pt' 
                  ? 'Como funciona a sincronia de voz?' 
                  : appLanguage === 'en' 
                  ? 'How does voice synchronization work?' 
                  : '¿Cómo funciona la sincronización de voz?'}
              </h5>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                {appLanguage === 'pt' 
                  ? 'Ao cadastrar sua música e marcar os tempos das estrofes, nosso sistema calcula e distribui os pesos das palavras automaticamente de forma matemática. Isso significa que as progressões visuais no karaokê se adaptam de forma sínpata, permitindo cantar de forma natural de forma similar às músicas oficiais!'
                  : appLanguage === 'en'
                  ? 'By registering your song and marking the timings of each verse, our system calculates and distributes word durations mathematically. This means visual progress in the karaoke adapts fluidly, allowing you to sing naturally, similar to official tracks!'
                  : '¡Al registrar tu canción y marcar los tiempos de las estrofas, nuestro sistema calcula y distribuye la duración de las palabras matemáticamente. Esto significa que las progresiones visuales en el karaoke se adaptan fluidamente, permitiéndote cantar de forma natural de manera similar a las pistas oficiales!'}
              </p>
            </div>
          </div>

          {/* CONFIGURAÇÕES DE CANTO E PROJEÇÃO */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-slate-950/40 text-left space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
              <Sliders className="h-5 w-5 text-amber-500" />
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-tight">
                  {t.generalConfig || 'Configurações de Tela'}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {appLanguage === 'pt' 
                    ? 'Controle o visual e comportamento da segunda tela ou projetor digital.' 
                    : appLanguage === 'en'
                    ? 'Control the look and behavior of the second screen or digital projector.'
                    : 'Controla el aspecto y comportamiento de la segunda pantalla o proyector digital.'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Score Display Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {t.scoreModeLabel || 'Exibição de Pontuação na Projeção'}
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {appLanguage === 'pt' 
                    ? 'Defina o que aparecerá na tela do projetor ao concluir um louvor, ideal para criar expectativa.' 
                    : appLanguage === 'en'
                    ? 'Define what will appear on the projector screen upon finishing a song, ideal for building suspense.'
                    : 'Define qué aparecerá en la pantalla del proyector al finalizar un canto, ideal para crear expectativa.'}
                </p>
                <select
                  value={scoreMode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScoreMode(val);
                    localStorage.setItem('adventist_voice_score_mode', val);
                    broadcastSettings(val, autoOpen);
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  <option value="complete">{t.scoreModeComplete || 'Completo (Pontos, Estrelas e Precisão %)'}</option>
                  <option value="hidden">{t.scoreModeHidden || 'Ocultar Pontuação (Suspense total!)'}</option>
                  <option value="stars_only">{t.scoreModeStars || 'Exibir apenas Estrelas'}</option>
                  <option value="percentage_only">{t.scoreModePercentage || 'Exibir apenas Porcentagem de Precisão'}</option>
                </select>
              </div>

              {/* Auto Open Second Screen Toggle */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {t.autoOpenLabel || 'Ativar Segunda Tela no Início'}
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {appLanguage === 'pt' 
                    ? 'Ativa a abertura automática do projetor assim que você abrir o programa Adventist Voice.' 
                    : appLanguage === 'en'
                    ? 'Enables automatic opening of the projector as soon as you open the Adventist Voice program.'
                    : 'Activa la apertura automática del proyector tan pronto como abras el programa Adventist Voice.'}
                </p>
                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={() => {
                      setAutoOpen(true);
                      localStorage.setItem('adventist_voice_auto_open', 'true');
                      broadcastSettings(scoreMode, true);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
                      autoOpen
                        ? 'bg-amber-500 border-amber-500 text-slate-950 font-extrabold'
                        : 'bg-slate-950 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300'
                    }`}
                  >
                    {t.autoOpenYes || 'Sim, abrir no início'}
                  </button>
                  <button
                    onClick={() => {
                      setAutoOpen(false);
                      localStorage.setItem('adventist_voice_auto_open', 'false');
                      broadcastSettings(scoreMode, false);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
                      !autoOpen
                        ? 'bg-amber-500 border-amber-500 text-slate-950 font-extrabold'
                        : 'bg-slate-950 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300'
                    }`}
                  >
                    {t.autoOpenNo || 'Não, abrir manual'}
                  </button>
                </div>
                {autoOpen && (
                  <p className="text-[10px] text-amber-500/80 leading-normal font-semibold italic mt-1.5 bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg">
                    {t.autoOpenNotice || '* Nota: A segunda tela será aberta no primeiro clique que você der na página por segurança do navegador. Certifique-se de permitir pop-ups.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* VIEW B: WIZARD ADD - SONG METADATA FORM */}
      {adminView === 'add' && (
        <div className="space-y-6">
          <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex items-center gap-2">
            <Edit className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-300">
              {appLanguage === 'pt' ? 'Passo 1 de 2: Informações e Letra Completa' : appLanguage === 'en' ? 'Step 1 of 2: Information and Full Lyrics' : 'Paso 1 de 2: Información y Letra Completa'}
            </span>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t.titleInput || 'Título do Louvor'} *
                </label>
                <input
                  type="text"
                  placeholder={appLanguage === 'pt' ? 'Ex: Como Agradecer' : appLanguage === 'en' ? 'Ex: Thankful Heart' : 'Ej: Corazón Agradecido'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {appLanguage === 'pt' ? 'Autor ou Cantor' : appLanguage === 'en' ? 'Author or Singer' : 'Autor o Cantante'} *
                </label>
                <input
                  type="text"
                  placeholder={appLanguage === 'pt' ? 'Ex: Ministério Jovem' : appLanguage === 'en' ? 'Ex: Youth Ministry' : 'Ej: Ministerio Joven'}
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t.category || 'Categoria'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SongCategory)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Hinário">{t.hymnalTitle || 'Hinário Adventista'}</option>
                  <option value="CD Jovem">{t.youthTitle || 'CD Jovem / Outros'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t.numberYearInput || 'Número ou Ano'}
                </label>
                <input
                  type="text"
                  placeholder={appLanguage === 'pt' ? 'Ex: Hino 102 ou CD 2005' : appLanguage === 'en' ? 'Ex: Hymn 102 or CD 2005' : 'Ej: Himno 102 o CD 2005'}
                  value={numberOrYear}
                  onChange={(e) => setNumberOrYear(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t.bpmInput || 'Andamento (BPM)'}
                </label>
                <input
                  type="number"
                  min={40}
                  max={200}
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 80)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t.voiceDifficulty || 'Dificuldade da Voz'}
                </label>
                <div className="flex gap-2">
                  {(['Fácil', 'Médio', 'Difícil'] as SongDifficulty[]).map((dif) => {
                    const difLabel = dif === 'Fácil' ? (t.difficultyEasy || 'Fácil') : dif === 'Médio' ? (t.difficultyMedium || 'Médio') : (t.difficultyHard || 'Difícil');
                    return (
                      <button
                        key={dif}
                        type="button"
                        onClick={() => setDifficulty(dif)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${
                          difficulty === dif
                            ? 'bg-amber-500 border-amber-500 text-slate-950'
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {difLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {appLanguage === 'pt' ? 'Idioma do Louvor' : appLanguage === 'en' ? 'Praise Language' : 'Idioma del Canto'}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SongLanguage)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="pt">{t.langPt || 'Português 🇧🇷'}</option>
                  <option value="en">{t.langEn || 'Inglês 🇺🇸'}</option>
                  <option value="es">{t.langEs || 'Espanhol 🇪🇸'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t.songDescription || 'Uma breve descrição (Opcional)'}
                </label>
                <input
                  type="text"
                  placeholder={appLanguage === 'pt' ? 'Ex: Linda canção sobre fé.' : appLanguage === 'en' ? 'Ex: Beautiful song about faith.' : 'Ej: Hermosa canción sobre la fe.'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Lyrics block description */}
            <div className="pt-2 border-t border-white/5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                {t.lyricsInput || 'Letra do Louvor *'}
              </label>
              <p className="text-[10px] text-slate-500 mb-2 leading-none">
                {t.lyricsDesc || 'Insira cada estrofe/frase da música em uma linha separada. Não pule linhas vazias desnecessariamente.'}
              </p>
              <textarea
                rows={8}
                placeholder={appLanguage === 'pt' ? 'Exemplo:\nSe a paz a mais doce me der gozo ter...' : appLanguage === 'en' ? 'Example:\nWhen peace like a river attendeth my way...' : 'Ejemplo:\nCuando en paz la corriente de la vida sigo...'}
                value={rawLyricsText}
                onChange={(e) => setRawLyricsText(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setAdminView('list')}
                className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                {appLanguage === 'pt' ? 'Cancelar' : appLanguage === 'en' ? 'Cancel' : 'Cancelar'}
              </button>

              <button
                type="button"
                onClick={handleProceedToSync}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 transition-all cursor-pointer shadow-lg"
              >
                {appLanguage === 'pt' ? 'Ir para Sincronização' : appLanguage === 'en' ? 'Go to Sync' : 'Ir a Sincronización'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}


      {/* VIEW C: TIMING CALIBRATOR (SYNC MODE) */}
      {adminView === 'sync' && (
        <div className="space-y-6">
          <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-300">
                {appLanguage === 'pt' ? 'Passo 2 de 2: Calibrador de Tempos & Sync' : appLanguage === 'en' ? 'Step 2 of 2: Time Calibration & Sync' : 'Paso 2 de 2: Calibrador de Tiempos y Sincronía'}
              </span>
            </div>
            
            <button
              onClick={() => {
                const confirmMsg = appLanguage === 'pt' 
                  ? 'Abandonar calibração e voltar para as informações da música?' 
                  : appLanguage === 'en' 
                  ? 'Abandon calibration and return to song information?' 
                  : '¿Abandonar la calibración y volver a la información de la canción?';
                if (window.confirm(confirmMsg)) {
                  stopVirtualTimer();
                  setAdminView('add');
                }
              }}
              className="text-xs text-amber-400 hover:text-white font-bold cursor-pointer"
            >
              {appLanguage === 'pt' ? '← Alterar Letra ou Título' : appLanguage === 'en' ? '← Change Lyrics or Title' : '← Cambiar Letra o Título'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
            
            {/* COLUMN 1: CONTROLS & INTERACTIVE SYNC TAPPER (PAGES left side 7 Cols) */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Box A: Audio File Loading Zone */}
              <div 
                className={`p-5 rounded-2xl border transition-all text-center relative ${
                  isDragging 
                    ? 'border-amber-400 bg-amber-500/5' 
                    : audioFile 
                      ? 'border-emerald-500/30 bg-emerald-500/[0.02]' 
                      : 'border-white/5 bg-slate-950/20'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
              >
                {!audioFile ? (
                  <div>
                    <FileAudio className="h-8 w-8 text-slate-600 mx-auto mb-2.5" />
                    <h4 className="text-xs font-bold text-slate-300">Quer sincronizar com o áudio oficial (.MP3)?</h4>
                    <p className="text-[10px] text-slate-500 max-w-md mx-auto mt-1 leading-normal">
                      Arraste o arquivo MP3 da música aqui ou clique para selecionar. Se não tiver o arquivo, não se preocupe, nosso <strong className="text-amber-500 font-semibold">Cronômetro Virtual</strong> simula o andamento da música perfeitamente para marcas!
                    </p>
                    
                    <div className="mt-3.5 flex justify-center items-center gap-4">
                      <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-bold text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer">
                        Selecionar MP3
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleAudioFileChange(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-slate-600 font-bold uppercase font-mono">OU</span>
                      <button
                        type="button"
                        onClick={() => {
                          setUseVirtualPlayer(true);
                          setAudioFile(null);
                        }}
                        className={`text-[11px] font-bold underline ${useVirtualPlayer ? 'text-amber-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Utilizar Cronômetro Virtual
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center">
                        <Music className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-emerald-400">Áudio Real Vinculado</h4>
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-[280px]">
                          {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAudioFile(null);
                        if (audioUrl) URL.revokeObjectURL(audioUrl);
                        setAudioUrl(null);
                        setUseVirtualPlayer(true);
                        setSongTime(0);
                        stopVirtualTimer();
                      }}
                      className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-wider"
                    >
                      Remover MP3
                    </button>
                  </div>
                )}

                {/* Secret HTML5 Player tag for synchronization */}
                {audioUrl && !useVirtualPlayer && (
                  <audio
                    ref={audioElRef}
                    src={audioUrl}
                    onTimeUpdate={handleAudioTimeUpdate}
                    onPlay={handleAudioPlay}
                    onPause={handleAudioPause}
                    className="hidden"
                  />
                )}
              </div>

              {/* Box B: Interactive Playhead controller */}
              <div className="p-5 rounded-2xl glass-panel border border-white/10 bg-slate-950/60 text-center space-y-4">
                <div className="flex justify-between items-center bg-slate-900/60 p-3.5 rounded-xl border border-white/5">
                  <div className="text-left font-mono">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Modo de Áudio</span>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                      {useVirtualPlayer ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                          Cronômetro Virtual
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Tocador de MP3 ativo
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Tempo Corrido</span>
                    <span className="text-2xl font-black text-amber-400">
                      {songTime.toFixed(1)}<span className="text-sm font-normal text-slate-500">s</span>
                    </span>
                  </div>
                </div>

                {/* Progress Slider bar for scrubbing (Only allowed in raw audio or simulated state) */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={audioElRef.current ? audioElRef.current.duration : 180}
                    step={0.1}
                    value={songTime}
                    onChange={(e) => {
                      const snapVal = parseFloat(e.target.value);
                      setSongTime(snapVal);
                      if (!useVirtualPlayer && audioElRef.current) {
                        audioElRef.current.currentTime = snapVal;
                      }
                    }}
                    className="w-full accent-amber-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0:00</span>
                    <span>Use a barra para buscar ou retroceder</span>
                    <span>{audioElRef.current ? Math.floor(audioElRef.current.duration) : 180}s</span>
                  </div>
                </div>

                {/* Play controls */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSongTime(0);
                      if (!useVirtualPlayer && audioElRef.current) {
                        audioElRef.current.currentTime = 0;
                      }
                    }}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Reiniciar player do início"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 hover:scale-105 active:scale-95 text-slate-950 font-black rounded-xl transition-all shadow-lg cursor-pointer select-none"
                  >
                    {audioPlaying ? (
                      <>
                        <Pause className="h-5 w-5 fill-current" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 fill-current" />
                        Play / Iniciar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Box C: Sync Interactive Calibration Trigger */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-500/10 to-amber-500/[0.01] border-2 border-amber-500/20 text-center space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest leading-none font-display">Sincronizador Dinâmico</p>
                  <h3 className="text-base font-bold text-white">Toque no botão no andamento do canto!</h3>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    Deixe a música tocar. Quando o cantor começar a linha, clique no botão ou aperte <strong className="text-white bg-slate-900 border border-white/10 px-1 py-0.5 rounded text-[10px]">Espaço</strong>. Ao finalizar aquela estrofe, clique novamente para salvar e passar para a próxima!
                  </p>
                </div>

                {/* GIANT TAP TRIGGER TRIGGER BUTTON */}
                <div className="py-2.5 flex flex-col items-center gap-3">
                  {syncingLineIndex < syncedLines.length ? (
                    <>
                      <button
                        type="button"
                        onClick={handleTapSync}
                        className={`w-full max-w-sm mx-auto py-8 px-4 rounded-3xl border transition-all shadow-xl flex flex-col justify-center items-center gap-2 cursor-pointer select-none active:scale-98 ${
                          isLinePressed
                            ? 'bg-amber-500/20 border-amber-400 text-amber-400 ring-2 ring-amber-400/20'
                            : 'bg-slate-950 border-white/10 hover:border-amber-400/50 text-slate-300'
                        }`}
                      >
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none">
                          Estrofe {syncingLineIndex + 1} de {syncedLines.length}
                        </span>
                        
                        <span className="text-xl font-extrabold font-display leading-tight tracking-tight mt-1 truncate max-w-xs px-2 italic serif-font">
                          "{syncedLines[syncingLineIndex].text}"
                        </span>

                        <span className="mt-3 px-4 py-1.5 bg-slate-900 border border-white/5 rounded-full text-xs font-black text-amber-400 tracking-wider font-display uppercase animate-pulse">
                          {isLinePressed ? '▶ FINALIZAR ESTROFE' : '● EXECUTAR INÍCIO'}
                        </span>
                      </button>

                      {/* UNDO BUTTON */}
                      {(syncingLineIndex > 0 || isLinePressed) && (
                        <button
                          type="button"
                          onClick={handleUndoSync}
                          className="px-4 py-2 border border-white/10 bg-slate-950/80 hover:bg-slate-900 rounded-xl text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                        >
                          <Undo className="h-3.5 w-3.5" />
                          Desfazer Marcação (Backspace / Z)
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="p-6 w-full max-w-sm bg-slate-950/80 border border-dashed border-emerald-500/30 rounded-2xl text-emerald-400 flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">Sincronização Concluída!</h4>
                      <p className="text-[11px] text-slate-500">Todas as linhas da letra foram calibradas com timestamps precisos.</p>
                      
                      <div className="flex gap-4 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSyncingLineIndex(0);
                            setIsLinePressed(false);
                          }}
                          className="text-xs text-amber-500 hover:text-white font-bold underline cursor-pointer"
                        >
                          Recomeçar Sincronia
                        </button>
                        <span className="text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={handleUndoSync}
                          className="text-xs text-slate-400 hover:text-white font-bold underline cursor-pointer"
                        >
                          Desfazer Última Linha
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                  <span>Dica: Use</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-900 border border-white/10 rounded font-bold font-mono text-[10px] text-slate-300">Espaço</kbd>
                  <span>do teclado para marcar tempos sem usar o mouse.</span>
                </div>
              </div>
            </div>


            {/* COLUMN 2: REAL-TIME TABLE & MANUAL ADJUSTMENTS (Pages right side 5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full max-h-[660px]">
                
                <div className="p-4 border-b border-white/5 bg-slate-950/50 flex justify-between items-center shrink-0">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-extrabold font-display flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-amber-400" />
                    Auditoria de Estrofes
                  </span>
                  
                  <button
                    onClick={() => {
                      if (window.confirm("Zerar todos os tempos e recomeçar a sintonização do zero?")) {
                        const resetList = syncedLines.map(l => ({ ...l, time: 0, endTime: 0 }));
                        setSyncedLines(resetList);
                        setSyncingLineIndex(0);
                        setIsLinePressed(false);
                        setSongTime(0);
                      }
                    }}
                    className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Reset Tempos
                  </button>
                </div>

                {/* SCROLLABLE TABLE VIEWER */}
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03] bg-slate-950/20 max-h-[480px]">
                  {syncedLines.map((line, idx) => {
                    const isPassed = syncingLineIndex > idx;
                    const isActiveNow = syncingLineIndex === idx;

                    return (
                      <div 
                        key={idx} 
                        className={`p-3.5 flex flex-col gap-2 transition-all ${
                          isActiveNow 
                            ? 'bg-amber-500/5 border-l-2 border-amber-500' 
                            : isPassed 
                              ? 'opacity-90 bg-emerald-500/[0.01]' 
                              : 'opacity-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 font-bold">
                            #{idx + 1}
                          </span>
                          
                          <p className={`text-xs text-left flex-1 font-medium italic truncate serif-font ${isActiveNow ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                            "{line.text}"
                          </p>

                          <button
                            type="button"
                            onClick={() => handleAuditionLine(line)}
                            className="text-[10px] font-bold text-amber-500/80 hover:text-amber-400 flex items-center gap-0.5 shrink-0 hover:underline cursor-pointer"
                            title="Ouvir este trecho"
                          >
                            <Play className="h-2 w-2 fill-current" />
                            Ouvir
                          </button>
                        </div>

                        {/* Timing controls input increments */}
                        <div className="flex items-center gap-4 bg-slate-950/60 p-2 rounded-lg border border-white/5 select-none text-[11px]">
                          <div className="flex items-center justify-between gap-1 flex-1">
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider leading-none shrink-0">Início</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleManualLineEdit(idx, 'time', line.time - 0.2)}
                                className="p-1 bg-slate-900 border border-white/5 rounded text-[9px] hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                -0.2
                              </button>
                              <span className="font-mono font-bold text-white min-w-[32px] text-center">
                                {line.time.toFixed(1)}s
                              </span>
                              <button
                                type="button"
                                onClick={() => handleManualLineEdit(idx, 'time', line.time + 0.2)}
                                className="p-1 bg-slate-900 border border-white/5 rounded text-[9px] hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                +0.2
                              </button>
                            </div>
                          </div>

                          <div className="w-[1px] h-4 bg-white/10 shrink-0" />

                          <div className="flex items-center justify-between gap-1 flex-1">
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider leading-none shrink-0">Fim</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleManualLineEdit(idx, 'endTime', line.endTime - 0.2)}
                                className="p-1 bg-slate-900 border border-white/5 rounded text-[9px] hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                -0.2
                              </button>
                              <span className="font-mono font-bold text-white min-w-[32px] text-center">
                                {line.endTime.toFixed(1)}s
                              </span>
                              <button
                                type="button"
                                onClick={() => handleManualLineEdit(idx, 'endTime', line.endTime + 0.2)}
                                className="p-1 bg-slate-900 border border-white/5 rounded text-[9px] hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                +0.2
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Compile and Save action bottom banner */}
                <div className="p-4 border-t border-white/5 bg-slate-950 flex flex-col gap-3 shrink-0 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    Compilador de Pautas pronto para salvar localmente.
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleSaveCompiledSong}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-xs font-black text-slate-950 font-display transition-all cursor-pointer shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25 active:scale-[0.99] select-none"
                  >
                    <Save className="h-4 w-4" />
                    Salvar Música e Sincronizar
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
