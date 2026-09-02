"use client";

import { useEffect, useState } from "react";

export const COLOR_MODE_STORAGE_KEY = "sieve:color-mode";

export type ColorMode = "auto" | "light" | "dark";

// Runs inline in <head> so the stored choice lands before the first paint.
export const colorModeInitScript = `(function(){var m;try{m=localStorage.getItem(${JSON.stringify(
  COLOR_MODE_STORAGE_KEY,
)})}catch(e){}document.documentElement.dataset.colorMode=m==="light"||m==="dark"?m:"auto"})()`;

function readColorMode(): ColorMode {
  const mode = document.documentElement.dataset.colorMode;
  return mode === "light" || mode === "dark" ? mode : "auto";
}

function applyColorMode(mode: ColorMode) {
  document.documentElement.dataset.colorMode = mode;
  if (mode === "auto") {
    window.localStorage.removeItem(COLOR_MODE_STORAGE_KEY);
  } else {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  }
}

export function useColorMode() {
  const [mode, setModeState] = useState<ColorMode>("auto");
  useEffect(() => {
    setModeState(readColorMode());
    function syncMode(event: StorageEvent) {
      if (event.key === COLOR_MODE_STORAGE_KEY) {
        const next =
          event.newValue === "light" || event.newValue === "dark"
            ? event.newValue
            : "auto";
        document.documentElement.dataset.colorMode = next;
        setModeState(next);
      }
    }
    window.addEventListener("storage", syncMode);
    return () => window.removeEventListener("storage", syncMode);
  }, []);
  function setMode(next: ColorMode) {
    applyColorMode(next);
    setModeState(next);
  }
  return { mode, setMode };
}

export function useColorScheme(): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function resolve() {
      const mode = readColorMode();
      setScheme(mode === "auto" ? (media.matches ? "dark" : "light") : mode);
    }
    resolve();
    media.addEventListener("change", resolve);
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-mode"],
    });
    return () => {
      media.removeEventListener("change", resolve);
      observer.disconnect();
    };
  }, []);
  return scheme;
}

export function ColorModeSelect() {
  const { mode, setMode } = useColorMode();
  return (
    <select
      aria-label="Color mode"
      className="h-7 cursor-pointer rounded-md border border-btn-border bg-btn pl-2 pr-6 text-xs font-medium text-btn-fg shadow-btn outline-none transition-colors hover:bg-btn-hover focus-visible:ring-2 focus-visible:ring-ring"
      value={mode}
      onChange={(event) => setMode(event.target.value as ColorMode)}
    >
      <option value="auto">System theme</option>
      <option value="light">Light theme</option>
      <option value="dark">Dark theme</option>
    </select>
  );
}
