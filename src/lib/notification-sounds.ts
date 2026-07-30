export const SOUND_PREF_KEY = "banter-message-tone";
export const SOUND_ENABLED_KEY = "banter-message-tone-enabled";
export const CUSTOM_TONE_ID = "custom" as const;

export type BuiltinToneId =
  | "chime"
  | "ping"
  | "pop"
  | "soft-bell"
  | "digital"
  | "knock"
  | "pulse";

export type ToneId = BuiltinToneId | typeof CUSTOM_TONE_ID;

export type ToneDefinition = {
  id: BuiltinToneId;
  name: string;
  description: string;
};

export const BUILTIN_TONES: ToneDefinition[] = [
  {
    id: "chime",
    name: "Harbor chime",
    description: "Two soft ascending notes — calm and clear.",
  },
  {
    id: "ping",
    name: "Quick ping",
    description: "A short bright tap for busy threads.",
  },
  {
    id: "pop",
    name: "Bubble pop",
    description: "Friendly low-to-high blip.",
  },
  {
    id: "soft-bell",
    name: "Soft bell",
    description: "Gentle resonant ding without sharp edges.",
  },
  {
    id: "digital",
    name: "Digital blip",
    description: "Square-ish tech cue for coding sessions.",
  },
  {
    id: "knock",
    name: "Desk knock",
    description: "Muted percussive double-tap.",
  },
  {
    id: "pulse",
    name: "Pulse",
    description: "Warm sine swell — easy on the ears.",
  },
];

export const DEFAULT_TONE: ToneId = "chime";

export function isBuiltinToneId(value: string | null | undefined): value is BuiltinToneId {
  return BUILTIN_TONES.some((t) => t.id === value);
}

export function isToneId(value: string | null | undefined): value is ToneId {
  return value === CUSTOM_TONE_ID || isBuiltinToneId(value);
}

type Note = {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
};

function playNotes(notes: Note[], masterGain = 0.18) {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;
    const peak = (note.gain ?? 1) * masterGain;
    const t0 = now + note.start;
    const t1 = t0 + note.duration;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  window.setTimeout(() => {
    void ctx.close();
  }, 1200);
}

export function playBuiltinTone(id: BuiltinToneId) {
  switch (id) {
    case "chime":
      playNotes([
        { freq: 523.25, start: 0, duration: 0.22 },
        { freq: 659.25, start: 0.12, duration: 0.28 },
      ]);
      break;
    case "ping":
      playNotes([{ freq: 880, start: 0, duration: 0.12, type: "triangle" }], 0.16);
      break;
    case "pop":
      playNotes([
        { freq: 220, start: 0, duration: 0.08, type: "sine", gain: 0.9 },
        { freq: 440, start: 0.05, duration: 0.1, type: "sine", gain: 0.7 },
      ]);
      break;
    case "soft-bell":
      playNotes([
        { freq: 587.33, start: 0, duration: 0.45, type: "sine", gain: 0.85 },
        { freq: 880, start: 0.02, duration: 0.35, type: "triangle", gain: 0.35 },
      ]);
      break;
    case "digital":
      playNotes([
        { freq: 740, start: 0, duration: 0.07, type: "square", gain: 0.45 },
        { freq: 990, start: 0.08, duration: 0.09, type: "square", gain: 0.35 },
      ], 0.12);
      break;
    case "knock":
      playNotes([
        { freq: 120, start: 0, duration: 0.07, type: "triangle", gain: 1 },
        { freq: 100, start: 0.1, duration: 0.08, type: "triangle", gain: 0.85 },
      ], 0.22);
      break;
    case "pulse":
      playNotes([{ freq: 392, start: 0, duration: 0.35, type: "sine", gain: 0.9 }], 0.2);
      break;
    default:
      playNotes([{ freq: 660, start: 0, duration: 0.15 }]);
  }
}
