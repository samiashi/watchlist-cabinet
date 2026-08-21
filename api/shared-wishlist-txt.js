import { getRequestBaseUrl, renderSharedWishlistText, respondWithSharedWishlist } from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  await respondWithSharedWishlist(request, response, "json", (data) => {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.status(200).send(renderSharedWishlistText(data, getRequestBaseUrl(request)));
  });
}
