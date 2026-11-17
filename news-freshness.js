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

  const reutersSitemapUrl = 'https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml';
  const reutersFeedUrls = [
    'https://feed.quanwenrss.com/feed/reuters-latest.xml',
    'https://feed.quanwenrss.com/feed/reuters-world.xml',
    'https://feed.quanwenrss.com/feed/reuters-business.xml',
    'https://feed.quanwenrss.com/feed/reuters-technology.xml',
    'https://feed.quanwenrss.com/feed/reuters-markets.xml'
  ];

  function reutersArticleUrl(value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !['www.reuters.com', 'reuters.com'].includes(url.hostname)) return '';
      if (!/-\d{4}-\d{2}-\d{2}\/?$/.test(url.pathname)) return '';
      url.protocol = 'https:';
      url.hostname = 'www.reuters.com';
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname.replace(/\/?$/, '/');
      return url.href;
    } catch {
      return '';
    }
  }

  function reutersImageUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      const path = url.pathname.toLowerCase();
      if (/466bjjq7pvgy5o53nz3kl65mhm/.test(path)) return '';
      if (/(?:^|\/)(?:reuters[-_])?(?:logo|favicon|default|placeholder)[-_.\/]/.test(path)) return '';
      if (/(?:^|\/)reuters[-_]logo(?:[-_.\/]|$)/.test(path)) return '';
      if (url.hostname === 'news.google.com' || url.hostname.endsWith('.gstatic.com')) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function reutersItems(items) {
    const articles = items.flatMap(item => {
      const link = reutersArticleUrl(item?.link);
      return link ? [{ ...item, link, image: reutersImageUrl(item.image) }] : [];
    });
    const images = new Map();
    for (const item of articles) {
      if (item.image && !images.has(item.link)) images.set(item.link, item.image);
    }
    return articles.map(item => item.image ? item : { ...item, image: images.get(item.link) || '' });
  }

  function parseReutersSitemap(xml, decodeText) {
    const text = (block, name) => {
      const match = block.match(new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '\\s*>', 'i'));
      return match ? decodeText(match[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '')).trim() : '';
    };
    const items = [];
    for (const [, block] of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url\s*>/gi)) {
      const link = reutersArticleUrl(text(block, 'loc'));
      const title = text(block, 'news:title');
      const date = publicationDate(text(block, 'news:publication_date'));
      const image = reutersImageUrl(text(block, 'image:loc') || text(block, 'video:thumbnail_loc'));
      if (link && title && date) items.push({ title, link, image, date });
    }
    return items;
  }

  const news = { publicationDate, newest, hopPostsUrl, parseHopPosts, reutersSitemapUrl, reutersFeedUrls, reutersItems, reutersArticleUrl, reutersImageUrl, parseReutersSitemap };
  if (typeof module === "object" && module.exports) module.exports = news;
  else globalThis.newsFreshness = news;
})();
