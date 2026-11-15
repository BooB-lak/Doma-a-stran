(() => {
  const maxClockSkew = 5 * 60 * 1000;

  function publicationDate(value) {
    // Bild uporablja oznaki, ki ju Date.parse v Node in Chromiumu ne pozna.
    const normalized = String(value || "").replace(/\s+(CEST|CET)$/i, (_, zone) =>
      zone.toUpperCase() === "CEST" ? " +0200" : " +0100");
    const timestamp = Date.parse(normalized);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function newest(items, now = Date.now(), count = 6) {
    const sorted = items.filter(item => typeof item?.title === "string" && item.title.trim() &&
      typeof item.link === "string" && item.link &&
      Number.isFinite(item.date) && item.date > 0 && item.date <= now + maxClockSkew)
      .sort((a, b) => b.date - a.date);
    const links = new Set();
    const titles = new Set();
    const result = [];
    for (const item of sorted) {
      const title = item.title.trim().toLowerCase();
      if (links.has(item.link) || titles.has(title)) continue;
      links.add(item.link);
      titles.add(title);
      result.push(item);
      if (result.length >= count) break;
    }
    return result;
  }

  const hopPostsUrl = "https://hop.si/wp-json/wp/v2/posts?per_page=12&orderby=date&order=desc&_embed=wp%3Afeaturedmedia&_fields=title,link,date_gmt,_links,_embedded";

  function parseHopPosts(posts, decodeTitle) {
    if (!Array.isArray(posts)) return [];
    return posts.map(post => {
      const media = post?._embedded?.["wp:featuredmedia"]?.[0];
      const sizes = media?.media_details?.sizes;
      return {
        title: decodeTitle(post?.title?.rendered || "").trim(),
        link: post?.link || "",
        image: sizes?.medium_large?.source_url || sizes?.large?.source_url || media?.source_url || "",
        date: publicationDate(post?.date_gmt ? post.date_gmt + "Z" : "")
      };
    });
  }

  const news = { publicationDate, newest, hopPostsUrl, parseHopPosts };
  if (typeof module === "object" && module.exports) module.exports = news;
  else globalThis.newsFreshness = news;
})();
