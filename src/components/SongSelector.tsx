import React, { useState, useEffect, useRef } from 'react';
import { Song, SongCategory, SongDifficulty, SongLanguage } from '../types';
import { Music, Search, Trophy, Disc, Award, HelpCircle, Check, Play, X, Download, Smartphone, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLanguage, translations } from '../utils/translations';

interface SongSelectorProps {
  songs: Song[];
  onSelectSong: (song: Song) => void;
  highscores: { [songId: string]: { score: number; accuracy: number; stars: number } };
  onNavigateToLeaderboard: () => void;
  appLanguage: AppLanguage;
}

export default function SongSelector({
  songs,
  onSelectSong,
  highscores,
  onNavigateToLeaderboard,
  appLanguage,
}: SongSelectorProps) {
  const t = translations[appLanguage];
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SongCategory | 'Todos'>('Todos');
  const [selectedDifficulty, setSelectedDifficulty] = useState<SongDifficulty | 'Todos'>('Todos');
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<'Todos' | 'pt' | 'en' | 'es'>('Todos');
  const [showHowTo, setShowHowTo] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

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

  // Initialize PWA detection
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Detect iOS
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Only show if on mobile and not already installed/standalone
    if (isMobile && !isStandalone) {
      const dismissed = sessionStorage.getItem('pwa-banner-dismissed');
      if (!dismissed) {
        setShowPwaBanner(true);
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (isMobile && !isStandalone) {
        setShowPwaBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted install');
          setShowPwaBanner(false);
        }
        setDeferredPrompt(null);
      });
    } else if (isIOS) {
      setShowIosGuide(true);
    } else {
      setShowAndroidGuide(true);
    }
  };

  const dismissPwaBanner = () => {
    setShowPwaBanner(false);
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Filter songs based on category, difficulty, language & search query
  const filteredSongs = songs.filter((song) => {
    const matchesCategory = selectedCategory === 'Todos' || song.category === selectedCategory;
    
    // Map translated difficulties to native categories
    let normalizedDifficulty: SongDifficulty | 'Todos' = selectedDifficulty;
    const matchesDifficulty = selectedDifficulty === 'Todos' || song.difficulty === normalizedDifficulty;
    
    const songLang = song.language || 'pt';
    const matchesLanguage = selectedLanguageFilter === 'Todos' || songLang === selectedLanguageFilter;

    const matchesSearch =
      song.title.toLowerCase().includes(search.toLowerCase()) ||
      song.artist.toLowerCase().includes(search.toLowerCase()) ||
      song.numberOrYear.toLowerCase().includes(search.toLowerCase()) ||
      songLang.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesDifficulty && matchesLanguage && matchesSearch;
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

  const getTranslatedDifficulty = (diff: SongDifficulty) => {
    if (diff === 'Fácil') return t.difficultyEasy;
    if (diff === 'Médio') return t.difficultyMedium;
    return t.difficultyHard;
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
                <span>{appLanguage === 'pt' ? 'Voltar' : appLanguage === 'en' ? 'Back' : 'Volver'} ({timeLeft}s)</span>
              </>
            ) : (
              <>
                <HelpCircle className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-amber-500" />
                <span>{t.howToSing}</span>
              </>
            )}
          </button>
        </div>

        <div className="relative z-10 w-full pr-28 sm:pr-32 lg:pr-36">
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
                  {appLanguage === 'pt' ? 'Solte a voz e adore em' : appLanguage === 'en' ? 'Sing and praise in' : 'Canta y adora en'} <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">{appLanguage === 'pt' ? 'tempo real' : appLanguage === 'en' ? 'real time' : 'tiempo real'}</span>
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed serif-font italic opacity-90 max-w-2xl">
                  {appLanguage === 'pt' 
                    ? '"Então minh\'alma canta a Ti Senhor..." O primeiro sistema de Karaokê Adventista com análise e pontuação vocal precisa direto no seu navegador. Escolha uma música do hinário ou dos CDs Jovem, ative seu microfone e divirta-se!'
                    : appLanguage === 'en'
                    ? '"Then sings my soul, my Savior God, to Thee..." The first Adventist Karaoke system with accurate vocal analysis and scoring right in your browser. Choose a song, enable your microphone and have fun!'
                    : '"Mi corazón entona esta canción..." El primer sistema de Karaoke Adventista con análisis vocal preciso y puntuación directamente en tu navegador. ¡Elige una canción, activa tu micrófono y diviértete!'}
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
                  {appLanguage === 'pt' ? 'Instruções Rápidas de Como Cantar' : appLanguage === 'en' ? 'Quick Instructions on How to Sing' : 'Instrucciones Rápidas de Cómo Cantar'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                    <span className="block text-amber-400 font-bold text-xs sm:text-sm mb-1">{appLanguage === 'pt' ? '1. Ligue o Microfone' : appLanguage === 'en' ? '1. Turn on Microphone' : '1. Enciende el Micrófono'}</span>
                    <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                      {appLanguage === 'pt' ? 'Clique em qualquer música e dê acesso ao microfone. Use fones para evitar captar o som dos alto-falantes.' : appLanguage === 'en' ? 'Click on any song and grant microphone access. Use headphones to prevent capturing speaker sound.' : 'Haz clic en cualquier canción y otorga acceso al micrófono. Usa auriculares para evitar captar el sonido del altavoz.'}
                    </p>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                    <span className="block text-amber-400 font-bold text-xs sm:text-sm mb-1">{appLanguage === 'pt' ? '2. Acerte o Tom' : appLanguage === 'en' ? '2. Match the Pitch' : '2. Encuentra el Tono'}</span>
                    <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                      {appLanguage === 'pt' ? 'A pauta virtual indica as notas do hino. Use a guia vocal sintetizada se precisar de ajuda com a melodia.' : appLanguage === 'en' ? 'The virtual staff indicates hymn notes. Use the synthesized vocal guide if you need help with the melody.' : 'El pentagrama virtual indica las notas del himno. Usa la guía vocal sintetizada si necesitas ayuda con la melodía.'}
                    </p>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                    <span className="block text-amber-400 font-bold text-xs sm:text-sm mb-1">{appLanguage === 'pt' ? '3. Veja seu Placar' : appLanguage === 'en' ? '3. See Your Score' : '3. Mira tu Puntuación'}</span>
                    <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                      {appLanguage === 'pt' ? 'O detector mede a frequência da voz em tempo real. Cantar com afinação certa cria combos e mais pontos!' : appLanguage === 'en' ? 'The detector measures voice frequency in real time. Singing in tune creates combos and more points!' : 'El detector mide la frecuencia de la voz en tiempo real. ¡Cantar afinado crea combos y más puntos!'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* PWA Mobile Download Banner */}
      {showPwaBanner && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/5 p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30 shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-display font-extrabold text-white flex items-center gap-1.5">
                {appLanguage === 'pt' ? 'Instalar App no Celular' : appLanguage === 'en' ? 'Install App on Phone' : 'Instalar App en el Celular'}
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase">PWA</span>
              </h4>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                {appLanguage === 'pt' 
                  ? 'Adicione à sua tela inicial para cantar com melhor desempenho, tela cheia e acesso rápido offline!'
                  : appLanguage === 'en'
                  ? 'Add to your home screen for better performance, full screen, and fast offline access!'
                  : '¡Agrégalo a tu pantalla de inicio para cantar con mejor rendimiento, pantalla completa y acceso rápido sin conexión!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleInstallClick}
              className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Download className="h-3.5 w-3.5" />
              {appLanguage === 'pt' ? 'Baixar Aplicativo' : appLanguage === 'en' ? 'Download App' : 'Descargar App'}
            </button>
            <button
              onClick={dismissPwaBanner}
              className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title={appLanguage === 'pt' ? 'Fechar' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* iOS Manual Guide Modal */}
      <AnimatePresence>
        {showIosGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-base font-display font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Smartphone className="text-amber-500 h-5 w-5" />
                  {appLanguage === 'pt' ? 'Como Instalar no iPhone / iPad' : 'How to Install on iPhone / iPad'}
                </h3>
                <button
                  onClick={() => setShowIosGuide(false)}
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {appLanguage === 'pt'
                  ? 'Como o Safari no iOS não possui botão de download automático, siga estes 3 passos simples para adicionar o app à sua tela de início:'
                  : 'Since Safari on iOS doesn\'t support automatic prompt, follow these 3 simple steps to add the app to your home screen:'}
              </p>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                  <div className="space-y-1">
                    <p className="font-bold text-white">
                      {appLanguage === 'pt' ? 'Toque no botão de Compartilhar' : 'Tap the Share Button'}
                    </p>
                    <p className="text-slate-400 flex items-center gap-1.5">
                      {appLanguage === 'pt' ? 'Localizado na barra de ferramentas do Safari' : 'Located in the toolbar of Safari'} 
                      <span className="inline-flex items-center justify-center p-1 bg-white/10 rounded text-amber-400"><Share className="h-3.5 w-3.5" /></span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                  <div className="space-y-1">
                    <p className="font-bold text-white">
                      {appLanguage === 'pt' ? 'Selecione "Adicionar à Tela de Início"' : 'Select "Add to Home Screen"'}
                    </p>
                    <p className="text-slate-400">
                      {appLanguage === 'pt' ? 'Role a lista de opções para baixo e clique no ícone "+" correspondente.' : 'Scroll down the option list and tap the corresponding "+" icon.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                  <div className="space-y-1">
                    <p className="font-bold text-white">
                      {appLanguage === 'pt' ? 'Clique em "Adicionar"' : 'Tap "Add"'}
                    </p>
                    <p className="text-slate-400">
                      {appLanguage === 'pt' ? 'No canto superior direito para confirmar a instalação. Pronto!' : 'In the top-right corner to confirm. Done!'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIosGuide(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                {appLanguage === 'pt' ? 'Entendi' : 'Got it'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Android/Others Manual Guide Modal */}
      <AnimatePresence>
        {showAndroidGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-base font-display font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Smartphone className="text-amber-500 h-5 w-5" />
                  {appLanguage === 'pt' ? 'Como Instalar no Android / Chrome' : 'How to Install on Android / Chrome'}
                </h3>
                <button
                  onClick={() => setShowAndroidGuide(false)}
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {appLanguage === 'pt'
                  ? 'Se a instalação direta não abriu, siga estes passos para adicionar o aplicativo pelo menu do navegador:'
                  : 'If the direct download did not launch, follow these steps to add the app via the browser menu:'}
              </p>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                  <div className="space-y-1">
                    <p className="font-bold text-white">
                      {appLanguage === 'pt' ? 'Abra as opções do navegador' : 'Open browser options'}
                    </p>
                    <p className="text-slate-400">
                      {appLanguage === 'pt' ? 'Toque no ícone de três pontinhos no canto superior direito.' : 'Tap the three-dots menu icon at the top right.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                  <div className="space-y-1">
                    <p className="font-bold text-white">
                      {appLanguage === 'pt' ? 'Selecione "Instalar aplicativo"' : 'Select "Install app"'}
                    </p>
                    <p className="text-slate-400">
                      {appLanguage === 'pt' ? 'Ou escolha "Adicionar à tela inicial" na lista.' : 'Or select "Add to Home screen" from the list.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                  <div className="space-y-1">
                    <p className="font-bold text-white">
                      {appLanguage === 'pt' ? 'Confirme e divirta-se!' : 'Confirm and enjoy!'}
                    </p>
                    <p className="text-slate-400">
                      {appLanguage === 'pt' ? 'O aplicativo será baixado e adicionado à sua tela inicial em segundos!' : 'The app will be downloaded and placed on your home screen in seconds!'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowAndroidGuide(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                {appLanguage === 'pt' ? 'Entendi' : 'Got it'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advanced Filter and Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between glass-panel p-4 rounded-2xl shadow-xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-slate-950/40 pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 border border-white/5 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <span className="text-xs text-slate-400 font-medium mr-1 md:block hidden">{t.category}:</span>
          <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5">
            {([
              { value: 'Todos', label: t.all },
              { value: 'Hinário', label: t.hymnal },
              { value: 'CD Jovem', label: t.youthCd }
            ] as const).map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Difficulty Filter */}
          <span className="text-xs text-slate-400 font-medium mr-1 md:block hidden">{t.difficulty}:</span>
          <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5">
            {([
              { value: 'Todos', label: t.all },
              { value: 'Fácil', label: t.difficultyEasy },
              { value: 'Médio', label: t.difficultyMedium },
              { value: 'Difícil', label: t.difficultyHard }
            ] as const).map((diff) => (
              <button
                key={diff.value}
                onClick={() => setSelectedDifficulty(diff.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedDifficulty === diff.value
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {diff.label}
              </button>
            ))}
          </div>

          {/* Language Filter */}
          <span className="text-xs text-slate-400 font-medium mr-1 md:block hidden">{t.filterLanguage}:</span>
          <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5">
            {([
              { value: 'Todos', label: t.all },
              { value: 'pt', label: 'PT 🇧🇷' },
              { value: 'en', label: 'EN 🇺🇸' },
              { value: 'es', label: 'ES 🇪🇸' }
            ] as const).map((l) => (
              <button
                key={l.value}
                onClick={() => setSelectedLanguageFilter(l.value)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedLanguageFilter === l.value
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l.label}
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
            <p className="text-slate-200 text-sm font-bold">{appLanguage === 'pt' ? 'O catálogo padrão de músicas está vazio' : appLanguage === 'en' ? 'The default song catalog is empty' : 'El catálogo de canciones predeterminado está vacío'}</p>
            <p className="text-slate-400 text-xs mt-1.5 max-w-md leading-relaxed">
              {appLanguage === 'pt' ? 'Você pode adicionar suas próprias canções personalizadas ou hinos com letras, notas e arquivos de áudio acessando a aba Estúdio Admin no menu superior!' : appLanguage === 'en' ? 'You can add your own custom songs or hymns with lyrics, notes, and audio files by visiting the Admin Studio tab in the top menu!' : '¡Puedes agregar tus propias canciones o himnos personalizados con letras, notas y archivos de audio visitando la pestaña Estudio Admin en el menú superior!'}
            </p>
          </div>
        ) : filteredSongs.length > 0 ? (
          filteredSongs.map((song, idx) => {
            const hs = highscores[song.id];
            const songLanguage = song.language || 'pt';

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
                        {getTranslatedDifficulty(song.difficulty)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold truncate flex items-center gap-1">
                        <span>{songLanguage === 'en' ? '🇺🇸' : songLanguage === 'es' ? '🇪🇸' : '🇧🇷'}</span>
                        <span>{song.numberOrYear}</span>
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
                    {song.description || (appLanguage === 'pt' ? 'Música inspiradora para louvor.' : appLanguage === 'en' ? 'Inspiring song for worship.' : 'Canción inspiradora para la adoración.')}
                  </p>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
            <p className="text-slate-400 text-sm">{appLanguage === 'pt' ? 'Nenhum louvor encontrado com os filtros selecionados.' : appLanguage === 'en' ? 'No praises found with the selected filters.' : 'No se encontraron alabanzas con los filtros seleccionados.'}</p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('Todos');
                setSelectedDifficulty('Todos');
                setSelectedLanguageFilter('Todos');
              }}
              className="mt-3 text-xs text-indigo-400 font-bold hover:underline"
            >
              {appLanguage === 'pt' ? 'Limpar filtros de busca' : appLanguage === 'en' ? 'Clear search filters' : 'Limpiar filtros de búsqueda'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
