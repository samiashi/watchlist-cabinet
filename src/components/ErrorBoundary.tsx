import { Component } from "react";
import { Watch } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <main className="auth-shell" aria-label="Something went wrong">
          <div className="auth-card" style={{ textAlign: "center" }}>
            <div className="brand-mark" style={{ margin: "0 auto" }} aria-hidden="true">
              <Watch size={21} />
            </div>
            <h1>Something went wrong</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.5 }}>
              {import.meta.env.DEV ? this.state.error?.message || "An unexpected error occurred." : "Please reload the page and try again."}
            </p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => window.location.reload()}
              style={{ width: "100%", height: "46px" }}
            >
              Reload page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
