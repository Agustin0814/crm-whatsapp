"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { fetchMediaUrl } from "./use-media-url";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  src: string;
  alt: string;
  caption?: string | null;
};

/**
 * Visor de imagen a pantalla completa. Radix Dialog atrapa el foco,
 * cierra con Escape y devuelve el foco a la miniatura al cerrar.
 */
export function ImageViewer({ open, onOpenChange, messageId, src, alt, caption }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    // URL firmada con Content-Disposition: attachment (se pide en el momento).
    const res = await fetchMediaUrl(messageId, true);
    setDownloading(false);
    if (res.status !== "ready") {
      toast.error(res.status === "failed" ? res.error : "El archivo aún se está descargando.");
      return;
    }
    const a = document.createElement("a");
    a.href = res.url;
    a.rel = "noopener";
    a.click();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          aria-describedby={caption ? "visor-leyenda" : undefined}
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <div className="flex items-center justify-end gap-2 p-3">
            <IconButton
              label="Descargar imagen"
              variant="ghost"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => void download()}
              disabled={downloading}
            >
              {downloading ? <Loader2Icon className="size-5 animate-spin" aria-hidden /> : <DownloadIcon className="size-5" aria-hidden />}
            </IconButton>
            <DialogPrimitive.Close asChild>
              <IconButton label="Cerrar visor" variant="ghost" className="text-white hover:bg-white/15 hover:text-white">
                <Icon name="cerrar" className="size-6" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={() => onOpenChange(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase */}
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {caption && (
            <p id="visor-leyenda" className="mx-auto max-w-3xl px-4 pb-6 text-center text-sm whitespace-pre-wrap text-white">
              {caption}
            </p>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
