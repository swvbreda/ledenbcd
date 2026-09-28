/** Metadata for the first HTML response. Protected pages deliberately use the public login image. */
const ORIGIN = "https://leden.coffeeshopbond.nl";

export function socialHead({ title, description, path, image = "/social/login.jpg", type = "website" }: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: string;
}) {
  const url = `${ORIGIN}${path}`;
  const imageUrl = `${ORIGIN}${image}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: type },
      { property: "og:site_name", content: "BCD Ledenportaal" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: imageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
