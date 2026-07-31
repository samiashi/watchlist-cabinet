import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { getOrCreateShareLink, loadCloudSnapshot } from "./lib/cloudStorage";
import { isSupabaseConfigured } from "./lib/supabase";
import type { Watch } from "./lib/types";
import { useAuth } from "./hooks/useAuth";
import { useConfirm } from "./hooks/useConfirm";
import { useFilters } from "./hooks/useFilters";
import { useToast } from "./hooks/useToast";
import { useWatches } from "./hooks/useWatches";
import { loadLocalSnapshot, loadStoredFilters, saveLocalSnapshot, saveStoredFilters } from "./lib/localStorage";
import { AnimatedPresence } from "./components/AnimatedPresence";
import { AuthGate } from "./components/AuthGate";
import { Board } from "./components/Board";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ImagePreview } from "./components/ImagePreview";
import { LoadingScreen } from "./components/LoadingScreen";
import { MobileSummary } from "./components/MobileSummary";
import { WatchDrawer } from "./components/WatchDrawer";
import { ToastContainer } from "./components/ToastContainer";
import { Topbar } from "./components/Topbar";

const SharedWishlistPage = lazy(() => import("./components/SharedWishlistPage").then((module) => ({ default: module.SharedWishlistPage })));

const siteUrl = import.meta.env.VITE_SITE_URL?.trim();

type DrawerState = { open: false; editingId: null } | { open: true; editingId: string | null };
type PreviewState = { watch: Watch; imageIndex: number };

function App() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/share/:token" component={SharedWishlistRoute} />
        <Route>{() => <CabinetApp />}</Route>
      </Switch>
    </ErrorBoundary>
  );
}

function SharedWishlistRoute({ params }: { params: { token: string } }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SharedWishlistPage params={params} />
    </Suspense>
  );
}

function CabinetApp() {
  const { session, authMessage, signInWithGoogle, signOut, isAuthLoading } = useAuth();
  const cloudUser = session?.user || null;
  const { toasts, showToast } = useToast();
  const { confirmDialog, setConfirmDialog, confirmAction } = useConfirm();
  const { watches, setWatches, saveWatch, deleteWatch, reorderWatches, handleWatchFormSubmit, isSavingWatch } = useWatches(cloudUser, showToast, confirmAction);
  const { filters, setFilters, updateFilters, summary, filteredWatches } = useFilters(watches);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, editingId: null });
  const [previewWatch, setPreviewWatch] = useState<PreviewState | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(isSupabaseConfigured);
  const [cloudLoadError, setCloudLoadError] = useState("");
  const [cloudRetry, setCloudRetry] = useState(0);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const snapshot = loadLocalSnapshot();
    setWatches(snapshot.watches);
    setFilters(snapshot.filters);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || isAuthLoading) return;
    setIsLoaded(true);
  }, [isAuthLoading]);

  useEffect(() => {
    if (!isSupabaseConfigured || !cloudUser) return;
    const storedFilters = loadStoredFilters(cloudUser.id);
    setFilters(storedFilters || { tab: "all", query: "", sort: "relevance" });
  }, [cloudUser?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !isLoaded || !cloudUser) return;
    saveStoredFilters(cloudUser.id, filters);
  }, [cloudUser?.id, filters, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !cloudUser || !isSupabaseConfigured) {
      if (!cloudUser) setIsCloudLoading(false);
      return;
    }

    let active = true;
    setIsCloudLoading(true);
    setCloudLoadError("");

    loadCloudSnapshot(cloudUser)
      .then((snapshot) => {
        if (!active) return;
        setWatches(snapshot.watches);
        setCloudLoadError("");
        setIsCloudLoading(false);
      })
      .catch((error: Error) => {
        if (!active) return;
        if (import.meta.env.DEV) console.error("Could not load Supabase data", error);
        setCloudLoadError("Cloud data could not be loaded. Check your connection and try again.");
        setIsCloudLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cloudUser, isLoaded, cloudRetry]);

  useEffect(() => {
    if (!isLoaded || isSupabaseConfigured) return;
    saveLocalSnapshot({ watches, filters });
  }, [filters, isLoaded, watches]);

  async function shareWishlist() {
    if (!cloudUser) {
      showToast("Sign in with Google to share your wishlist.");
      return;
    }

    setIsSharing(true);
    try {
      const token = await getOrCreateShareLink(cloudUser);
      const url = `${getAppBaseUrl()}/share/${token}`;
      const copied = await copyShareUrl(url);
      showToast(copied ? "Wishlist link copied." : "Copy cancelled.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Wishlist link was not created.");
    } finally {
      setIsSharing(false);
    }
  }

  function openDrawer(editingId: string | null = null) {
    setDrawer({ open: true, editingId });
  }

  function closeDrawer() {
    setDrawer({ open: false, editingId: null });
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not sign out. Try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (event.key === "/" && !isInput) {
        event.preventDefault();
        document.getElementById("searchInput")?.focus();
      }

      if ((event.key === "n" || event.key === "N") && !isInput) {
        event.preventDefault();
        openDrawer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isLoaded || isAuthLoading) {
    return <LoadingScreen />;
  }

  if (isSupabaseConfigured && !session) {
    return <AuthGate message={authMessage} onSignIn={signInWithGoogle} />;
  }

  if (isSupabaseConfigured && cloudLoadError) {
    return <CloudLoadError message={cloudLoadError} onRetry={() => setCloudRetry((value) => value + 1)} />;
  }

  if (isSupabaseConfigured && cloudUser && isCloudLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <Topbar
          filters={filters}
          canShare={Boolean(cloudUser)}
          canSignOut={Boolean(cloudUser)}
          isSharing={isSharing}
          isSigningOut={isSigningOut}
          summary={summary}
          onAdd={() => openDrawer()}
          onShare={shareWishlist}
          onSignOut={handleSignOut}
          onQueryChange={(query) => updateFilters({ query })}
        />
        <MobileSummary summary={summary} />
        <div className="content-grid">
          <Board
            watches={filteredWatches}
            filters={filters}
            canReorder={filters.sort === "relevance" && !filters.query.trim()}
            onFilterChange={updateFilters}
            onPreview={(watch, imageIndex = 0) => setPreviewWatch({ watch, imageIndex })}
            onReorder={reorderWatches}
            onAdd={() => openDrawer()}
          />
        </div>
      </main>
      <AnimatedPresence show={drawer.open} enterTimeout={260} exitTimeout={200} wrapperClass="drawer-wrapper">
        <WatchDrawer
          editing={drawer.editingId ? watches.find((watch) => watch.id === drawer.editingId) || null : null}
          filters={filters}
          isSubmitting={isSavingWatch}
          canUploadImages={Boolean(cloudUser)}
          onClose={closeDrawer}
          onSubmit={(event) => handleWatchFormSubmit(event, drawer.editingId, closeDrawer)}
        />
      </AnimatedPresence>
      <AnimatedPresence show={Boolean(previewWatch)} enterTimeout={200} exitTimeout={160} wrapperClass="preview-wrapper">
        {previewWatch ? (
          <ImagePreview
            watch={previewWatch.watch}
            initialImageIndex={previewWatch.imageIndex}
            onClose={() => setPreviewWatch(null)}
            onEdit={(id) => {
              setPreviewWatch(null);
              openDrawer(id);
            }}
            onDelete={async (id) => {
              const deleted = await deleteWatch(id);
              if (deleted) setPreviewWatch(null);
            }}
          />
        ) : null}
      </AnimatedPresence>
      {confirmDialog ? (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={() => {
            const resolve = confirmDialog.resolve;
            setConfirmDialog(null);
            resolve(true);
          }}
          onCancel={() => {
            const resolve = confirmDialog.resolve;
            setConfirmDialog(null);
            resolve(false);
          }}
        />
      ) : null}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

function getAppBaseUrl() {
  return (siteUrl || window.location.origin).replace(/\/+$/, "");
}

async function copyShareUrl(url: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Fall through to the manual copy prompt when the browser blocks clipboard access.
    }
  }

  return window.prompt("Copy wishlist link", url) !== null;
}

function CloudLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="auth-shell" aria-label="Could not load cabinet">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h1>Could not load Cabinet</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.5 }}>{message}</p>
        <button className="button button-primary" type="button" onClick={onRetry} style={{ width: "100%", height: "46px" }}>
          Try again
        </button>
      </div>
    </main>
  );
}

export default App;
