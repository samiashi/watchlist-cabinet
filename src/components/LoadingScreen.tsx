import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="auth-shell" aria-label="Loading cabinet">
      <div className="auth-card">
        <Loader2 className="spin" size={24} aria-hidden="true" />
        <h1>Loading Cabinet</h1>
      </div>
    </main>
  );
}
