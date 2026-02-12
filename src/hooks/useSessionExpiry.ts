import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const useSessionExpiry = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExpiry = useCallback(async () => {
    if (!user) return;
    await signOut();
    toast({
      title: "Sesión expirada / Session expired",
      description: "Tu sesión se cerró por inactividad. / Your session was closed due to inactivity.",
    });
  }, [user, signOut, toast]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (user) {
      timerRef.current = setTimeout(handleExpiry, INACTIVITY_TIMEOUT_MS);
    }
  }, [user, handleExpiry]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, resetTimer]);
};
