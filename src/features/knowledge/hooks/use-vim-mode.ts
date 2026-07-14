import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "knowledge:vim-mode";

/**
 * Persisted opt-in for vim keybindings in the knowledge editor. Starts `false`
 * on the server and first client render (avoiding hydration mismatch), then
 * hydrates from localStorage.
 */
export function useVimMode(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const update = useCallback((next: boolean) => {
    setEnabled(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  return [enabled, update];
}
