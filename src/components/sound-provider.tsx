"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearCustomTone,
  loadCustomTone,
  playCustomToneBlob,
  saveCustomTone,
  type CustomToneMeta,
} from "@/lib/custom-tone-store";
import {
  BUILTIN_TONES,
  CUSTOM_TONE_ID,
  DEFAULT_TONE,
  SOUND_ENABLED_KEY,
  SOUND_PREF_KEY,
  isToneId,
  playBuiltinTone,
  type BuiltinToneId,
  type ToneId,
} from "@/lib/notification-sounds";

type SoundContextValue = {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  toneId: ToneId;
  setToneId: (id: ToneId) => void;
  builtinTones: typeof BUILTIN_TONES;
  customMeta: CustomToneMeta | null;
  uploadCustomTone: (file: File) => Promise<void>;
  removeCustomTone: () => Promise<void>;
  previewTone: (id?: ToneId) => Promise<void>;
  playMessageTone: () => Promise<void>;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [toneId, setToneIdState] = useState<ToneId>(DEFAULT_TONE);
  const [customMeta, setCustomMeta] = useState<CustomToneMeta | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedTone = window.localStorage.getItem(SOUND_PREF_KEY);
    const savedEnabled = window.localStorage.getItem(SOUND_ENABLED_KEY);
    setToneIdState(isToneId(savedTone) ? savedTone : DEFAULT_TONE);
    setEnabledState(savedEnabled !== "0");
    void loadCustomTone()
      .then((row) => setCustomMeta(row?.meta ?? null))
      .finally(() => setReady(true));
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    window.localStorage.setItem(SOUND_ENABLED_KEY, on ? "1" : "0");
  }, []);

  const setToneId = useCallback((id: ToneId) => {
    setToneIdState(id);
    window.localStorage.setItem(SOUND_PREF_KEY, id);
  }, []);

  const playId = useCallback(async (id: ToneId) => {
    if (id === CUSTOM_TONE_ID) {
      const row = await loadCustomTone();
      if (!row) throw new Error("Upload a custom tone first.");
      await playCustomToneBlob(row.blob);
      return;
    }
    playBuiltinTone(id as BuiltinToneId);
  }, []);

  const previewTone = useCallback(
    async (id?: ToneId) => {
      await playId(id ?? toneId);
    },
    [playId, toneId],
  );

  const playMessageTone = useCallback(async () => {
    if (!ready || !enabled) return;
    try {
      await playId(toneId);
    } catch {
      // Autoplay may be blocked until a user gesture; ignore quietly.
    }
  }, [enabled, playId, ready, toneId]);

  const uploadCustomTone = useCallback(
    async (file: File) => {
      const meta = await saveCustomTone(file);
      setCustomMeta(meta);
      setToneId(CUSTOM_TONE_ID);
    },
    [setToneId],
  );

  const removeCustomTone = useCallback(async () => {
    await clearCustomTone();
    setCustomMeta(null);
    if (toneId === CUSTOM_TONE_ID) setToneId(DEFAULT_TONE);
  }, [setToneId, toneId]);

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      toneId,
      setToneId,
      builtinTones: BUILTIN_TONES,
      customMeta,
      uploadCustomTone,
      removeCustomTone,
      previewTone,
      playMessageTone,
    }),
    [
      enabled,
      setEnabled,
      toneId,
      setToneId,
      customMeta,
      uploadCustomTone,
      removeCustomTone,
      previewTone,
      playMessageTone,
    ],
  );

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within SoundProvider");
  return ctx;
}
