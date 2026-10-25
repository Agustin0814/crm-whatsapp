"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Tema con la clase .dark en <html>. El área de trabajo es clara por defecto;
 * el usuario puede elegir oscuro o «sistema» (la barra lateral siempre es oscura).
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange {...props} />;
}
