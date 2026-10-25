"use client";

import { DownloadIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { baseMime } from "@/lib/media/rules";
import { cn } from "@/lib/utils";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  src: string;
  mime: string | null;
  /** Colores para ir dentro de la burbuja saliente (naranja). */
  onBrand?: boolean;
};

/**
 * Reproductor de audio ligero: play/pausa, barra de progreso y duración.
 * Las notas de voz de WhatsApp son ogg/opus; si el navegador no puede
 * reproducirlas (p. ej. Safari antiguo), se ofrece la descarga.
 */
export function AudioPlayer({ src, mime, onBrand = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  // canPlayType devuelve "" si el navegador sabe que no puede reproducirlo.
  const supported = useMemo(() => {
    if (typeof document === "undefined" || !mime) return true;
    const probe = document.createElement("audio");
    const type = baseMime(mime) === "audio/ogg" ? 'audio/ogg; codecs="opus"' : baseMime(mime);
    return probe.canPlayType(type) !== "";
  }, [mime]);

  if (!supported || failed) {
    return (
      <a
        href={src}
        download
        rel="noopener"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium underline-offset-4 hover:underline",
          onBrand ? "bg-white/15 text-white" : "bg-background text-texto",
        )}
      >
        <DownloadIcon className="size-4" aria-hidden />
        Tu navegador no reproduce este audio. Descargar
      </a>
    );
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  }

  const knownDuration = Number.isFinite(duration) && duration > 0;

  return (
    <div className="flex w-64 max-w-full items-center gap-3 py-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar audio" : "Reproducir audio"}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          onBrand ? "bg-white text-marca-texto" : "bg-marca-fuerte text-white",
        )}
      >
        {playing ? <PauseIcon className="size-4" aria-hidden /> : <PlayIcon className="ml-0.5 size-4" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <input
          type="range"
          min={0}
          max={knownDuration ? duration : 1}
          step={0.1}
          value={knownDuration ? Math.min(current, duration) : 0}
          disabled={!knownDuration}
          onChange={(e) => {
            const audio = audioRef.current;
            if (audio) audio.currentTime = Number(e.target.value);
          }}
          aria-label="Progreso del audio"
          aria-valuetext={`${formatClock(current)} de ${formatClock(duration)}`}
          className={cn("h-1.5 w-full cursor-pointer", onBrand ? "accent-white" : "accent-marca")}
        />
        <p className="text-[0.6875rem] tabular-nums opacity-90">
          {formatClock(current)} / {knownDuration ? formatClock(duration) : "–:––"}
        </p>
      </div>
    </div>
  );
}
