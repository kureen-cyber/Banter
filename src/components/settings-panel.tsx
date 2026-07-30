"use client";

import { useRef, useState } from "react";
import {
  Check,
  Moon,
  Palette,
  Play,
  Sun,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useSound } from "@/components/sound-provider";
import { CUSTOM_TONE_ID } from "@/lib/notification-sounds";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const { theme, setTheme, mode, setMode, themes } = useTheme();
  const {
    enabled,
    setEnabled,
    toneId,
    setToneId,
    builtinTones,
    customMeta,
    uploadCustomTone,
    removeCustomTone,
    previewTone,
  } = useSound();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await uploadCustomTone(file);
      await previewTone(CUSTOM_TONE_ID);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)]/80 px-5 backdrop-blur-md">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            Settings
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Appearance, message tones, and atmosphere
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Color mode
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Switch the UI chrome between light and dark. Background themes
              keep their fluid accents either way.
            </p>

            <div className="mt-4 inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-1">
              <button
                type="button"
                onClick={() => setMode("light")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                  mode === "light"
                    ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
              <button
                type="button"
                onClick={() => setMode("dark")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                  mode === "dark"
                    ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
            </div>
          </section>

          <section>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink)]">
                  Message notification sound
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Play a tone when new messages or notifications arrive. Saved
                  on this device — including tones uploaded from your phone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                  enabled
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)]",
                )}
                aria-pressed={enabled}
              >
                {enabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
                {enabled ? "On" : "Off"}
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {builtinTones.map((tone) => {
                const active = toneId === tone.id;
                return (
                  <li key={tone.id}>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 transition",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                          : "border-[var(--border)] bg-[var(--surface)]/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setToneId(tone.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-medium text-[var(--ink)]">
                          {tone.name}
                          {active && (
                            <Check className="ml-1.5 inline h-3.5 w-3.5 text-[var(--accent)]" />
                          )}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {tone.description}
                        </p>
                      </button>
                      <button
                        type="button"
                        title="Preview"
                        onClick={() => void previewTone(tone.id)}
                        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}

              <li>
                <div
                  className={cn(
                    "rounded-xl border px-3 py-3 transition",
                    toneId === CUSTOM_TONE_ID
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                      : "border-[var(--border)] bg-[var(--surface)]/40",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (customMeta) setToneId(CUSTOM_TONE_ID);
                        else fileRef.current?.click();
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-[var(--ink)]">
                        Custom tone
                        {toneId === CUSTOM_TONE_ID && (
                          <Check className="ml-1.5 inline h-3.5 w-3.5 text-[var(--accent)]" />
                        )}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {customMeta
                          ? customMeta.name
                          : "Upload a song or sound from your phone or computer."}
                      </p>
                    </button>
                    {customMeta && (
                      <button
                        type="button"
                        title="Preview custom tone"
                        onClick={() => void previewTone(CUSTOM_TONE_ID)}
                        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm"
                      className="hidden"
                      onChange={(e) =>
                        void onFileChange(e.target.files?.[0] ?? null)
                      }
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploading
                        ? "Uploading…"
                        : customMeta
                          ? "Replace from phone"
                          : "Upload from phone"}
                    </button>
                    {customMeta && (
                      <button
                        type="button"
                        onClick={() => void removeCustomTone()}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                  {uploadError && (
                    <p className="mt-2 text-xs text-rose-600">{uploadError}</p>
                  )}
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    Audio stays on this device (up to 3 MB). On phones, pick a
                    file from Files / Music.
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Background themes
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pick a fluid, code-inspired backdrop. Your choice is saved on this
              device.
            </p>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {themes.map((t) => {
                const active = theme === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={cn(
                        "group w-full overflow-hidden rounded-2xl border text-left transition",
                        active
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/25"
                          : "border-[var(--border)] hover:border-[var(--accent)]/50",
                      )}
                    >
                      <div
                        className="relative h-28"
                        style={{
                          background: `radial-gradient(circle at 20% 20%, ${t.preview[0]}aa, transparent 45%), radial-gradient(circle at 80% 30%, ${t.preview[1]}99, transparent 40%), linear-gradient(135deg, ${t.preview[2]}, #0f172a)`,
                        }}
                      >
                        <div className="absolute inset-0 opacity-40">
                          <div className="absolute left-3 top-3 font-[family-name:var(--font-mono)] text-[10px] text-white/80">
                            {"const vibe = '" + t.id + "'"}
                          </div>
                          <div className="absolute bottom-3 right-3 font-[family-name:var(--font-mono)] text-[10px] text-white/55">
                            {"// fluid · code"}
                          </div>
                        </div>
                        {active && (
                          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-900">
                            <Check className="h-3 w-3 text-[var(--accent)]" />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="bg-[var(--panel)]/90 px-4 py-3 backdrop-blur-sm">
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {t.name}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                          {t.tagline}
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          {t.preview.map((c) => (
                            <span
                              key={c}
                              className="h-3 w-3 rounded-full border border-black/10"
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
