import {
  escapeHtml,
  formatCurrency,
  formatWatchCount,
  getDomain,
  getRequestBaseUrl,
  loadSharedWishlist,
  renderCompactWishlistText,
  renderSharedWishlistMarkdown,
  sendSharedWishlistError
} from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(405).send(renderMethodNotAllowedHtml());
    return;
  }

  try {
    const data = await loadSharedWishlist(request.query?.token);
    const baseUrl = getRequestBaseUrl(request);

    if (prefersMarkdown(request)) {
      response.setHeader("Content-Type", "text/markdown; charset=utf-8");
      response.status(200).send(renderSharedWishlistMarkdown(data, baseUrl));
      return;
    }

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(200).send(renderSharedWishlistHtml(data, baseUrl));
  } catch (error) {
    sendSharedWishlistError(response, error, "html");
  }
}

function renderSharedWishlistHtml(data, baseUrl) {
  const shareUrl = `${baseUrl}/share/${encodeURIComponent(data.token)}`;
  const markdownUrl = `${shareUrl}.md`;
  const jsonUrl = `${shareUrl}.json`;
  const total = formatCurrency(data.summary.wishlist_total);
  const count = formatWatchCount(data.summary.count);
  const description = `${count} on Sami's watch wishlist, totaling ${total}.`;
  const imageUrl = data.watches.find((watch) => watch.image_url)?.image_url || "";
  const textSummary = renderCompactWishlistText(data);
  const jsonLd = renderJsonLd(data, shareUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="#050506">
    <title>Watch Wishlist - Cabinet</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Watch Wishlist - Cabinet">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(shareUrl)}">
    ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ""}
    <link rel="canonical" href="${escapeHtml(shareUrl)}">
    <link rel="alternate" type="text/markdown" href="${escapeHtml(markdownUrl)}">
    <link rel="alternate" type="application/json" href="${escapeHtml(jsonUrl)}">
    <link rel="stylesheet" href="/share.css">
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="eyebrow">Shared from Cabinet</p>
          <h1>Watch Wishlist</h1>
          <div class="alternate-links" aria-label="Alternate formats">
            <a class="pill" href="${escapeHtml(markdownUrl)}">Markdown</a>
            <a class="pill" href="${escapeHtml(jsonUrl)}">JSON</a>
          </div>
        </div>
        <section class="summary" aria-label="Wishlist summary">
          <div class="summary-item">
            <span>Wishlist total</span>
            <strong>${escapeHtml(total)}</strong>
          </div>
          <div class="summary-item">
            <span>Saved watches</span>
            <strong>${escapeHtml(count)}</strong>
          </div>
        </section>
      </header>

      <section class="agent-summary" aria-label="Readable wishlist summary">
        <h2>Readable Summary</h2>
        <pre>${escapeHtml(textSummary)}</pre>
      </section>

      ${data.watches.length ? `<ol class="watch-list">${data.watches.map(renderWatchCard).join("")}</ol>` : renderEmptyState()}
    </main>
    <script type="application/ld+json">${jsonLd}</script>
  </body>
</html>`;
}

function renderWatchCard(watch) {
  const title = `${watch.brand} ${watch.model}`.trim();
  const image = watch.image_url
    ? `<img src="${escapeHtml(watch.image_url)}" alt="${escapeHtml(title)}" loading="lazy">`
    : "";
  const source = watch.source_url
    ? `<a class="source-link" href="${escapeHtml(watch.source_url)}" rel="noopener noreferrer">${escapeHtml(getDomain(watch.source_url))}</a>`
    : "Not listed";

  return `<li class="watch-card">
    <div class="watch-body">
      <div>
        <p class="brand">${escapeHtml(watch.brand || "Unknown brand")}</p>
        <h2>${escapeHtml(watch.model || "Untitled watch")}</h2>
      </div>
      <p class="price">${escapeHtml(formatCurrency(watch.price))}</p>
      <dl>
        <dt>Category</dt><dd>${escapeHtml(watch.category || "Not listed")}</dd>
        <dt>Movement</dt><dd>${escapeHtml(watch.movement || "Not listed")}</dd>
        <dt>Case size</dt><dd>${watch.case_size_mm ? `${escapeHtml(watch.case_size_mm)} mm` : "Not listed"}</dd>
        ${watch.reference_number ? `<dt>Reference</dt><dd>${escapeHtml(watch.reference_number)}</dd>` : ""}
        <dt>Source</dt><dd>${source}</dd>
      </dl>
    </div>
    ${image}
  </li>`;
}

function renderJsonLd(data, shareUrl) {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Watch Wishlist",
    url: shareUrl,
    numberOfItems: data.watches.length,
    itemListElement: data.watches.map((watch, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: `${watch.brand} ${watch.model}`.trim(),
        brand: watch.brand ? { "@type": "Brand", name: watch.brand } : undefined,
        model: watch.model || undefined,
        sku: watch.reference_number || undefined,
        category: watch.category ? `${watch.category} watch` : "Watch",
        image: watch.image_url || undefined,
        offers: {
          "@type": "Offer",
          priceCurrency: "AED",
          price: watch.price,
          url: watch.source_url || shareUrl,
          availability: "https://schema.org/InStock"
        },
        additionalProperty: [
          watch.movement ? { "@type": "PropertyValue", name: "Movement", value: watch.movement } : null,
          watch.case_size_mm ? { "@type": "PropertyValue", name: "Case size", value: `${watch.case_size_mm} mm` } : null
        ].filter(Boolean)
      }
    }))
  };

  return JSON.stringify(itemList).replace(/</g, "\\u003c");
}

function prefersMarkdown(request) {
  const accept = String(request.headers.accept || "").toLowerCase();
  return accept.includes("text/markdown") || (accept.includes("text/plain") && !accept.includes("text/html"));
}

function renderEmptyState() {
  return `<section class="empty"><h2>No wishlist watches yet</h2><p>This shared Cabinet wishlist is currently empty.</p></section>`;
}

function renderMethodNotAllowedHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Method not allowed</title></head><body><h1>Method not allowed</h1></body></html>`;
}
