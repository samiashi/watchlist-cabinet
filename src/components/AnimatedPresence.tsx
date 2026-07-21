import { useLayoutEffect, useState } from "react";

export function AnimatedPresence({ show, children, enterTimeout = 200, exitTimeout = 200, wrapperClass = "" }: { show: boolean; children: React.ReactNode; enterTimeout?: number; exitTimeout?: number; wrapperClass?: string }) {
  const [mounted, setMounted] = useState(show);
  const [phase, setPhase] = useState<"entering" | "idle" | "exiting">(show ? "entering" : "exiting");

  useLayoutEffect(() => {
    if (show) {
      setMounted(true);
      setPhase("entering");
      const timer = setTimeout(() => {
        setPhase("idle");
      }, enterTimeout);
      return () => clearTimeout(timer);
    } else {
      setPhase("exiting");
      const timer = setTimeout(() => {
        setMounted(false);
      }, exitTimeout);
      return () => clearTimeout(timer);
    }
  }, [enterTimeout, exitTimeout, show]);

  if (!mounted) return null;

  return (
    <div className={`${wrapperClass} ${phase}`.trim()}>
      {children}
    </div>
  );
}
