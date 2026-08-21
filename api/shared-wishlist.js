import { respondWithSharedWishlist } from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  await respondWithSharedWishlist(request, response, "json", (data) => {
    response.status(200).json(data);
  });
}
