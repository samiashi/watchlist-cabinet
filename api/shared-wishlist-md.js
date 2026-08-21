import { getRequestBaseUrl, renderSharedWishlistMarkdown, respondWithSharedWishlist } from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  await respondWithSharedWishlist(request, response, "json", (data) => {
    response.setHeader("Content-Type", "text/markdown; charset=utf-8");
    response.status(200).send(renderSharedWishlistMarkdown(data, getRequestBaseUrl(request)));
  });
}
