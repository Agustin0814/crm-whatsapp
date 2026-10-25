"use client";

/* eslint-disable @next/next/no-img-element --
 * Las imágenes vienen de URLs firmadas temporales de Supabase Storage; la
 * optimización de next/image no aplica (y cachearía URLs que caducan). */

import { CircleAlertIcon, DownloadIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message } from "@/lib/crm/types";
import { extensionFor, formatBytes } from "@/lib/media/rules";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./audio-player";
import { ImageViewer } from "./image-viewer";
import { useMediaUrl } from "./use-media-url";

type Props = {
  message: Message;
  /** Va dentro de la burbuja saliente (naranja): ajusta colores. */
  onBrand: boolean;
};

// Marcos de tamaño fijo: reservan el espacio antes de cargar (sin saltos de
// layout) y la imagen se ajusta dentro con su proporción (object-contain).
const FRAME = {
  image: "aspect-[4/3] w-64",
  video: "aspect-video w-72",
  sticker: "size-36",
  audio: "h-14 w-64",
  document: "h-16 w-64",
} as const;

/** Contenido multimedia de un mensaje (imagen, audio, video, documento o sticker). */
export function MediaMessage({ message, onBrand }: Props) {
  const { ref, state, retry } = useMediaUrl(message.id, message.media_status);
  const kind = message.type as keyof typeof FRAME;
  const frame = FRAME[kind] ?? FRAME.document;
  // Si el navegador no puede mostrar el archivo: una sola recarga automática
  // (por si la URL firmada caducó); si vuelve a fallar, se muestra el error.
  const autoRetried = useRef(false);
  const [broken, setBroken] = useState(false);
  function handleBroken() {
    if (!autoRetried.current) {
      autoRetried.current = true;
      retry();
    } else {
      setBroken(true);
    }
  }
  function manualRetry() {
    autoRetried.current = false;
    setBroken(false);
    retry();
  }

  let content: ReactNode;
  if (message.media_status === "pending" || state.status === "pending" || state.status === "loading") {
    content = <PendingMedia frame={frame} onBrand={onBrand} label={message.media_status === "pending" ? "Descargando…" : "Cargando…"} />;
  } else if (state.status === "failed" || broken) {
    const error = state.status === "failed" ? state.error : "El navegador no pudo mostrar el archivo.";
    content = <FailedMedia frame={frame} error={error} onRetry={manualRetry} onBrand={onBrand} />;
  } else {
    const url = state.url;
    switch (kind) {
      case "image":
        content = <ImageMedia message={message} url={url} onExpired={handleBroken} />;
        break;
      case "sticker":
        content = (
          <img
            src={url}
            alt="Sticker"
            loading="lazy"
            onError={handleBroken}
            className={cn(frame, "object-contain")}
          />
        );
        break;
      case "audio":
        content = <AudioPlayer src={url} mime={message.media_mime} onBrand={onBrand} />;
        break;
      case "video":
        content = (
          <video
            src={url}
            controls
            preload="metadata"
            playsInline
            className={cn(frame, "max-w-full rounded-xl bg-black")}
            aria-label="Video"
            onError={handleBroken}
          />
        );
        break;
      default:
        content = <DocumentMedia message={message} url={url} onBrand={onBrand} />;
    }
  }

  return <div ref={ref}>{content}</div>;
}

// --- Piezas ------------------------------------------------------------------------

function PendingMedia({ frame, onBrand, label }: { frame: string; onBrand: boolean; label: string }) {
  return (
    <div className={cn(frame, "relative max-w-full overflow-hidden rounded-xl")} role="status" aria-label={label}>
      <Skeleton className={cn("absolute inset-0 rounded-xl", onBrand && "bg-white/20")} />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center gap-2 text-xs font-medium",
          onBrand ? "text-white" : "text-texto-suave",
        )}
      >
        <Loader2Icon className="size-4 animate-spin" aria-hidden /> {label}
      </span>
    </div>
  );
}

function FailedMedia({
  frame,
  error,
  onRetry,
  onBrand,
}: {
  frame: string;
  error: string;
  onRetry: () => void;
  onBrand: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        frame,
        "flex h-auto min-h-16 max-w-full flex-col items-start justify-center gap-2 rounded-xl p-3 text-sm",
        onBrand ? "bg-white/15 text-white" : "bg-background text-texto",
      )}
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <CircleAlertIcon className={cn("size-4", onBrand ? "text-white" : "text-error-texto")} aria-hidden />
        No se pudo cargar
      </p>
      <p className={cn("text-xs", onBrand ? "text-white" : "text-texto-suave")}>{error}</p>
      <Button size="xs" variant={onBrand ? "secondary" : "outline"} onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

function ImageMedia({ message, url, onExpired }: { message: Message; url: string; onExpired: () => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const alt = message.body ? `Imagen: ${message.body}` : "Imagen recibida por WhatsApp";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(FRAME.image, "relative block max-w-full overflow-hidden rounded-xl bg-superficie-3")}
        aria-label="Ver imagen a pantalla completa"
      >
        {!loaded && <Skeleton className="absolute inset-0 rounded-xl" />}
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          // Si la URL firmada caducó, se pide otra.
          onError={onExpired}
          className="size-full object-contain"
        />
      </button>
      <ImageViewer open={open} onOpenChange={setOpen} messageId={message.id} src={url} alt={alt} caption={message.body} />
    </>
  );
}

/** Documento: solo se descarga, nunca se muestra su contenido en la página. */
function DocumentMedia({ message, url, onBrand }: { message: Message; url: string; onBrand: boolean }) {
  const name = message.media_filename ?? `Documento.${extensionFor(message.media_mime)}`;
  const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() : extensionFor(message.media_mime).toUpperCase();
  return (
    <div
      className={cn(
        "flex w-64 max-w-full items-center gap-3 rounded-xl p-2.5",
        onBrand ? "bg-white/15" : "bg-background",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          onBrand ? "bg-white text-marca-texto" : "bg-marca-suave text-marca-texto",
        )}
      >
        <FileTextIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={name}>
          {name}
        </p>
        <p className="text-xs opacity-90">
          {ext}
          {message.media_size ? ` · ${formatBytes(message.media_size)}` : ""}
        </p>
      </div>
      <a
        href={url}
        download={name}
        rel="noopener"
        aria-label={`Descargar ${name}`}
        title="Descargar"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          onBrand ? "bg-white text-marca-texto hover:bg-white/90" : "bg-superficie-3 text-texto hover:bg-borde",
        )}
      >
        <DownloadIcon className="size-4" aria-hidden />
      </a>
    </div>
  );
}
