/**
 * Pitch detection algorithms and conversions for the live karaoke engine.
 * Solves vocal pitch detection robustly using an autocorrelation-based pitch extractor.
 */

/**
 * Performs autocorrelation on an array of audio float data to detect the fundamental frequency.
 * Designed to perform quickly and reliably for home/mobile vocals in real-time.
 */
export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  // 1. Calculate the Root Mean Square (RMS) amplitude to detect silence/low volume
  let sumOfSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    const val = buffer[i];
    sumOfSquares += val * val;
  }
  const rms = Math.sqrt(sumOfSquares / buffer.length);
  
  // If the sound is too silent (threshold 0.003), reject immediately as silence/noise
  if (rms < 0.003) {
    return -1;
  }

  // 2. Perform signal clipping to refine fundamental frequencies (autocorrelation)
  // Find search boundaries. For human speech, range is roughly 75Hz (period of 586 samples at 44.1kHz)
  // to 1000Hz (period of 44 samples at 44.1kHz).
  const maxSampleDisplacement = Math.floor(sampleRate / 75);
  const minSampleDisplacement = Math.floor(sampleRate / 1000);

  let bestDisplacement = -1;
  let highestCorrelation = -1;

  // Prepare auto-correlation search array
  const displacements = new Float32Array(maxSampleDisplacement + 1);

  // We only search within displacement limits
  for (let displacement = minSampleDisplacement; displacement <= maxSampleDisplacement; displacement++) {
    let correlation = 0;
    
    // We compare overlapping parts of the buffer
    const limit = buffer.length - displacement;
    for (let i = 0; i < limit; i++) {
      correlation += buffer[i] * buffer[i + displacement];
    }
    
    displacements[displacement] = correlation;
  }

  // Find local peaks in the correlation results
  // We look for the maximum peak that represents the strongest repeating pattern
  for (let d = minSampleDisplacement; d < maxSampleDisplacement; d++) {
    const prev = displacements[d - 1];
    const curr = displacements[d];
    const next = displacements[d + 1];

    if (curr > prev && curr > next) {
      if (curr > highestCorrelation) {
        highestCorrelation = curr;
        bestDisplacement = d;
      }
    }
  }

  // If we found a valid repeating pattern with a decent correlation strength
  if (bestDisplacement !== -1 && highestCorrelation > 0.1) {
    // Parabolar interpolation to get an ultra-precise frequency (sub-sample accuracy)
    const alpha = displacements[bestDisplacement - 1];
    const beta = displacements[bestDisplacement];
    const gamma = displacements[bestDisplacement + 1];
    
    const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
    const preciseDisplacement = bestDisplacement + p;

    return sampleRate / preciseDisplacement;
  }

  return -1; // Pitch not clear
}

/**
 * Converts a frequency in Hertz (Hz) to a fractional MIDI note number.
 * 60 is Middle C (C4), 69 is A4 (440Hz).
 */
export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return -1;
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Converts a MIDI note number to its frequency in Hertz.
 */
export function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Beautiful musical note names for visual rendering in the pitch feedback
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface NoteInfo {
  name: string;
  octave: number;
}

/**
 * Converts a MIDI note value to a readable name and octave (e.g. C4, F#5)
 */
export function midiToNoteName(midiNote: number): NoteInfo {
  const rounded = Math.round(midiNote);
  const nameIndex = (rounded % 12 + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return {
    name: NOTE_NAMES[nameIndex],
    octave: octave
  };
}

/**
 * Calculates the deviation in cents between the user's MIDI value and the target MIDI value.
 * A deviation within [-50, 50] cents represents a perfect or semi-perfect hit!
 */
export function getPitchDeviationCents(userMidi: number, targetMidi: number): number {
  if (userMidi <= 0 || targetMidi <= 0) return 999;
  return (userMidi - targetMidi) * 100;
}

/**
 * Returns a score factor (0 to 1) based on the absolute deviation in semitones (midi difference),
 * wrapped around octaves to let singers hit target pitches in higher or lower comfortably.
 */
export function calculateHitAccuracy(userMidi: number, targetMidi: number): number {
  const rawDiff = Math.abs(userMidi - targetMidi);
  const octaveDiff = rawDiff % 12;
  const diff = octaveDiff > 6 ? 12 - octaveDiff : octaveDiff;

  // Highly sensitive and extremely forgiving scale for perfect/correct notes
  if (diff <= 1.8) return 1.0; // Under 1.8 semitones difference is now perfect!
  if (diff <= 3.2) {
    // Linear scale from 1.0 to 0.6
    return Math.max(0.6, 1.0 - (diff - 1.8) * 0.3);
  }
  if (diff <= 4.5) {
    // Linear scale from 0.6 to 0.2
    return Math.max(0.2, 0.6 - (diff - 3.2) * 0.3);
  }
  return 0.0;
}
