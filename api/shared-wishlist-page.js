import {
  escapeHtml,
  formatCurrency,
  formatWatchCount,
  getDomain,
  getRequestBaseUrl,
  loadSharedWishlist,
  sendSharedWishlistError
} from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("X-Robots-Tag", "noindex, follow");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).send(renderMethodNotAllowedHtml());
    return;
  }

  try {
    const data = await loadSharedWishlist(request.query?.token);
    response.status(200).send(renderSharedWishlistHtml(data, getRequestBaseUrl(request)));
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
  const jsonLd = renderJsonLd(data, shareUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="#050506">
    <meta name="robots" content="noindex, follow">
    <title>Watch Wishlist - Cabinet</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Watch Wishlist - Cabinet">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(shareUrl)}">
    ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ""}
    <link rel="alternate" type="text/markdown" href="${escapeHtml(markdownUrl)}">
    <link rel="alternate" type="application/json" href="${escapeHtml(jsonUrl)}">
    <script type="application/ld+json">${jsonLd}</script>
    <style>
      :root {
        color-scheme: dark;
        --bg: #050506;
        --panel: #1c1c1e;
        --panel-soft: #232326;
        --text: #f5f5f7;
        --muted: #a1a1aa;
        --line: rgba(255, 255, 255, .13);
        --blue: #5ab8ff;
        --green: #74e06d;
        --pink: #ff75aa;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
        margin: 0;
        background:
          radial-gradient(circle at 80% 0%, rgba(0, 122, 255, .16), transparent 28rem),
          radial-gradient(circle at 12% 8%, rgba(255, 117, 170, .10), transparent 24rem),
          var(--bg);
      }

      main {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 40px 0 56px;
      }

      header {
        display: grid;
        gap: 24px;
        margin-bottom: 28px;
      }

      .eyebrow,
      .brand,
      .meta,
      dt {
        color: var(--muted);
      }

      .eyebrow {
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: clamp(44px, 9vw, 88px);
        line-height: .95;
      }

      .summary {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--line);
        box-shadow: 0 24px 80px rgba(0, 0, 0, .32);
      }

      .summary-item {
        padding: 24px;
        background: rgba(28, 28, 30, .88);
      }

      .summary-item span {
        display: block;
        color: var(--muted);
        font-size: 15px;
        font-weight: 800;
        margin-bottom: 10px;
      }

      .summary-item strong {
        display: block;
        color: var(--pink);
        font-size: clamp(30px, 6vw, 52px);
        line-height: 1;
      }

      .summary-item:last-child strong {
        color: var(--green);
      }

      .alternate-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      a {
        color: inherit;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        min-height: 36px;
        padding: 8px 14px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, .07);
        color: var(--text);
        font-weight: 800;
        text-decoration: none;
      }

      .watch-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
        padding: 0;
        margin: 0;
        list-style: none;
      }

      .watch-card {
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(35, 35, 38, .94), rgba(16, 17, 20, .96));
        box-shadow: 0 24px 70px rgba(0, 0, 0, .28);
      }

      .watch-card img {
        display: block;
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: contain;
        background: #fff;
      }

      .watch-body {
        display: grid;
        gap: 16px;
        padding: 20px;
      }

      .brand {
        margin: 0 0 5px;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      h2 {
        margin: 0;
        font-size: 27px;
        line-height: 1.04;
      }

      .price {
        margin: 0;
        color: #fff;
        font-size: 26px;
        font-weight: 900;
      }

      dl {
        display: grid;
        grid-template-columns: minmax(90px, max-content) 1fr;
        gap: 8px 12px;
        margin: 0;
      }

      dt,
      dd {
        margin: 0;
        font-size: 15px;
        line-height: 1.35;
      }

      dt {
        font-weight: 800;
      }

      dd {
        color: var(--text);
        overflow-wrap: anywhere;
      }

      .source-link {
        color: var(--blue);
        font-weight: 800;
      }

      .empty {
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 28px;
        background: var(--panel);
        color: var(--muted);
      }

      @media (max-width: 640px) {
        main {
          width: min(100% - 28px, 520px);
          padding: 28px 0 44px;
        }

        .summary {
          grid-template-columns: 1fr;
        }

        .watch-list {
          grid-template-columns: 1fr;
        }
      }
    </style>
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
      ${data.watches.length ? `<ol class="watch-list">${data.watches.map(renderWatchCard).join("")}</ol>` : renderEmptyState()}
    </main>
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
    ${image}
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
        image: watch.image_urls.length ? watch.image_urls : undefined,
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

function renderEmptyState() {
  return `<section class="empty"><h2>No wishlist watches yet</h2><p>This shared Cabinet wishlist is currently empty.</p></section>`;
}

function renderMethodNotAllowedHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Method not allowed</title></head><body><h1>Method not allowed</h1></body></html>`;
}
