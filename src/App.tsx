import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { getOrCreateShareLink, loadCloudSnapshot } from "./lib/cloudStorage";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Watch } from "./lib/types";
import { useAuth } from "./hooks/useAuth";
import { useConfirm } from "./hooks/useConfirm";
import { useFilters } from "./hooks/useFilters";
import { useToast } from "./hooks/useToast";
import { useWatches } from "./hooks/useWatches";
import { loadLocalSnapshot, saveLocalSnapshot } from "./lib/localStorage";
import { AnimatedPresence } from "./components/AnimatedPresence";
import { AuthGate } from "./components/AuthGate";
import { Board } from "./components/Board";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ImagePreview } from "./components/ImagePreview";
import { LoadingScreen } from "./components/LoadingScreen";
import { MobileSummary } from "./components/MobileSummary";
import { SharedWishlistPage } from "./components/SharedWishlistPage";
import { ToastContainer } from "./components/ToastContainer";
import { Topbar } from "./components/Topbar";
import { WatchDrawer } from "./components/WatchDrawer";

const siteUrl = import.meta.env.VITE_SITE_URL?.trim();

type DrawerState = { open: false; editingId: null } | { open: true; editingId: string | null };
type PreviewState = { watch: Watch; imageIndex: number };

function App() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/share/:token" component={SharedWishlistPage} />
        <Route>{() => <CabinetApp />}</Route>
      </Switch>
    </ErrorBoundary>
  );
}

function CabinetApp() {
  const { session, setSession, authMessage, setAuthMessage, signInWithGoogle } = useAuth();
  const cloudUser = session?.user || null;
  const { toasts, showToast } = useToast();
  const { confirmDialog, setConfirmDialog, confirmAction } = useConfirm();
  const { watches, setWatches, saveWatch, deleteWatch, reorderWatches, handleWatchFormSubmit, isSavingWatch } = useWatches(cloudUser, showToast, confirmAction);
  const { filters, setFilters, updateFilters, summary, filteredWatches } = useFilters(watches);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, editingId: null });
  const [previewWatch, setPreviewWatch] = useState<PreviewState | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const snapshot = loadLocalSnapshot();
      setWatches(snapshot.watches);
      setFilters(snapshot.filters);
      setIsLoaded(true);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setAuthMessage("");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !cloudUser) return;

    let active = true;

    loadCloudSnapshot(cloudUser)
      .then((snapshot) => {
        if (!active) return;
        setWatches(snapshot.watches);
        setFilters(snapshot.filters);
      })
      .catch((error: Error) => {
        if (!active) return;
        showToast(`Could not load Supabase data: ${error.message}`);
      });

    return () => {
      active = false;
    };
  }, [cloudUser, isLoaded]);

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
      await copyShareUrl(url);
      showToast("Wishlist link copied.");
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

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (isSupabaseConfigured && !session) {
    return <AuthGate message={authMessage} onSignIn={signInWithGoogle} />;
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <Topbar
          filters={filters}
          canShare={Boolean(cloudUser)}
          isSharing={isSharing}
          summary={summary}
          onAdd={() => openDrawer()}
          onShare={shareWishlist}
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
    await navigator.clipboard.writeText(url);
    return;
  }

  window.prompt("Copy wishlist link", url);
}

export default App;
