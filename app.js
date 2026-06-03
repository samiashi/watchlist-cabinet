const STORAGE_KEY = "watchlist-cabinet-state-v2";

const categories = [
  { name: "Dress", target: 1 },
  { name: "Diver", target: 1 },
  { name: "Field", target: 1 },
  { name: "Chronograph", target: 1 },
  { name: "GMT", target: 1 },
  { name: "Daily", target: 2 }
];

const categoryThemes = {
  Dress: { bg: "#1b1714", case: "#d5b26a", dial: "#f0dfbf", strap: "#17191d", detail: "#5d4930" },
  Diver: { bg: "#101d24", case: "#7794a1", dial: "#102a34", strap: "#121d24", detail: "#d4e8ef" },
  Field: { bg: "#151d15", case: "#7c8e73", dial: "#1c261b", strap: "#202718", detail: "#dfe8d4" },
  Chronograph: { bg: "#1a191b", case: "#8d9294", dial: "#23272a", strap: "#111317", detail: "#d66b7e" },
  GMT: { bg: "#131c24", case: "#7895a6", dial: "#17242b", strap: "#121c23", detail: "#d5b26a" },
  Daily: { bg: "#17191d", case: "#7c838a", dial: "#20252a", strap: "#26221f", detail: "#7fb4cb" }
};

const sampleWatches = [
  {
    id: "seed-001",
    brand: "Nomos",
    model: "Tangente 38",
    category: "Dress",
    status: "wishlist",
    price: 2440,
    sourceUrl: "https://example-watch-shop.com/nomos-tangente-38",
    imageUrl: "",
    notes: "Clean hand-wound dress option for formal wear.",
    createdAt: "2026-05-03T09:00:00.000Z"
  },
  {
    id: "seed-002",
    brand: "Seiko",
    model: "SPB143 Diver",
    category: "Diver",
    status: "owned",
    price: 980,
    sourceUrl: "https://example-watch-shop.com/seiko-spb143-diver",
    imageUrl: "",
    notes: "Daily-ready diver with a steel bracelet.",
    createdAt: "2026-04-16T09:00:00.000Z"
  },
  {
    id: "seed-003",
    brand: "Hamilton",
    model: "Khaki Field Mechanical",
    category: "Field",
    status: "owned",
    price: 595,
    sourceUrl: "https://example-watch-shop.com/hamilton-khaki-field-mechanical",
    imageUrl: "",
    notes: "Simple field watch that covers casual weekends.",
    createdAt: "2026-03-02T09:00:00.000Z"
  },
  {
    id: "seed-004",
    brand: "Tissot",
    model: "PRX Chronograph",
    category: "Chronograph",
    status: "wishlist",
    price: 1995,
    sourceUrl: "https://example-watch-shop.com/tissot-prx-chronograph",
    imageUrl: "",
    notes: "Integrated-bracelet chrono candidate.",
    createdAt: "2026-05-22T09:00:00.000Z"
  },
  {
    id: "seed-005",
    brand: "Baltic",
    model: "Aquascaphe GMT",
    category: "GMT",
    status: "wishlist",
    price: 1200,
    sourceUrl: "https://example-watch-shop.com/baltic-aquascaphe-gmt",
    imageUrl: "",
    notes: "Travel watch option with color and restraint.",
    createdAt: "2026-05-24T09:00:00.000Z"
  },
  {
    id: "seed-006",
    brand: "Christopher Ward",
    model: "C63 Sealander",
    category: "Daily",
    status: "owned",
    price: 995,
    sourceUrl: "https://example-watch-shop.com/christopher-ward-c63-sealander",
    imageUrl: "",
    notes: "Comfortable everyday three-hander.",
    createdAt: "2026-02-12T09:00:00.000Z"
  }
];

const app = document.querySelector("#app");

let state = loadState();

function loadState() {
  const fallbackWatches = sampleWatches.map((watch, index) => ({
    ...watch,
    imageUrl: makeWatchImage(watch.category, index)
  }));

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.watches)) {
      return {
        watches: saved.watches.map((watch, index) => ({
          ...watch,
          imageUrl: watch.imageUrl || makeWatchImage(watch.category, index)
        })),
        filters: {
          tab: saved.filters?.tab || "all",
          category: saved.filters?.category || "all",
          query: saved.filters?.query || ""
        },
        drawer: { open: false, editingId: null },
        budget: Number(saved.budget) || 6000,
        toast: ""
      };
    }
  } catch (error) {
    console.warn("Could not load Watchlist Cabinet state", error);
  }

  return {
    watches: fallbackWatches,
    filters: { tab: "all", category: "all", query: "" },
    drawer: { open: false, editingId: null },
    budget: 6000,
    toast: ""
  };
}

function persist() {
  const payload = {
    watches: state.watches,
    filters: state.filters,
    budget: state.budget
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function render() {
  const filtered = getFilteredWatches();
  const summary = getSummary();

  app.innerHTML = `
    <div class="app-shell">
      <main class="workspace">
        ${renderMobileHeader()}
        ${renderTopbar()}
        ${renderMobileSummary(summary)}
        ${renderControls()}
        <div class="content-grid">
          ${renderBoard(filtered)}
          ${renderCalculator(summary)}
        </div>
      </main>
      ${state.drawer.open ? renderDrawer() : ""}
      ${state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;

  bindImageFallbacks();
}

function renderMobileHeader() {
  return `
    <header class="mobile-appbar" aria-label="Mobile app header">
      <div class="mobile-brand">
        <div class="brand-mark" aria-hidden="true">${icon("watch", 19)}</div>
        <div>
          <p class="mobile-brand-title">Cabinet</p>
          <p class="mobile-brand-note">Personal watch list</p>
        </div>
      </div>
      <button class="button button-primary mobile-add-button" type="button" data-action="open-add">
        ${icon("plus", 17)}
        <span>Add</span>
      </button>
    </header>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div>
        <h2 class="page-title">Collector board</h2>
        <p class="page-note">Save watches from any shop page, track what you own, and price the wishlist before the next purchase.</p>
      </div>
      <div class="topbar-controls">
        <label class="search-box">
          <span class="sr-only">Search watches</span>
          ${icon("search", 18)}
          <input id="searchInput" type="search" value="${escapeAttr(state.filters.query)}" placeholder="Search watches" autocomplete="off" />
        </label>
        <button class="button button-primary" type="button" data-action="open-add">
          ${icon("plus", 18)}
          <span>Add watch</span>
        </button>
      </div>
    </header>
  `;
}

function renderMobileSummary(summary) {
  const budgetLabel = summary.budgetDelta >= 0
    ? `${formatCurrency(summary.budgetDelta)} left`
    : `${formatCurrency(Math.abs(summary.budgetDelta))} to go`;

  return `
    <section class="mobile-summary-card" aria-label="Cost summary">
      <div class="mobile-summary-grid">
        <div class="mobile-total-cell is-wishlist">
          <span>Wishlist total</span>
          <strong>${formatCurrency(summary.wishlistTotal)}</strong>
          <small>${formatWatchCount(summary.wishlistCount)}</small>
        </div>
        <div class="mobile-total-cell is-owned">
          <span>Owned value</span>
          <strong>${formatCurrency(summary.ownedValue)}</strong>
          <small>${formatWatchCount(summary.ownedCount)}</small>
        </div>
      </div>
      <div class="mobile-budget-row">
        <span>${icon("calculator", 17)} Budget gap</span>
        <strong>${budgetLabel}</strong>
      </div>
    </section>
  `;
}

function renderControls() {
  const tabOptions = [
    { id: "all", label: "All" },
    { id: "owned", label: "Owned" },
    { id: "wishlist", label: "Wishlist" }
  ];

  return `
    <section class="controls-band" aria-label="Collection filters">
      <div class="tabs" role="tablist" aria-label="Status">
        ${tabOptions.map((tab) => `
          <button class="tab ${state.filters.tab === tab.id ? "is-active" : ""}" type="button" data-action="tab" data-tab="${tab.id}">
            ${tab.label}
          </button>
        `).join("")}
      </div>
      <div class="chip-row" aria-label="Category filters">
        <button class="chip ${state.filters.category === "all" ? "is-active" : ""}" type="button" data-action="category" data-category="all">All categories</button>
        ${categories.map((category) => `
          <button class="chip ${state.filters.category === category.name ? "is-active" : ""}" type="button" data-action="category" data-category="${category.name}">
            ${category.name}
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderBoard(watches) {
  const title = state.filters.tab === "wishlist"
    ? "Wishlist"
    : state.filters.tab === "owned"
      ? "Owned watches"
      : "All watches";

  return `
    <section class="board" aria-label="Watch collection">
      <div class="board-header">
        <div>
          <h2 class="section-title">${title}</h2>
          <p class="section-meta">${formatWatchCount(watches.length)} saved</p>
        </div>
      </div>
      ${watches.length ? `
        <div class="watch-table" role="table" aria-label="Watches">
          <div class="watch-table-head" role="row">
            <span>Watch</span>
            <span>Status</span>
            <span>Price</span>
            <span>Actions</span>
          </div>
          <div class="watch-table-body">
            ${watches.map(renderWatchRow).join("")}
          </div>
        </div>
      ` : renderEmptyState()}
    </section>
  `;
}

function renderWatchRow(watch) {
  const statusLabel = watch.status === "owned" ? "Owned" : "Wishlist";
  const nextStatusLabel = watch.status === "owned" ? "Move to wishlist" : "Mark owned";
  const sourceDomain = getDomain(watch.sourceUrl);

  return `
    <article class="watch-row" role="row">
      <div class="watch-identity" role="cell">
        <div class="row-thumb">
        <img class="watch-image" src="${escapeAttr(watch.imageUrl || makeWatchImage(watch.category, watch.id.length))}" alt="${escapeAttr(`${watch.brand} ${watch.model}`)}" data-category="${escapeAttr(watch.category)}" />
        </div>
        <div>
          <div class="watch-kicker">${escapeHtml(watch.brand)}</div>
          <h3 class="watch-name">${escapeHtml(watch.model)}</h3>
          <div class="row-meta">
            <span class="category-label">${escapeHtml(watch.category)}</span>
            <a class="source-link" href="${escapeAttr(normalizeUrl(watch.sourceUrl))}" target="_blank" rel="noreferrer">
              ${icon("link", 13)}
              <span>${escapeHtml(sourceDomain)}</span>
            </a>
          </div>
          <p class="watch-notes">${escapeHtml(watch.notes || "No notes yet.")}</p>
        </div>
      </div>
      <div class="status-badge is-${watch.status}" role="cell">
        ${icon(watch.status === "owned" ? "check" : "clock", 13)}
        ${statusLabel}
      </div>
      <div class="price" role="cell">${formatCurrency(watch.price)}</div>
      <div class="watch-actions" role="cell">
          <button class="button" type="button" data-action="toggle-status" data-id="${watch.id}" title="${nextStatusLabel}">
            ${icon(watch.status === "owned" ? "heart" : "check", 15)}
            <span>${watch.status === "owned" ? "Wishlist" : "Owned"}</span>
          </button>
          <div class="action-group">
            <button class="button button-icon" type="button" data-action="edit" data-id="${watch.id}" title="Edit watch" aria-label="Edit watch">
              ${icon("edit", 16)}
            </button>
            <button class="button button-icon button-danger" type="button" data-action="delete" data-id="${watch.id}" title="Delete watch" aria-label="Delete watch">
              ${icon("trash", 16)}
            </button>
          </div>
      </div>
    </article>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div>
        ${icon("watch", 44)}
        <h2>No watches match this view</h2>
        <p>Add a watch or loosen the filters to rebuild the cabinet view.</p>
      </div>
    </div>
  `;
}

function renderCalculator(summary) {
  const needed = summary.categoryStats
    .filter((item) => item.owned < item.target)
    .sort((a, b) => (b.target - b.owned) - (a.target - a.owned) || b.wishlistCount - a.wishlistCount);

  return `
    <aside class="calculator" aria-label="Wishlist price calculator">
      <div class="calculator-header">
        <div>
          <h2 class="section-title">Costs</h2>
          <p class="section-meta">Budget and category gaps</p>
        </div>
        ${icon("calculator", 22)}
      </div>
      <div class="calculator-body">
        <div class="total-panel">
          <div class="total-label">Wishlist total</div>
          <div class="total-value">${formatCurrency(summary.wishlistTotal)}</div>
          <p class="total-caption">${formatWatchCount(summary.wishlistCount)} on the wishlist</p>
        </div>
        <div class="budget-control">
          <label for="budgetInput">Budget</label>
          <input id="budgetInput" type="number" min="0" step="50" value="${state.budget}" inputmode="decimal" />
        </div>
        <div class="delta">
          ${summary.budgetDelta >= 0
            ? `<strong>${formatCurrency(summary.budgetDelta)}</strong> left if you bought the wishlist.`
            : `<strong>${formatCurrency(Math.abs(summary.budgetDelta))}</strong> above the current budget.`}
        </div>
        <div>
          <h3 class="section-title">Category gaps</h3>
          <div class="needs-list">
            ${needed.length ? needed.map((item) => `
              <div class="need-item">
                <div class="need-title">
                  <span>${item.name}</span>
                  <span>${item.owned}/${item.target}</span>
                </div>
                <div class="need-text">${renderNeedText(item)}</div>
              </div>
            `).join("") : `
              <div class="need-item">
                <div class="need-title"><span>Balanced</span><span>${categories.length}/${categories.length}</span></div>
                <div class="need-text">Every target category has at least one owned watch.</div>
              </div>
            `}
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderNeedText(item) {
  if (item.wishlistCount) {
    return `${formatWatchCount(item.wishlistCount)} on the wishlist - lowest ${formatCurrency(item.lowestWishlist || 0)}`;
  }

  return `No wishlist candidate yet - add a ${item.name.toLowerCase()} watch.`;
}

function renderDrawer() {
  const editing = state.drawer.editingId ? state.watches.find((watch) => watch.id === state.drawer.editingId) : null;
  const watch = editing || {
    brand: "",
    model: "",
    category: state.filters.category === "all" ? "Dress" : state.filters.category,
    status: state.filters.tab === "owned" ? "owned" : "wishlist",
    price: "",
    sourceUrl: "",
    imageUrl: "",
    notes: ""
  };

  return `
    <div class="drawer-backdrop" data-action="close-drawer">
      <form class="drawer" id="watchForm" aria-label="${editing ? "Edit watch" : "Add watch"}">
        <div class="drawer-header">
          <h2 class="drawer-title">${editing ? "Edit watch" : "Add watch"}</h2>
          <button class="button button-icon" type="button" data-action="close-drawer" aria-label="Close drawer">
            ${icon("x", 18)}
          </button>
        </div>
        <div class="drawer-body">
          <div class="field is-wide">
            <label for="sourceUrl">Watch page URL</label>
            <input id="sourceUrl" name="sourceUrl" type="url" value="${escapeAttr(watch.sourceUrl)}" placeholder="https://shop.example.com/watch-page" required />
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="brand">Brand</label>
              <input id="brand" name="brand" value="${escapeAttr(watch.brand)}" placeholder="Omega" required />
            </div>
            <div class="field">
              <label for="model">Model</label>
              <input id="model" name="model" value="${escapeAttr(watch.model)}" placeholder="Speedmaster" required />
            </div>
            <div class="field">
              <label for="category">Category</label>
              <select id="category" name="category">
                ${categories.map((category) => `<option value="${category.name}" ${watch.category === category.name ? "selected" : ""}>${category.name}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="status">Status</label>
              <select id="status" name="status">
                <option value="wishlist" ${watch.status === "wishlist" ? "selected" : ""}>Wishlist</option>
                <option value="owned" ${watch.status === "owned" ? "selected" : ""}>Owned</option>
              </select>
            </div>
            <div class="field">
              <label for="price">Price</label>
              <input id="price" name="price" type="number" min="0" step="1" value="${escapeAttr(String(watch.price ?? ""))}" placeholder="2500" inputmode="decimal" required />
            </div>
            <div class="field is-wide">
              <label for="imageUrl">Photo URL</label>
              <input id="imageUrl" name="imageUrl" type="url" value="${escapeAttr(watch.imageUrl && !watch.imageUrl.startsWith("data:") ? watch.imageUrl : "")}" placeholder="https://image.example.com/watch.jpg" />
            </div>
            <div class="field is-wide">
              <label for="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Why this watch belongs in the cabinet">${escapeHtml(watch.notes || "")}</textarea>
            </div>
          </div>
        </div>
        <div class="drawer-footer">
          <button class="button" type="button" data-action="close-drawer">Cancel</button>
          <button class="button button-primary" type="submit">${icon("save", 16)}<span>${editing ? "Save changes" : "Add watch"}</span></button>
        </div>
      </form>
    </div>
  `;
}

function getSummary() {
  const owned = state.watches.filter((watch) => watch.status === "owned");
  const wishlist = state.watches.filter((watch) => watch.status === "wishlist");
  const wishlistTotal = sum(wishlist.map((watch) => Number(watch.price) || 0));
  const ownedValue = sum(owned.map((watch) => Number(watch.price) || 0));

  const categoryStats = categories.map((category) => {
    const categoryOwned = owned.filter((watch) => watch.category === category.name);
    const categoryWishlist = wishlist.filter((watch) => watch.category === category.name);
    const wishlistPrices = categoryWishlist.map((watch) => Number(watch.price) || 0).filter(Boolean);

    return {
      name: category.name,
      target: category.target,
      owned: categoryOwned.length,
      wishlistCount: categoryWishlist.length,
      wishlistTotal: sum(categoryWishlist.map((watch) => Number(watch.price) || 0)),
      lowestWishlist: wishlistPrices.length ? Math.min(...wishlistPrices) : 0
    };
  });

  return {
    ownedCount: owned.length,
    wishlistCount: wishlist.length,
    wishlistTotal,
    ownedValue,
    budgetDelta: state.budget - wishlistTotal,
    categoryStats
  };
}

function getFilteredWatches() {
  const query = state.filters.query.trim().toLowerCase();

  return [...state.watches]
    .filter((watch) => state.filters.tab === "all" || watch.status === state.filters.tab)
    .filter((watch) => state.filters.category === "all" || watch.category === state.filters.category)
    .filter((watch) => {
      if (!query) return true;
      const haystack = [
        watch.brand,
        watch.model,
        watch.category,
        watch.status,
        watch.notes,
        getDomain(watch.sourceUrl)
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function handleClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;

  const action = trigger.dataset.action;

  if (action === "close-drawer" && trigger.classList.contains("drawer-backdrop") && event.target !== trigger) {
    return;
  }

  if (action !== "close-drawer") {
    event.stopPropagation();
  }

  if (action === "open-add") openDrawer();
  if (action === "close-drawer") closeDrawer();
  if (action === "tab") setTab(trigger.dataset.tab);
  if (action === "category") setCategory(trigger.dataset.category);
  if (action === "edit") editWatch(trigger.dataset.id);
  if (action === "delete") deleteWatch(trigger.dataset.id);
  if (action === "toggle-status") toggleStatus(trigger.dataset.id);
}

function handleInput(event) {
  if (event.target.id === "searchInput") {
    state.filters.query = event.target.value;
    persist();
    render();
  }

  if (event.target.id === "budgetInput") {
    state.budget = Number(event.target.value) || 0;
    persist();
    render();
  }
}

function handleSubmit(event) {
  if (event.target.id !== "watchForm") return;
  event.preventDefault();

  const form = new FormData(event.target);
  const editingId = state.drawer.editingId;
  const category = form.get("category");
  const existing = editingId ? state.watches.find((watch) => watch.id === editingId) : null;
  const imageUrl = String(form.get("imageUrl") || "").trim();

  const watch = {
    id: editingId || createId(),
    brand: cleanText(form.get("brand")),
    model: cleanText(form.get("model")),
    category,
    status: form.get("status"),
    price: Number(form.get("price")) || 0,
    sourceUrl: normalizeUrl(form.get("sourceUrl")),
    imageUrl: imageUrl || existing?.imageUrl || makeWatchImage(category, state.watches.length + 1),
    notes: cleanText(form.get("notes")),
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  if (!watch.brand || !watch.model || !watch.sourceUrl) {
    showToast("Brand, model, and URL are required.");
    return;
  }

  if (editingId) {
    state.watches = state.watches.map((item) => item.id === editingId ? watch : item);
    showToast("Watch updated.");
  } else {
    state.watches = [watch, ...state.watches];
    showToast("Watch added.");
  }

  state.drawer = { open: false, editingId: null };
  persist();
  render();
}

function openDrawer(editingId = null) {
  state.drawer = { open: true, editingId };
  render();
  setTimeout(() => document.querySelector("#sourceUrl, #brand")?.focus(), 0);
}

function closeDrawer() {
  state.drawer = { open: false, editingId: null };
  render();
}

function setTab(tab) {
  state.filters.tab = tab;
  persist();
  render();
}

function setCategory(category) {
  state.filters.category = category;
  persist();
  render();
}

function editWatch(id) {
  openDrawer(id);
}

function deleteWatch(id) {
  const watch = state.watches.find((item) => item.id === id);
  if (!watch) return;
  const confirmed = window.confirm(`Delete ${watch.brand} ${watch.model}?`);
  if (!confirmed) return;

  state.watches = state.watches.filter((item) => item.id !== id);
  showToast("Watch deleted.");
  persist();
  render();
}

function toggleStatus(id) {
  state.watches = state.watches.map((watch) => {
    if (watch.id !== id) return watch;
    return { ...watch, status: watch.status === "owned" ? "wishlist" : "owned" };
  });
  persist();
  render();
}

function showToast(message) {
  state.toast = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2200);
}

function bindImageFallbacks() {
  document.querySelectorAll("img.watch-image").forEach((image, index) => {
    image.addEventListener("error", () => {
      image.src = makeWatchImage(image.dataset.category || "Daily", index);
    }, { once: true });
  });
}

function makeWatchImage(category, seed = 0) {
  const theme = categoryThemes[category] || categoryThemes.Daily;
  const rotation = (Number(seed) || String(seed).length) % 12;
  const accentX = 58 + rotation;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 360" role="img" aria-label="${category} watch illustration">
      <rect width="520" height="360" fill="${theme.bg}"/>
      <path d="M0 304 C105 254 174 313 277 271 C380 229 433 252 520 211 L520 360 L0 360 Z" fill="#f5f1ea" opacity="0.08"/>
      <g transform="translate(260 180)">
        <rect x="-46" y="-160" width="92" height="112" rx="22" fill="${theme.strap}"/>
        <rect x="-44" y="48" width="88" height="132" rx="22" fill="${theme.strap}"/>
        <rect x="-77" y="-76" width="154" height="154" rx="77" fill="${theme.case}"/>
        <rect x="-63" y="-62" width="126" height="126" rx="63" fill="${theme.dial}"/>
        <circle cx="0" cy="0" r="5" fill="${theme.detail}"/>
        <g stroke="${theme.detail}" stroke-width="5" stroke-linecap="round">
          <line x1="0" y1="0" x2="${accentX - 58}" y2="-42"/>
          <line x1="0" y1="0" x2="37" y2="${10 + rotation}"/>
        </g>
        <g stroke="${theme.detail}" stroke-width="3" stroke-linecap="round">
          <line x1="0" y1="-50" x2="0" y2="-42"/>
          <line x1="50" y1="0" x2="42" y2="0"/>
          <line x1="0" y1="50" x2="0" y2="42"/>
          <line x1="-50" y1="0" x2="-42" y2="0"/>
        </g>
        <circle cx="-25" cy="16" r="${category === "Chronograph" ? "13" : "0"}" fill="none" stroke="${theme.detail}" stroke-width="3"/>
        <circle cx="25" cy="16" r="${category === "Chronograph" ? "13" : "0"}" fill="none" stroke="${theme.detail}" stroke-width="3"/>
        <rect x="-14" y="-96" width="28" height="20" rx="7" fill="${theme.case}"/>
        <rect x="-14" y="76" width="28" height="20" rx="7" fill="${theme.case}"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function icon(name, size = 18) {
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const icons = {
    watch: `<svg ${common}><circle cx="12" cy="12" r="6"/><path d="M9 2h6"/><path d="M9 22h6"/><path d="M10 2l-1 4"/><path d="M14 2l1 4"/><path d="M10 22l-1-4"/><path d="M14 22l1-4"/><path d="M12 9v3l2 2"/></svg>`,
    heart: `<svg ${common}><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6z"/></svg>`,
    calculator: `<svg ${common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15h.01"/></svg>`,
    search: `<svg ${common}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
    plus: `<svg ${common}><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
    check: `<svg ${common}><path d="M20 6 9 17l-5-5"/></svg>`,
    clock: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    link: `<svg ${common}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>`,
    edit: `<svg ${common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
    trash: `<svg ${common}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>`,
    x: `<svg ${common}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    save: `<svg ${common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>`
  };
  return icons[name] || "";
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatWatchCount(value) {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? "watch" : "watches"}`;
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function getDomain(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return "source link";
  }
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `watch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("submit", handleSubmit);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.drawer.open) {
    closeDrawer();
  }
});

render();
