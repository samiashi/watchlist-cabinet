import { getRequestBaseUrl, renderSharedWishlistHtml, respondWithSharedWishlist } from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  await respondWithSharedWishlist(request, response, "html", (data) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(200).send(renderSharedWishlistHtml(data, getRequestBaseUrl(request)));
  });
}
