import React, { useRef, useEffect, useState } from 'react';
import { Song, ScoreRecord } from '../types';
import { autoCorrelate, frequencyToMidi, midiToNoteName, calculateHitAccuracy } from '../utils/pitchDetector';
import { Play, Square, Volume2, VolumeX, Mic, MicOff, Info, RefreshCw, Trophy, Star, ArrowLeft, Keyboard, FileAudio, Maximize, Minimize, Tv, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KaraokeStageProps {
  song: Song;
  onExit: () => void;
  currentUser: string;
  onSaveScore: (score: ScoreRecord) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

export default function KaraokeStage({ song, onExit, currentUser, onSaveScore }: KaraokeStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Real Audio Backing Track Player
  const backstageAudioRef = useRef<HTMLAudioElement | null>(null);
  const [stageAudioFile, setStageAudioFile] = useState<File | null>(song.audioFile || null);
  const [stageAudioUrl, setStageAudioUrl] = useState<string | null>(null);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  // Auto create and clean ObjectURLs to play selected device MP3
  useEffect(() => {
    if (stageAudioFile) {
      const url = URL.createObjectURL(stageAudioFile);
      setStageAudioUrl(url);
      setIsAudioLoaded(true);
      return () => {
        URL.revokeObjectURL(url);
        setStageAudioUrl(null);
        setIsAudioLoaded(false);
        setAudioDuration(null);
      };
    } else if (song.audioUrl) {
      setStageAudioUrl(song.audioUrl);
      setIsAudioLoaded(true);
      return () => {
        setStageAudioUrl(null);
        setIsAudioLoaded(false);
        setAudioDuration(null);
      };
    } else {
      setAudioDuration(null);
    }
  }, [stageAudioFile, song.audioUrl]);

  // Audio Context & stream references
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const synthOscRef = useRef<OscillatorNode | null>(null);
  const synthGainRef = useRef<GainNode | null>(null);
  const lastMidiNoteRef = useRef<number>(-1);
  const chordOscsRef = useRef<OscillatorNode[]>([]);
  const chordGainRef = useRef<GainNode | null>(null);
  const lastBeatRef = useRef<number>(-1);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const projectorWindowRef = useRef<Window | null>(null);

  // Core Game State
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playState, setPlayState] = useState<'idle' | 'countdown' | 'playing' | 'calculating' | 'completed'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [songTime, setSongTime] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [notesMatchedCount, setNotesMatchedCount] = useState(0);
  const [notesEvaluatedCount, setNotesEvaluatedCount] = useState(0);
  const [averageAccuracyCollector, setAverageAccuracyCollector] = useState<number[]>([]);

  // System Controls
  const [isMicConnected, setIsMicConnected] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isGuideSynthOn, setIsGuideSynthOn] = useState(true);
  const [useSimulatedVoice, setUseSimulatedVoice] = useState(false);
  const [simulatedMidiValue, setSimulatedMidiValue] = useState(64); // E4 default

  // Track currently active note and pitch feedback
  const [vocalPitchMidi, setVocalPitchMidi] = useState<number>(-1);
  const [vocalVolume, setVocalVolume] = useState<number>(0);
  const pitchCheckIntervalRef = useRef<number>(0);
  const [pitchFeedbackMessage, setPitchFeedbackMessage] = useState<string>('Ajustando voz...');
  const [pitchFeedbackColor, setPitchFeedbackColor] = useState<string>('text-slate-400');
  const [viewMode] = useState<'classic' | 'scoring'>('classic');
  const [showMenusDuringPlay, setShowMenusDuringPlay] = useState(false);

  // Real-time microphone test state
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testVolume, setTestVolume] = useState<number>(0);
  const [testPitchMidi, setTestPitchMidi] = useState<number>(-1);
  const [testPitchName, setTestPitchName] = useState<string>('Nenhuma nota');
  const [testFrequency, setTestFrequency] = useState<number>(0);

  // Animation & Particle lists
  const particlesRef = useRef<Particle[]>([]);

  // Keyboard notes simulator helper
  const notesGuideSim = [
    { key: 'A', name: 'Dó (C4)', midi: 60 },
    { key: 'S', name: 'Ré (D4)', midi: 62 },
    { key: 'D', name: 'Mi (E4)', midi: 64 },
    { key: 'F', name: 'Fá (F4)', midi: 65 },
    { key: 'G', name: 'Sol (G4)', midi: 67 },
    { key: 'H', name: 'Lá (A4)', midi: 69 },
    { key: 'J', name: 'Si (B4)', midi: 71 },
    { key: 'K', name: 'Dó (C5)', midi: 72 },
  ];

  // Duration of the performance
  const maxSongDuration = audioDuration && audioDuration > 0
    ? audioDuration
    : (song.melody.length > 0 
        ? Math.max(...song.melody.map(n => n.time + n.duration)) + 3 
        : 30);

  // Cleanup effects on unmount
  useEffect(() => {
    return () => {
      stopVoiceCapture();
      stopSynth();
    };
  }, []);

  // Keyboard controls listener for sandboxed iframe play tests
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (playState !== 'playing') return;
      const keyUpper = e.key.toUpperCase();
      const matchKey = notesGuideSim.find(k => k.key === keyUpper);
      if (matchKey) {
        setUseSimulatedVoice(true);
        setSimulatedMidiValue(matchKey.midi);
        // Create an visual impact ripple
        triggerImpactAtPitch(matchKey.midi);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playState]);

  // Start Mic Capture Stream or request permission
  const startVoiceCapture = async () => {
    setMicError(null);
    if (isMicConnected && analyserRef.current && activeStreamRef.current) {
      return; // Already active and running
    }
    try {
      // 1. Initialize web audio context safely
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      activeStreamRef.current = stream;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048; // Good resolution for frequency pitch
      
      source.connect(analyser);
      analyserRef.current = analyser;
      setIsMicConnected(true);
      setMicError(null);
      setUseSimulatedVoice(false); // Disable simulated voice since real mic is active!

      // Resume audio context if asleep
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (err: any) {
      console.warn("Lamentavelmente o acesso ao microfone foi recusado ou não suportado no iframe. Utilizando simulador integrado.", err);
      setIsMicConnected(false);
      setMicError("Microfone indisponível ou permissão negada. O site ativou automaticamente o modo Simulador de Voz por Teclado ou Controle de afinação abaixo para você cantar no iframe.");
      setUseSimulatedVoice(true);
    }
  };

  const stopVoiceCapture = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
    setIsMicConnected(false);
  };

  // Microphone real-time test loop
  useEffect(() => {
    if (!isTestingMic) {
      return;
    }

    let testAnimationFrameId: number;

    const runTestLoop = () => {
      if (analyserRef.current && audioContextRef.current) {
        const bufferLength = analyserRef.current.fftSize;
        const dataArray = new Float32Array(bufferLength);
        analyserRef.current.getFloatTimeDomainData(dataArray);

        // 1. Calculate Volume Level
        let sumOfSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumOfSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumOfSquares / dataArray.length);
        const volumeScore = Math.min(100, Math.round(rms * 700));
        setTestVolume(volumeScore);

        // 2. Perform frequency/pitch autocorrelation
        const rate = audioContextRef.current.sampleRate;
        const detectedFreq = autoCorrelate(dataArray, rate);
        if (detectedFreq > 10) {
          const midi = frequencyToMidi(detectedFreq);
          setTestPitchMidi(midi);
          setTestFrequency(Math.round(detectedFreq));
          const noteStr = midiToNoteName(midi);
          setTestPitchName(`${noteStr.name}${noteStr.octave}`);
        } else {
          setTestPitchMidi(-1);
          setTestFrequency(0);
          setTestPitchName('Silêncio');
        }
      }

      testAnimationFrameId = requestAnimationFrame(runTestLoop);
    };

    if (!isMicConnected) {
      startVoiceCapture().then(() => {
        testAnimationFrameId = requestAnimationFrame(runTestLoop);
      });
    } else {
      testAnimationFrameId = requestAnimationFrame(runTestLoop);
    }

    return () => {
      cancelAnimationFrame(testAnimationFrameId);
    };
  }, [isTestingMic, isMicConnected, playState]);

  // Procedural downbeat kick drum sound
  const playKickDrum = () => {
    // Disabled to ensure absolute silence during singing
    return;
  };

  // Procedural upbeat Hi-Hat metallic tick sound
  const playHiHat = () => {
    // Disabled to ensure absolute silence during singing
    return;
  };

  // Sound Synth Synthesizer player to guide the singer + backing chord harmonies
  const playSynthTone = (midiNote: number) => {
    // Completely disabled to keep app focused solely on pure singing with zero vocal interruption piano noises
    return;
  };

  const stopSynth = () => {
    // 1. Stop melody guide synth
    if (synthGainRef.current && audioContextRef.current) {
      try {
        const curTime = audioContextRef.current.currentTime;
        synthGainRef.current.gain.setValueAtTime(synthGainRef.current.gain.value, curTime);
        synthGainRef.current.gain.exponentialRampToValueAtTime(0.001, curTime + 0.05);
        
        const osc = synthOscRef.current;
        setTimeout(() => {
          try { osc?.stop(); } catch(e){}
        }, 100);
      } catch (e) {}
    }
    synthOscRef.current = null;
    synthGainRef.current = null;

    // 2. Stop chord accompaniment harmony synths
    if (chordGainRef.current && audioContextRef.current) {
      try {
        const curTime = audioContextRef.current.currentTime;
        chordGainRef.current.gain.setValueAtTime(chordGainRef.current.gain.value, curTime);
        chordGainRef.current.gain.exponentialRampToValueAtTime(0.001, curTime + 0.08);
        
        const oscs = [...chordOscsRef.current];
        setTimeout(() => {
          oscs.forEach(osc => {
            try { osc?.stop(); } catch(e){}
          });
        }, 120);
      } catch (e) {}
    }
    chordOscsRef.current = [];
    chordGainRef.current = null;
    
    // Reset our note tracker ref
    lastMidiNoteRef.current = -1;
  };

  // Main interactive cycle start
  const handleStartKaraoke = async () => {
    setIsTestingMic(false); // Stop testing mic
    // 1. Initialize Audio
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    await audioContextRef.current.resume();

    // Reset points/acc score
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setNotesMatchedCount(0);
    setNotesEvaluatedCount(0);
    setAverageAccuracyCollector([]);
    setSongTime(0);
    setShowMenusDuringPlay(false);

    // Request micro-permission
    await startVoiceCapture();

    // Start 3 second countdown flow
    setPlayState('countdown');
    setCountdown(3);
  };

  // Countdown timer loop
  useEffect(() => {
    if (playState !== 'countdown') return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setPlayState('playing');
    }
  }, [playState, countdown]);

  // Track active state in a ref to bypass stale closures in event listeners
  const currentStateRef = useRef({ song, playState, countdown, score, songTime });
  const lastTimeSyncRef = useRef<number>(0);

  useEffect(() => {
    currentStateRef.current = { song, playState, countdown, score, songTime };
  }, [song, playState, countdown, score, songTime]);

  const broadcastFullState = () => {
    const state = currentStateRef.current;
    const curRealTime = backstageAudioRef.current ? backstageAudioRef.current.currentTime : state.songTime;
    const scoreMode = localStorage.getItem('adventist_voice_score_mode') || 'complete';
    
    const stateData = {
      type: 'sync',
      song: state.song,
      playState: state.playState,
      countdown: state.countdown,
      score: state.score,
      songTime: curRealTime,
      currentUser: currentUser,
      scoreDisplayMode: scoreMode
    };

    // Direct Window reference updates (highly robust for sandboxed iframes)
    if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
      try {
        if (typeof (projectorWindowRef.current as any).updateProjectorState === 'function') {
          (projectorWindowRef.current as any).updateProjectorState(stateData);
        } else {
          projectorWindowRef.current.postMessage(stateData, '*');
        }
      } catch (e) {
        console.warn("Direct update to projector window failed", e);
      }
    }

    // Sync to backend relay (for partitioned browser frames)
    fetch('/api/projector/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stateData)
    }).catch(() => {});

    if (syncChannelRef.current) {
      try {
        syncChannelRef.current.postMessage(stateData);
      } catch (e) {}
    }
    try {
      localStorage.setItem('adventist_voice_sync_fallback', JSON.stringify({
        ...stateData,
        timestamp: Date.now()
      }));
    } catch (e) {}
  };

  // Initialize and clean up real-time projector sync channel with bidirectional message support
  useEffect(() => {
    try {
      syncChannelRef.current = new BroadcastChannel('adventist_voice_sync');
      syncChannelRef.current.onmessage = (event) => {
        if (event.data && event.data.type === 'request_sync') {
          broadcastFullState();
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported", e);
    }

    // Handle incoming messages from window.opener direct message channel if active
    const handleMessageFromOpener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'projector_ready') {
        broadcastFullState();
      }
    };
    window.addEventListener('message', handleMessageFromOpener);

    // Handshake via localStorage for cross-context iframe robust syncing
    const handleStorageRequest = (e: StorageEvent) => {
      if (e.key === 'adventist_voice_request_sync' && e.newValue) {
        broadcastFullState();
      }
    };
    window.addEventListener('storage', handleStorageRequest);

    return () => {
      if (syncChannelRef.current) {
        syncChannelRef.current.close();
      }
      window.removeEventListener('storage', handleStorageRequest);
      window.removeEventListener('message', handleMessageFromOpener);
    };
  }, []);

  // Sync major state updates to second screen / projector
  useEffect(() => {
    broadcastFullState();
  }, [playState, countdown, score, song, currentUser]);

  const openProjectorWindow = () => {
    const url = window.location.origin + window.location.pathname + '?projector=true';
    const win = window.open(url, 'adventist_voice_projector', 'width=1280,height=720,menubar=no,status=no,titlebar=no,toolbar=no,location=no');
    
    projectorWindowRef.current = win;
    
    // Broadcast initial state immediately & schedule fallback checks
    if (win) {
      setTimeout(() => {
        broadcastFullState();
      }, 500);
      setTimeout(() => {
        broadcastFullState();
      }, 1200);
    }
  };

  // Fullscreen Change Listener and Toggle
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    
    const elem = stageContainerRef.current;
    if (!document.fullscreenElement) {
      const req = elem.requestFullscreen || (elem as any).webkitRequestFullscreen || (elem as any).mozRequestFullScreen || (elem as any).msRequestFullscreen;
      if (req) {
        req.call(elem).then(() => {
          setIsFullscreen(true);
        }).catch((err) => {
          console.warn("Erro ao iniciar tela cheia:", err);
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      const exit = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).mozCancelFullScreen || (document as any).msExitFullscreen;
      if (exit) {
        exit.call(document).then(() => {
          setIsFullscreen(false);
        }).catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  };

  // Handle Play/Pause of real backing track on transition
  useEffect(() => {
    if (playState === 'playing') {
      if (backstageAudioRef.current) {
        backstageAudioRef.current.currentTime = 0;
        backstageAudioRef.current.volume = 0.6; // Balanço ideal de volume
        backstageAudioRef.current.play().catch(err => {
          console.warn("Falha ao tocar áudio real de fundo:", err);
        });
      }
    } else {
      if (backstageAudioRef.current) {
        backstageAudioRef.current.pause();
      }
    }
  }, [playState, stageAudioUrl]);

  // Game/Clock Loop (60 FPS timer ticks and pitch analysis)
  useEffect(() => {
    if (playState !== 'playing') {
      stopSynth();
      setVocalVolume(0);
      setVocalPitchMidi(-1);
      return;
    }

    let lastTime = performance.now();
    let animationFrameId: number;

    const gameClockLoop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      let curRealTime = songTime;
      if (stageAudioUrl && backstageAudioRef.current) {
        const curTime = backstageAudioRef.current.currentTime;
        setSongTime(curTime);
        curRealTime = curTime;
        if (backstageAudioRef.current.ended || curTime >= maxSongDuration) {
          setPlayState('completed');
        }
        if (syncChannelRef.current) {
          try {
            syncChannelRef.current.postMessage({ type: 'time', songTime: curTime });
          } catch (e) {}
        }
        if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
          try {
            if (typeof (projectorWindowRef.current as any).updateProjectorState === 'function') {
              (projectorWindowRef.current as any).updateProjectorState({ type: 'time', songTime: curTime });
            } else {
              projectorWindowRef.current.postMessage({ type: 'time', songTime: curTime }, '*');
            }
          } catch (e) {}
        }
      } else {
        setSongTime((prev) => {
          const updatedTime = prev + delta;
          curRealTime = updatedTime;
          if (updatedTime >= maxSongDuration) {
            setPlayState('completed');
            return maxSongDuration;
          }
          if (syncChannelRef.current) {
            try {
              syncChannelRef.current.postMessage({ type: 'time', songTime: updatedTime });
            } catch (e) {}
          }
          if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
            try {
              if (typeof (projectorWindowRef.current as any).updateProjectorState === 'function') {
                (projectorWindowRef.current as any).updateProjectorState({ type: 'time', songTime: updatedTime });
              } else {
                projectorWindowRef.current.postMessage({ type: 'time', songTime: updatedTime }, '*');
              }
            } catch (e) {}
          }
          return updatedTime;
        });
      }

      // Throttle localStorage and server time updates to ~250ms intervals to keep system snappy
      const nowMs = Date.now();
      if (nowMs - lastTimeSyncRef.current > 250) {
        lastTimeSyncRef.current = nowMs;
        
        // Post throttled time sync to backend relay
        fetch('/api/projector/time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songTime: curRealTime,
            playState: 'playing'
          })
        }).catch(() => {});

        try {
          localStorage.setItem('adventist_voice_time_sync', JSON.stringify({
            songTime: curRealTime,
            playState: 'playing',
            timestamp: nowMs
          }));
        } catch (e) {}
      }

      // Rhythm Drum Beat Ticker (Procedural Backing Drums)
      if (!stageAudioUrl && audioContextRef.current && audioContextRef.current.state !== 'suspended') {
        const beatSeconds = 60 / song.bpm;
        const currentBeatIdx = Math.floor(songTime / beatSeconds);
        
        if (currentBeatIdx !== lastBeatRef.current && currentBeatIdx >= 0) {
          lastBeatRef.current = currentBeatIdx;
          
          if (currentBeatIdx % 4 === 0) {
            playKickDrum();
          } else if (currentBeatIdx % 2 === 0) {
            playKickDrum();
          } else {
            playHiHat();
          }
        }
      }

      // Analyze Pitch and calculate matching stats roughly 10-15 times per second
      pitchCheckIntervalRef.current++;
      if (pitchCheckIntervalRef.current >= 4) {
        pitchCheckIntervalRef.current = 0;
        performPitchDetectionStep();
      }

      animationFrameId = requestAnimationFrame(gameClockLoop);
    };

    animationFrameId = requestAnimationFrame(gameClockLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [playState, songTime, isMicConnected, useSimulatedVoice, simulatedMidiValue]);

  // Audio pitch capture step
  const performPitchDetectionStep = () => {
    let currentVoiceMidi = -1;
    let computedVolume = 0;

    // 1. If using mic, read raw waveform buffer
    if (!useSimulatedVoice && analyserRef.current && audioContextRef.current) {
      const bufferLength = analyserRef.current.fftSize;
      const dataArray = new Float32Array(bufferLength);
      analyserRef.current.getFloatTimeDomainData(dataArray);
      
      // Calculate real-time RMS volume
      let sumOfSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumOfSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumOfSquares / dataArray.length);
      computedVolume = Math.min(100, Math.round(rms * 700));

      // Only perform autocorrelation if there is enough input volume to avoid false hum detection
      if (rms >= 0.012) {
        const rate = audioContextRef.current.sampleRate;
        const detectedFreq = autoCorrelate(dataArray, rate);
        if (detectedFreq > 0) {
          currentVoiceMidi = frequencyToMidi(detectedFreq);
        }
      }
    } else if (useSimulatedVoice) {
      // Use the simulation range sliders or keyboard press
      currentVoiceMidi = simulatedMidiValue;
      computedVolume = 55 + Math.round(Math.random() * 20); // Simulate active volume
    }

    setVocalVolume(computedVolume);
    setVocalPitchMidi(currentVoiceMidi);

    // 2. Identify the target note matching the current song timestamp
    const targetNote = song.melody.find(
      (note) => songTime >= note.time && songTime <= note.time + note.duration
    );

    if (targetNote) {
      // Increment evaluated count because a target note was active
      setNotesEvaluatedCount((prev) => prev + 1);

      if (currentVoiceMidi > 0) {
        // Evaluate pitch fidelity offset
        const accuracy = calculateHitAccuracy(currentVoiceMidi, targetNote.note);

        if (accuracy > 0.20) {
          // Grant points proportionally. Max score is 10000 distributed over the melody's expected duration.
          const totalMelodyDuration = song.melody.reduce((sum, m) => sum + m.duration, 0) || 30;
          const totalExpectedFrames = Math.max(100, totalMelodyDuration * 15);
          const basePointsPerFrame = 10000 / totalExpectedFrames;
          
          const earned = accuracy * basePointsPerFrame * (1 + streak * 0.01);
          setScore((prev) => Math.min(10000, Math.round(prev + earned)));
          
          setStreak((prev) => {
            const next = prev + 1;
            if (next > maxStreak) setMaxStreak(next);
            return next;
          });
          
          setNotesMatchedCount((prev) => prev + 1);
          setAverageAccuracyCollector((prev) => [...prev, accuracy * 100]);

          // Visual Sparks
          triggerImpactAtPitch(targetNote.note);

          if (accuracy >= 0.85) {
            setPitchFeedbackMessage(streak > 5 ? `Combo Perfeito x${streak}! 🔥` : 'Perfeito! 🌟');
            setPitchFeedbackColor('text-emerald-400 font-extrabold scale-110');
          } else {
            setPitchFeedbackMessage('Muito Bom! 👍');
            setPitchFeedbackColor('text-indigo-300 font-bold');
          }
        } else {
          // Off-pitch feedback
          setStreak(0);
          setAverageAccuracyCollector((prev) => [...prev, 0]);

          if (currentVoiceMidi > targetNote.note) {
            setPitchFeedbackMessage('Muito Alto 📈');
            setPitchFeedbackColor('text-rose-400 font-medium');
          } else {
            setPitchFeedbackMessage('Muito Baixo 📉');
            setPitchFeedbackColor('text-amber-400 font-medium');
          }
        }
      } else {
        // No singing voice detected but target exists (silent when should be singing)
        setStreak(0);
        setAverageAccuracyCollector((prev) => [...prev, 0]);
        setPitchFeedbackMessage('Identificando sua voz...');
        setPitchFeedbackColor('text-slate-500 italic');
      }
    } else {
      // Idle music silence
      stopSynth();
      if (currentVoiceMidi > 50) {
        const noteInfo = midiToNoteName(currentVoiceMidi);
        setPitchFeedbackMessage(`Cantando: ${noteInfo.name}${noteInfo.octave} 🎵`);
        setPitchFeedbackColor('text-amber-400 font-bold');
      } else {
        setPitchFeedbackMessage('Instrumental 🎹');
        setPitchFeedbackColor('text-slate-400 font-medium');
      }
    }
  };

  // Fire visual impact sparks when user hits note correctly
  const triggerImpactAtPitch = (midiValue: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const midiMin = 55;
    const midiMax = 80;
    const verticalFactor = canvas.height / (midiMax - midiMin);
    
    // Position of vocal visual line (left 25% of screen)
    const pxX = canvas.width * 0.25;
    const pxY = canvas.height - (midiValue - midiMin) * verticalFactor;

    // Generate neon sparkling pieces
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x: pxX,
        y: pxY,
        vx: (Math.random() - 0.3) * 6,
        vy: (Math.random() - 0.5) * 6,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.4 ? '#fbbf24' : '#10b981', // Amber gold or emerald green
        alpha: 1.0,
        life: 1.0
      });
    }
  };

  // Save scoring metrics to parent database
  const handleSaveResult = () => {
    // Generate overall statistics record based on score (10000 points is 100%)
    const finalAccuracy = Math.min(100, Math.round((score / 10000) * 100));

    let computedStars = 1;
    if (finalAccuracy >= 80) computedStars = 5;
    else if (finalAccuracy >= 60) computedStars = 4;
    else if (finalAccuracy >= 40) computedStars = 3;
    else if (finalAccuracy >= 20) computedStars = 2;

    const record: ScoreRecord = {
      id: Math.random().toString(36).substring(2, 9),
      songId: song.id,
      songTitle: song.title,
      userName: currentUser || 'Cantor Convidado',
      score: score,
      accuracy: Math.min(100, finalAccuracy),
      date: new Date().toISOString(),
      stars: computedStars,
      maxStreak: maxStreak
    };

    onSaveScore(record);
    onExit();
  };

  // Canvas rolling timeline renderer (runs at 60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let runCanvasFrame = true;

    // Fixed MIDI display boundaries
    const midiMin = 55; // G3
    const midiMax = 80; // G#5

    const render = () => {
      if (!runCanvasFrame) return;

      // Clean canvas with semi-transparent deep background to leave a trailing blur effect
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw horizontal musical staff lines (MIDI note guides)
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      const totalNotesToShow = midiMax - midiMin;
      const verticalFactor = canvas.height / totalNotesToShow;

      for (let noteVal = midiMin; noteVal <= midiMax; noteVal += 2) {
        const lineY = canvas.height - (noteVal - midiMin) * verticalFactor;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(canvas.width, lineY);
        ctx.stroke();

        // Label notes like C4, G4 subtly on the very left
        if (noteVal % 12 === 0) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.font = '9px monospace';
          const info = midiToNoteName(noteVal);
          ctx.fillText(`${info.name}${info.octave}`, 6, lineY - 4);
        }
      }

      // Draw vertical threshold line representing the current active voice target (25% from left)
      const targetPointX = canvas.width * 0.25;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(targetPointX, 0);
      ctx.lineTo(targetPointX, canvas.height);
      ctx.stroke();

      // Horizontal scaling: seconds to pixels factor
      const pixelsPerSecond = 85; 

      // Render Song target melodic keys scrolling
      song.melody.forEach((melodyNote) => {
        // Horizontal position calculation relative to songTime
        const noteStartX = targetPointX + (melodyNote.time - songTime) * pixelsPerSecond;
        const noteWidth = melodyNote.duration * pixelsPerSecond;
        const noteY = canvas.height - (melodyNote.note - midiMin) * verticalFactor;

        // Draw note if visible on screen
        if (noteStartX + noteWidth >= 0 && noteStartX <= canvas.width) {
          const isActive = songTime >= melodyNote.time && songTime <= melodyNote.time + melodyNote.duration;

          // Background box style
          ctx.fillStyle = isActive 
            ? 'rgba(234, 179, 8, 0.35)' // Pulsing glowing amber golden key
            : 'rgba(234, 179, 8, 0.15)';
          
          ctx.strokeStyle = isActive 
            ? '#ea580c' // Hot amber outline
            : 'rgba(217, 119, 6, 0.4)';
            
          ctx.lineWidth = isActive ? 2 : 1;

          // Draw rounded melodic rects
          drawRoundedRect(ctx, noteStartX, noteY - (verticalFactor / 2), noteWidth, verticalFactor * 0.9, 6);
          ctx.fill();
          ctx.stroke();

          // Syllable text over the scrolling blocks
          ctx.fillStyle = isActive ? '#ffffff' : '#f1f5f9';
          ctx.font = 'bold 9px system-ui';
          ctx.fillText(melodyNote.text, noteStartX + 5, noteY - (verticalFactor / 2) - 3);
        }
      });

      // Draw user vocal pitch trace if active voice is singing
      if (vocalPitchMidi > 50 && playState === 'playing') {
        const vocalY = canvas.height - (vocalPitchMidi - midiMin) * verticalFactor;
        
        // Draw real-time high-contrast glowing neon ball
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#10b981'; // Emerald glow
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(targetPointX, vocalY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow parameter

        // Subtly print user current note name (e.g. "Do#4") floating near cursor
        const noteResult = midiToNoteName(vocalPitchMidi);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${noteResult.name}${noteResult.octave}`, targetPointX + 12, vocalY + 4);
      }

      // Physics loop: update and render bursting neon embers particles
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity pulling sparks slightly downwards
        p.life -= 0.02;
        p.alpha = Math.max(0, p.life);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0; // Reset alpha
      
      // Clean up dead embers
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      requestAnimationFrame(render);
    };

    render();

    return () => {
      runCanvasFrame = false;
    };
  }, [songTime, vocalPitchMidi, playState]);

  // Rounded rectangle draw helper for Canvas2D
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height - radius);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Find active lyric lines and highlight characters
  const activeLyric = song.lyrics.find(
    (line) => songTime >= line.time && songTime <= line.endTime
  );

  const upcomingLyric = song.lyrics.find(
    (line) => line.time > songTime
  );

  const previousLyrics = song.lyrics.filter(l => l.endTime < songTime);
  const previousLyric = previousLyrics.length > 0 ? previousLyrics[previousLyrics.length - 1] : null;

  const progress = activeLyric
    ? Math.min(100, Math.max(0, ((songTime - activeLyric.time) / (activeLyric.endTime - activeLyric.time)) * 100))
    : 0;

  // Groups active lyric text into words and assigns proportional timings based on character lengths
  const getLinkedWords = (): { text: string; startTime: number; endTime: number }[] => {
    if (!activeLyric) return [];
    
    const words = activeLyric.text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];

    const lineStart = activeLyric.time;
    const lineEnd = activeLyric.endTime;
    const lineDuration = lineEnd - lineStart;

    // Calculate total layout character weight in order to partition lineDuration proportionally
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
    <div 
      ref={stageContainerRef}
      onClick={() => {
        if (playState === 'playing') {
          setShowMenusDuringPlay(prev => !prev);
        }
      }}
      className={`relative h-full min-h-0 w-full bg-slate-950/95 backdrop-blur-xl ${isFullscreen ? '' : 'rounded-2xl sm:rounded-3xl border border-white/10'} overflow-hidden shadow-2xl flex flex-col justify-between ${playState === 'playing' ? 'cursor-pointer' : ''}`}
    >
      {stageAudioUrl && (
        <audio
          ref={backstageAudioRef}
          src={stageAudioUrl}
          className="hidden"
          onLoadedMetadata={(e) => {
            setAudioDuration(e.currentTarget.duration);
          }}
        />
      )}
      
      {/* Top Controls Header Bar */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`p-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between z-10 relative transition-all duration-300 ${
          playState === 'playing' && !showMenusDuringPlay ? 'opacity-0 h-0 p-0 overflow-hidden border-none pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              onExit();
            }}
            className="p-2 bg-slate-950/40 rounded-xl border border-white/10 hover:border-amber-400/40 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-display font-extrabold text-white text-base tracking-tight leading-none uppercase">
                {song.title}
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">{song.numberOrYear} • Por {song.artist}</span>
          </div>
        </div>

        {/* Absolute Centered Singer Badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-display">
              Cantando: {currentUser || 'Você'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Projector / Second Screen Button */}
          <button
            onClick={openProjectorWindow}
            className="p-2 bg-slate-950/40 rounded-xl border border-white/10 hover:border-amber-400/40 hover:bg-slate-950 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 px-3"
            title="Abrir em Outra Tela / Projetor"
          >
            <Tv className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline text-slate-200">Segunda Tela</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-950/40 rounded-xl border border-white/10 hover:border-amber-400/40 hover:bg-slate-950 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4 text-amber-400 animate-pulse" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Screen Layout Container */}
      <div className={`relative flex-1 min-h-0 flex flex-col p-4 w-full ${playState === 'playing' ? 'items-stretch justify-stretch' : 'justify-center items-center'}`}>
        
        {/* PlayState == IDLE display initial start button */}
        {playState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center w-full max-w-xl max-h-full overflow-y-auto p-4 sm:p-6 glass-panel rounded-2xl shadow-2xl space-y-4 sm:space-y-5 scrollbar-thin"
          >
            <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-950/30 animate-pulse shrink-0">
              <Mic className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>

            <div className="space-y-1 sm:space-y-2">
              <h4 className="text-lg sm:text-xl font-display font-extrabold text-white">Preparar Microfone</h4>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed serif-font italic">
                Recomendamos conectar fones de ouvido para o aplicativo capturar unicamente a sua voz e não as notas de acompanhamento do teclado vocal.
              </p>
            </div>

            {/* LIVE MICROPHONE TEST PANEL */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-white/5 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5 font-display">
                  <Mic className="h-4 w-4 text-emerald-400" />
                  Teste de Microfone em Tempo Real
                </span>
                
                <button
                  type="button"
                  onClick={() => {
                    const nextTesting = !isTestingMic;
                    setIsTestingMic(nextTesting);
                    if (!nextTesting) {
                      stopVoiceCapture();
                    }
                  }}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                    isTestingMic
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-sm'
                      : 'bg-slate-950/60 border-white/10 text-slate-300 hover:text-white hover:bg-slate-900 hover:border-white/20'
                  }`}
                >
                  {isTestingMic ? '⏹ Parar Teste' : '🎙 Testar Microfone'}
                </button>
              </div>

              {isTestingMic && (
                <div className="space-y-3 animate-fade-in bg-slate-950/40 p-3 rounded-lg border border-white/5">
                  {/* Volume level indicator bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Volume de Entrada:</span>
                      <span className="font-bold text-slate-200">{testVolume}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 flex gap-0.5 p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
                        style={{ width: `${testVolume}%` }}
                      />
                    </div>
                  </div>

                  {/* Volume quality advice label */}
                  <div className="text-[10px] leading-none text-slate-400 flex items-center justify-between font-mono">
                    <span>Mapeamento:</span>
                    {testVolume === 0 ? (
                      <span className="text-slate-500">Silêncio total 🔇</span>
                    ) : testVolume < 3 ? (
                      <span className="text-slate-400 font-medium">Muito baixo (sussurro ou desligado) 😴</span>
                    ) : testVolume < 50 ? (
                      <span className="text-emerald-400 font-bold">Excelente captação! Pronto para cantar ✨</span>
                    ) : (
                      <span className="text-amber-500 font-bold">Sinal muito forte (afaste o microfone) ⚠️</span>
                    )}
                  </div>

                  {/* Pitch and frequency live recognition row */}
                  <div className="pt-2.5 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Frequência</span>
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {testFrequency > 0 ? `${testFrequency} Hz` : '--- Hz'}
                      </span>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Nota Identificada</span>
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {testPitchMidi > 50 ? testPitchName : '---'}
                      </span>
                    </div>
                  </div>
                  
                  {testPitchMidi > 50 ? (
                    <p className="text-[10px] text-center text-emerald-400 font-medium bg-emerald-500/5 py-1 rounded">
                      ✓ Voz identificada com sucesso! A pontuação funcionará perfeitamente.
                    </p>
                  ) : (
                    <p className="text-[10px] text-center text-slate-500 font-medium bg-slate-900/40 py-1 rounded">
                      Fale ou cante no microfone para calibrarmos o tom agora mesmo.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Playback Audio File Input for Custom/Saved Songs */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-dashed border-white/10 space-y-2.5 text-left">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1 flex items-center gap-1.5">
                <FileAudio className="h-4 w-4 text-amber-400" />
                Áudio de Acompanhamento (Playback / MP3)
              </span>
              
              {stageAudioFile ? (
                <div className="flex items-center justify-between text-xs bg-slate-950/40 p-2 rounded border border-white/5">
                  <span className="font-mono text-amber-400 truncate max-w-[200px]" title={stageAudioFile.name}>
                    {stageAudioFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStageAudioFile(null);
                      setStageAudioUrl(null);
                    }}
                    className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase underline"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <div>
                  <label className="flex flex-col items-center justify-center py-4 border border-dashed border-white/10 hover:border-amber-500/30 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-slate-950 transition-all text-center">
                    <FileAudio className="h-6 w-6 text-slate-500 group-hover:text-amber-500" />
                    <span className="text-[11px] font-bold text-slate-400 mt-1.5 block">Selecionar Playback (.mp3)</span>
                    <span className="text-[9px] text-slate-600 mt-0.5">Opcional • Cante com áudio real de fundo!</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setStageAudioFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={handleStartKaraoke}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-slate-950 font-black py-3 sm:py-4 px-6 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-amber-500/15 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-widest shrink-0"
            >
              <Play className="h-4 w-4 fill-current" />
              INICIAR LOUVOR
            </button>
          </motion.div>
        )}

        {/* PlayState == COUNTDOWN display timer numbers */}
        {playState === 'countdown' && (
          <motion.div
            key="countdown-box"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 10 }}
            className="text-center"
          >
            <span className="text-8xl font-display font-black text-amber-500 select-none block drop-shadow-[0_0_35px_rgba(245,158,11,0.5)]">
              {countdown}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 block">
              Prepare-se para cantar, {currentUser || 'Você'}...
            </span>
          </motion.div>
        )}

        {/* PlayState == CALCULATING display loading before showing completed stats */}
        {playState === 'calculating' && (
          <motion.div
            key="calculating-box"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            className="text-center p-8 bg-slate-950/80 border border-white/10 rounded-2xl shadow-2xl space-y-4 max-w-sm backdrop-blur-md"
          >
            <div className="flex justify-center items-center py-2">
              <RefreshCw className="h-10 w-10 text-amber-500 animate-spin" />
            </div>
            <h3 className="text-xl font-display font-extrabold text-white uppercase tracking-wider">
              Calculando Pontos
            </h3>
            <p className="text-xs text-slate-400 serif-font italic leading-relaxed">
              Processando as notas gravadas e gerando o seu resultado final...
            </p>
          </motion.div>
        )}

        {/* PlayState == PLAYING show canvas timeline, feedback and scrolling elements */}
        {playState === 'playing' && (
          <div className="w-full h-full flex flex-col justify-between items-stretch">
            
            {/* Visualizer canvas frame container / Classic screen */}
            {viewMode === 'scoring' ? (
              <div className="space-y-2 w-full">
                <div className="relative w-full rounded-2xl overflow-hidden border border-white/5 bg-slate-950 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    height={280}
                    className="w-full h-full block bg-slate-950"
                    style={{ imageRendering: 'auto' }}
                  />

                  {/* Pitch deviation live message box right upper corner */}
                  <div className="absolute right-3 top-3 bg-slate-950/90 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg z-20">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className={`text-xs font-bold ${pitchFeedbackColor}`}>
                      {pitchFeedbackMessage}
                    </span>
                    {vocalPitchMidi > 50 && (
                      <span className="text-[10px] font-semibold font-mono text-slate-400 bg-white/5 px-1 rounded">
                        LIVE FEEDBACK
                      </span>
                    )}
                  </div>
                </div>

                {/* Real-time sound activity detector below canvas */}
                <div className="w-full flex items-center justify-between gap-4 py-2 px-3 bg-slate-950/80 rounded-xl border border-white/5 shadow-inner">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Mic className={`h-3.5 w-3.5 ${vocalVolume > 5 ? 'text-emerald-400 animate-pulse animate-bounce' : 'text-slate-500'}`} />
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Microfone</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      isMicConnected ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-500/10'
                    }`}>
                      {isMicConnected ? 'CONECTADO' : 'SIMULADO'}
                    </span>
                  </div>

                  {/* Waveform visualizer bars */}
                  <div className="flex-1 flex items-center justify-center gap-0.5 h-6 overflow-hidden">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((barIdx) => {
                      const scaleOffset = Math.sin((barIdx * 0.4) + (songTime * 20));
                      const volHeight = vocalVolume > 2 
                        ? Math.max(2, Math.min(22, (vocalVolume / 100) * 16 + scaleOffset * (vocalVolume / 12))) 
                        : 2;
                      return (
                        <div 
                          key={barIdx} 
                          className={`w-0.5 rounded-full transition-all duration-75 ${
                            vocalVolume > 5 ? 'bg-gradient-to-t from-emerald-500 to-teal-400' : 'bg-slate-700'
                          }`}
                          style={{ height: `${volHeight}px` }}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-[8px] text-slate-500 uppercase font-mono leading-none">RMS / Nível</p>
                      <p className="text-[11px] font-mono text-slate-300 font-bold leading-tight">
                        {vocalVolume > 2 ? `${vocalVolume}%` : '0%'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-slate-500 uppercase font-mono leading-none">Tom Captado</p>
                      <p className="text-[11px] font-mono text-amber-400 font-bold leading-tight min-w-[50px]">
                        {vocalPitchMidi > 50 ? `${midiToNoteName(vocalPitchMidi).name}${midiToNoteName(vocalPitchMidi).octave}` : '--'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* GORGEOUS CINEMATIC CLASSIC TRANSPARENT THEATRE VIEW */
              <div className="relative flex-1 w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-slate-950/90 flex flex-col justify-center items-center p-6 sm:p-8 shadow-2xl">
                
                {/* Flowing animated background elements */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950/95 to-amber-950/10 pointer-events-none" />
                <div className="absolute -left-20 -top-20 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />

                {/* High contrast center lyric column */}
                <div className="flex-1 flex flex-col justify-center items-center py-4 sm:py-6 text-center space-y-4 sm:space-y-6 lg:space-y-8 z-10 animate-fade-in w-full">
                  {/* PREVIOUS LYRIC (Very small & translucent) */}
                  <div className="h-8 flex items-center justify-center">
                    {previousLyric ? (
                      <p className="text-sm sm:text-lg text-slate-500 serif-font italic line-through opacity-30 truncate transition-all max-w-2xl px-4">
                        {previousLyric.text}
                      </p>
                    ) : null}
                  </div>

                  {/* GIANT FOCUS ACTIVE LYRIC */}
                  <div className="flex-1 flex items-center justify-center w-full px-4 font-display">
                    {activeLyric ? (
                      <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 sm:gap-y-4 px-2 sm:px-6 w-full text-center max-w-3xl mx-auto py-1">
                        {getLinkedWords().map((word, wIdx) => {
                          // Color word-by-word once songTime reaches the start time of this word
                          const wordProgress = songTime >= word.startTime ? 100 : 0;
                          const isActive = songTime >= word.startTime && songTime <= word.endTime;

                          return (
                            <span
                              key={wIdx}
                              className="relative inline-block select-none"
                            >
                              {/* Base dim word */}
                              <span className="text-3xl sm:text-5xl lg:text-6xl font-black text-white/20 tracking-tight serif-font italic transition-colors duration-150">
                                {word.text}
                              </span>
                              
                              {/* Glowing progressive word overlay */}
                              <span
                                className="absolute inset-0 text-center text-3xl sm:text-5xl lg:text-6xl font-black text-amber-400 tracking-tight serif-font italic pointer-events-none transition-all duration-75 block whitespace-nowrap"
                                style={{
                                  clipPath: `inset(0 ${100 - wordProgress}% 0 0)`,
                                  WebkitClipPath: `inset(0 ${100 - wordProgress}% 0 0)`,
                                  filter: isActive ? 'drop-shadow(0 0 10px rgba(245,158,11,0.95))' : 'none'
                                }}
                              >
                                {word.text}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    ) : songTime < (song.lyrics[0]?.time || 5) ? (
                      <div className="flex flex-col items-center justify-center text-center space-y-4 animate-fade-in py-6">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/20">
                          A Seguir
                        </span>
                        <h1 className="text-4xl sm:text-6xl font-display font-black text-amber-400 tracking-tight uppercase drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                          {song.title}
                        </h1>
                        <p className="text-lg sm:text-2xl text-slate-300 font-semibold tracking-wider italic">
                          {song.artist}
                        </p>
                        {song.numberOrYear && (
                          <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-slate-400 font-bold tracking-widest mt-1.5 uppercase">
                            {song.numberOrYear}
                          </span>
                        )}
                      </div>
                    ) : songTime > (song.lyrics[song.lyrics.length - 1]?.endTime || 0) ? (
                      <div className="flex flex-col items-center justify-center text-center space-y-3 animate-fade-in py-6">
                        <RefreshCw className="h-7 w-7 text-amber-500 animate-spin mb-1" />
                        <h3 className="text-xl font-display font-extrabold text-amber-400 uppercase tracking-wider">
                          Calculando Pontos
                        </h3>
                        <p className="text-xs text-slate-400 serif-font italic max-w-xs leading-relaxed">
                          Processando o seu louvor... O resultado final será exibido ao encerrar a música!
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-3 animate-pulse">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-[bounce_1s_infinite_100ms]" />
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-[bounce_1s_infinite_200ms]" />
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-[bounce_1s_infinite_300ms]" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* UPCOMING LYRIC (Slightly dim, ready to be sung) */}
                  <div className="h-10 flex items-center justify-center">
                    {upcomingLyric ? (
                      <p className="text-sm sm:text-xl text-amber-100/70 font-semibold italic serif-font tracking-wide animate-pulse bg-white/5 border border-white/10 px-5 py-1 rounded-full">
                        {upcomingLyric.text}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Floating Micro Icon Group (Bottom-Right Corner) */}
                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2.5 bg-black/40 px-3 py-2 rounded-xl border border-white/5 backdrop-blur-md shadow-lg shadow-black/20 pointer-events-none">
                  {/* Glowing dynamic feedback dot indicating pitch accuracy */}
                  <div className="flex items-center gap-1.5">
                    <div 
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        pitchFeedbackColor.includes('emerald-400') 
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
                          : pitchFeedbackColor.includes('indigo-300')
                          ? 'bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.8)]'
                          : pitchFeedbackColor.includes('amber-400')
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                          : pitchFeedbackColor.includes('rose-400')
                          ? 'bg-rose-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'
                          : 'bg-slate-600'
                      }`} 
                    />
                  </div>

                  {/* Mic status icon */}
                  <Mic className={`h-4 w-4 transition-colors duration-200 ${vocalVolume > 5 ? 'text-emerald-400' : 'text-slate-500'}`} />

                  {/* Audio wave volume capture visualizer bars (no text) */}
                  <div className="flex items-center gap-0.5 h-3 px-1 bg-black/20 rounded-md border border-white/5">
                    {[1, 2, 3, 4, 5].map((barIdx) => {
                      const scaleOffset = Math.sin((barIdx * 0.8) + (songTime * 20));
                      const volHeight = vocalVolume > 2 
                        ? Math.max(2, Math.min(10, (vocalVolume / 100) * 8 + scaleOffset * (vocalVolume / 15))) 
                        : 2;
                      return (
                        <div 
                          key={barIdx} 
                          className={`w-0.5 rounded-full transition-all duration-75 ${
                            vocalVolume > 5 ? 'bg-emerald-400' : 'bg-slate-700'
                          }`}
                          style={{ height: `${volHeight}px` }}
                        />
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Simulated manual vocal pitch controller if mic permission refused */}
            {useSimulatedVoice && (
              <div className="mt-4 p-4 glass-panel rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 uppercase tracking-wider font-display">
                    <Keyboard className="h-4 w-4" /> Controlador de Voz por Teclado
                  </span>
                  <span className="text-[10px] text-slate-400">Pressione letras A-K ou arraste para cantar:</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {notesGuideSim.map((n) => (
                    <button
                      key={n.key}
                      onClick={() => {
                        setSimulatedMidiValue(n.midi);
                        triggerImpactAtPitch(n.midi);
                      }}
                      className={`px-3 py-2 text-xs font-extrabold rounded-lg transition-colors cursor-pointer border ${
                        simulatedMidiValue === n.midi
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-950/40 text-slate-300 border-white/5 hover:bg-slate-900'
                      }`}
                    >
                      <span className="block text-[8px] opacity-75 font-mono uppercase">{n.key}</span>
                      {n.name}
                    </button>
                  ))}
                </div>

                {/* Range pitch slider */}
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-slate-400 font-semibold min-w-[70px]">Frequência:</span>
                  <input
                    type="range"
                    min={55}
                    max={80}
                    value={simulatedMidiValue}
                    onChange={(e) => setSimulatedMidiValue(Number(e.target.value))}
                    className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-200 w-12 text-right">
                    MIDI {simulatedMidiValue}
                  </span>
                </div>
              </div>
            )}

            {/* Micro warning indicator to guide frame sandbox users */}
            {micError && (
              <div className="mt-3 bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl flex items-start gap-2 text-[11px] text-amber-200/90 leading-relaxed serif-font italic">
                <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>{micError}</span>
              </div>
            )}

            {/* Beautiful dynamic scrolling lyrics presenter */}
            {viewMode === 'scoring' && (
              <div className="mt-4 p-6 glass-panel rounded-2xl text-center space-y-3 relative overflow-hidden border border-white/5 bg-slate-950/20 shadow-2xl font-display">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-amber-500/80 uppercase tracking-widest font-black font-display">Acompanhamento de Voz</p>
                  <span className="text-[10px] text-slate-500 font-mono">BPM {song.bpm}</span>
                </div>
                
                <div className="min-h-[64px] flex flex-col items-center justify-center py-2">
                  {activeLyric ? (
                    <div className="flex flex-wrap justify-center items-center gap-x-2.5 gap-y-1.5 px-4 w-full text-center max-w-2xl mx-auto py-1">
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
                          <span
                            key={wIdx}
                            className="relative inline-block select-none"
                          >
                            {/* Base dim word */}
                            <span className="text-xl sm:text-2xl font-extrabold text-white/30 tracking-tight serif-font italic transition-colors duration-150">
                              {word.text}
                            </span>
                            
                            {/* Glowing progressive word overlay */}
                            <span
                              className="absolute inset-0 text-center text-xl sm:text-2xl font-extrabold text-amber-400 tracking-tight serif-font italic pointer-events-none transition-all duration-75 block whitespace-nowrap"
                              style={{
                                clipPath: `inset(0 ${100 - wordProgress}% 0 0)`,
                                WebkitClipPath: `inset(0 ${100 - wordProgress}% 0 0)`,
                                filter: isActive ? 'drop-shadow(0 0 8px rgba(245,158,11,0.8))' : 'none'
                              }}
                            >
                              {word.text}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-sm serif-font tracking-wide animate-pulse">Instantes Instrumentais...</p>
                  )}
                </div>

                {upcomingLyric && (
                  <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-2">
                    <span className="text-[9px] bg-slate-900 border border-white/5 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Próximo verso</span>
                    <p className="text-xs text-slate-400 font-semibold italic serif-font truncate">
                      "{upcomingLyric.text}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PlayState == COMPLETED performance success stats */}
        {playState === 'completed' && (() => {
          const finalAccuracy = Math.min(100, Math.round((score / 10000) * 100));
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-lg w-full max-h-full overflow-y-auto p-4 sm:p-6 glass-panel rounded-2xl shadow-2xl space-y-4 sm:space-y-6"
            >
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-500 block mx-auto">
                <Trophy className="h-8 w-8 text-amber-400" />
              </div>

              <div className="space-y-1 text-center">
                <h3 className="text-2xl font-display font-extrabold text-white uppercase tracking-tight">Louvor Concluído!</h3>
                <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">Excelente louvor, {currentUser || 'Você'}!</p>
                <p className="text-xs text-slate-300 serif-font italic">"Bom é cantar louvores ao nosso Deus..." Aqui estão as suas estatísticas:</p>
              </div>

              {/* Performance scores report matrix */}
              <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-white/5 text-center">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Pontos</span>
                  <span className="text-lg font-mono font-black text-amber-400">{score}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Precisão</span>
                  <span className="text-lg font-mono font-black text-emerald-400">
                    {finalAccuracy}%
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Combo Máximo</span>
                  <span className="text-lg font-mono font-black text-amber-500">{maxStreak}</span>
                </div>
              </div>

              {/* Display Stars gained */}
              <div className="flex gap-2 justify-center py-2 text-2xl">
                {Array.from({ length: 5 }).map((_, i) => {
                  let active = false;
                  if (i === 0) active = finalAccuracy >= 0;
                  else if (i === 1) active = finalAccuracy >= 20;
                  else if (i === 2) active = finalAccuracy >= 40;
                  else if (i === 3) active = finalAccuracy >= 60;
                  else if (i === 4) active = finalAccuracy >= 80;

                  return (
                    <Star
                      key={i}
                      className={`h-6 w-6 ${active ? 'fill-amber-500 text-amber-500' : 'text-slate-800'}`}
                    />
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSaveResult}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider"
                >
                  Salvar no Histórico & Sair
                </button>
                <button
                  onClick={handleStartKaraoke}
                  className="w-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider"
                >
                  Cantar Novamente
                </button>
              </div>
            </motion.div>
          );
        })()}

      </div>

      {/* Footer bar containing sound and microphone indicators */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`p-4 bg-slate-950 border-t border-slate-900/80 flex items-center justify-between text-xs text-slate-400 transition-all duration-300 ${
          playState === 'playing' && !showMenusDuringPlay ? 'opacity-0 h-0 p-0 overflow-hidden border-none pointer-events-none' : 'opacity-100'
        }`}
      >
        
        {/* Toggle Guide synth and toggle mic simulation */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsGuideSynthOn(!isGuideSynthOn)}
            className="flex items-center gap-1.5 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer"
            title="Sintetizador guia de teclado de notas douradas"
          >
            {isGuideSynthOn ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                <span className="text-[10px] font-bold">Guia de Notas Ativo</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[10px] text-slate-500 font-bold">Guia de Notas Mudo</span>
              </>
            )}
          </button>

          <button
            onClick={() => setUseSimulatedVoice(!useSimulatedVoice)}
            className="flex items-center gap-1.5 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer"
          >
            <Keyboard className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold">
              {useSimulatedVoice ? 'Remover Teclado de Voz' : 'Simular Teclado de Voz'}
            </span>
          </button>
        </div>

        {/* Mic status lights */}
        <div className="flex items-center gap-2">
          {useSimulatedVoice ? (
            <span className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 text-[10px] font-extrabold uppercase">
              ● MODO SIMULADOR ATIVO
            </span>
          ) : isMicConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 text-[10px] font-extrabold uppercase">
              <Mic className="h-3 w-3 animate-ping" />
              ● MICROFONE CONECTADO
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 text-[10px] font-extrabold uppercase">
              <MicOff className="h-3 w-3" />
              ● MICROFONE OFF
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
