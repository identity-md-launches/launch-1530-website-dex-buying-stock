import { useCallback, useEffect, useRef, useState } from "react";
import { friendlyError, readDex } from "./chain";
import type { DexState } from "./chain";
export function useDex() {
  const [dex, setDex] = useState<DexState>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const data = await readDex();
      if (id === request.current) setDex(data);
    } catch (e) {
      if (id === request.current) {
        setDex(undefined);
        setError(friendlyError(e));
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      request.current++;
    };
  }, [refresh]);
  return { dex, loading, error, refresh };
}
export type DexHook = ReturnType<typeof useDex>;
