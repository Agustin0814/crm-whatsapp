"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Selección fija de emojis frecuentes en atención a clientes (sin dependencias).
const CATEGORIES = [
  {
    id: "caras",
    label: "Caras",
    emojis: "😀 😃 😄 😁 😊 🙂 😉 😍 😘 😎 🤩 🥳 😇 🤗 🤔 🤨 😐 😅 😂 🤣 😢 😭 😮 😴 😬 🙄 😳 🥺 😤 😡 🤒 🤝".split(" "),
  },
  {
    id: "gestos",
    label: "Gestos",
    emojis: "👍 👎 👌 ✌️ 🤞 👏 🙌 🙏 💪 👋 🤙 ☝️ 👉 👈 👇 👆 ✋ 🫶 🤲 ✍️".split(" "),
  },
  {
    id: "trabajo",
    label: "Trabajo",
    emojis: "🧱 🏗️ 🏠 🏢 🏭 🚚 📦 🛠️ 🔧 🔨 📐 📏 🧰 ⛏️ 🪵 💰 💵 🧾 📄 📋 📅 ⏰ 📍 📞 📱 💻 ✉️ 🔒".split(" "),
  },
  {
    id: "simbolos",
    label: "Símbolos",
    emojis: "✅ ❌ ⚠️ ❗ ❓ 💯 ⭐ 🌟 🔥 🎉 ❤️ 🧡 💚 💙 👉 ➡️ ⬅️ 🔝 🆗 🆕 ℹ️ ☀️ 🌧️ 🇲🇽".split(" "),
  },
] as const;

type Props = {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
};

/** Botón «emoji» con un panel de emojis por categorías. */
export function EmojiPicker({ onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("caras");
  const current = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="shrink-0 text-texto-suave hover:text-texto"
              aria-label="Insertar emoji"
            >
              <Icon name="emoji" className="size-5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Emoji</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-2"
        // Al cerrar, el foco vuelve al campo de texto (lo hace onSelect).
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-2 flex gap-1" role="tablist" aria-label="Categorías de emoji">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === category}
              onClick={() => setCategory(c.id)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-xs font-medium",
                c.id === category ? "bg-marca-suave text-marca-texto" : "text-texto-suave hover:bg-superficie-2",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-0.5" role="tabpanel" aria-label={current.label}>
          {current.emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="flex size-9 items-center justify-center rounded-md text-xl hover:bg-superficie-2"
              aria-label={`Insertar ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
