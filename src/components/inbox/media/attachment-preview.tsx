"use client";

/* eslint-disable @next/next/no-img-element -- vista previa local (object URL) del archivo elegido */

import { FileTextIcon, MicIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { formatBytes, SEND_RULES, type MediaKind } from "@/lib/media/rules";
import { cn } from "@/lib/utils";

export type Attachment = {
  file: File;
  kind: MediaKind;
  mime: string;
  /** Object URL para la vista previa (imagen, sticker o video). */
  previewUrl: string | null;
};

type Props = {
  attachment: Attachment;
  /** Progreso de subida 0..1, o null si aún no se envía. */
  progress: number | null;
  onRemove: () => void;
};

const KIND_LABELS: Record<MediaKind, string> = {
  image: "Imagen",
  audio: "Audio",
  video: "Video",
  document: "Documento",
  sticker: "Sticker",
};

/** Tarjeta del archivo elegido antes de enviarlo, con su progreso de subida. */
export function AttachmentPreview({ attachment, progress, onRemove }: Props) {
  const { file, kind, previewUrl } = attachment;
  const uploading = progress !== null;
  const percent = Math.round((progress ?? 0) * 100);

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-superficie-2 p-2.5">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-superficie-3">
        {previewUrl && (kind === "image" || kind === "sticker") && (
          <img src={previewUrl} alt="" className="size-full object-contain" />
        )}
        {previewUrl && kind === "video" && <video src={previewUrl} muted className="size-full object-cover" aria-hidden />}
        {kind === "audio" && <MicIcon className="size-6 text-marca-texto" aria-hidden />}
        {kind === "document" && <FileTextIcon className="size-6 text-marca-texto" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold" title={file.name}>
          {file.name || KIND_LABELS[kind]}
        </p>
        <p className="text-xs text-texto-suave">
          {KIND_LABELS[kind]} · {formatBytes(file.size)}
          {!SEND_RULES[kind].caption && " · sin leyenda"}
        </p>
        {uploading && (
          <div className="space-y-0.5">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-superficie-3"
              role="progressbar"
              aria-label="Progreso de la subida"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={cn("h-full rounded-full bg-marca transition-[width]")} style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[0.6875rem] text-texto-suave tabular-nums">
              {percent < 100 ? `Subiendo… ${percent} %` : "Enviando a WhatsApp…"}
            </p>
          </div>
        )}
      </div>

      <IconButton label={uploading ? "Cancelar envío" : "Quitar archivo"} size="icon-sm" onClick={onRemove}>
        <Icon name="cerrar" />
      </IconButton>
    </div>
  );
}
