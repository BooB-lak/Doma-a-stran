#!/usr/bin/env node
/**
 * fetch-news.js
 *
 * Teče na GitHub Actions (ali kjerkoli z Node 18+).
 * Prebere vse RSS vire, poišče slike in zapiše news.json.
 *
 * Ključna prednost pred brskalnikom:
 *  - Tukaj NI CORS omejitev, zato lahko beremo vire neposredno.
 *  - Sledimo preusmeritvam (Google News -> pravi članek),
 *    zato dobimo og:image tudi za Reuters.
 *  - Vse to se zgodi VNAPREJ, zato je stran ob odprtju takoj polna.
 */

const fs = require("fs");
const path = require("path");

const COUNT = 6;
const OUT_FILE = process.env.NEWS_OUT || "news.json";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const SOURCES = [
  {
    id: "siol",
    name: "Siol.net",
    homepage: "https://siol.net/",
    feeds: ["https://siol.net/feeds/latest2"]
  },
  {
    id: "24ur",
    name: "24ur",
    homepage: "https://www.24ur.com/",
    feeds: ["https://www.24ur.com/rss"]
  },
  {
    id: "rtvslo",
    name: "RTV Slo",
    homepage: "https://www.rtvslo.si/",
    feeds: [
      "https://img.rtvslo.si/feeds/00.xml",
      "https://www.rtvslo.si/feeds/00.xml"
    ]
  },
  {
    id: "zurnal",
    name: "Žurnal",
    homepage: "https://www.zurnal24.si/",
    feeds: ["https://www.zurnal24.si/feeds/latest"]
  },
  {
    id: "reuters",
    name: "Reuters",
    homepage: "https://www.reuters.com/",
    feeds: [
      "https://reutersbest.com/topic/politics-general/feed/",
      "https://reutersbest.com/topic/business-finance/feed/",
      "https://news.google.com/rss/search?q=site%3Areuters.com%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
      "https://openrss.org/reuters.com/world"
    ]
  },
  {
    id: "cnn",
    name: "CNN",
    homepage: "https://edition.cnn.com/",
    feeds: [
      "http://rss.cnn.com/rss/edition.rss",
      "https://rss.cnn.com/rss/edition.rss",
      "https://news.google.com/rss/search?q=site%3Acnn.com%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen"
    ]
  },
  {
    id: "bbc",
    name: "BBC",
    homepage: "https://www.bbc.com/news",
    feeds: [
      "https://feeds.bbci.co.uk/news/rss.xml",
      "https://news.google.com/rss/search?q=site%3Abbc.com%2Fnews%20when%3A1d&hl=en-GB&gl=GB&ceid=GB%3Aen"
    ]
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    homepage: "https://www.aljazeera.com/",
    feeds: [
      "https://www.aljazeera.com/xml/rss/all.xml",
      "https://news.google.com/rss/search?q=site%3Aaljazeera.com%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen"
    ]
  }
];

/* ---------------- pomožne funkcije ---------------- */

function decodeEntities(s) {
  return String(s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function stripCdata(s) {
  return String(s || "")
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .trim();
}

function tagText(block, names) {
  for (const name of names) {
    const rx = new RegExp(
      "<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">",
      "i"
    );
    const m = block.match(rx);
    if (m) {
      const v = decodeEntities(stripCdata(m[1])).replace(/\s+/g, " ").trim();
      if (v) return v;
    }
  }
  return "";
}

function absoluteUrl(value, base) {
  if (!value) return "";
  try {
    const u = new URL(String(value).trim(), base || undefined);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (_) {}
  return "";
}

function looksLikeImage(u) {
  const s = String(u || "").toLowerCase();
  if (/\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(s)) return true;
  return /(image|images|img|photo|photos|thumb|thumbnail|cdn|ichef|media)/i.test(s);
}

async function get(url, timeoutMs = 20000, asText = true) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept:
          "application/rss+xml, application/xml, text/xml, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9,sl;q=0.8"
      }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return asText ? await res.text() : res;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- iskanje slik ---------------- */

function imageFromItemBlock(block, base) {
  // media:content / media:thumbnail / enclosure / image
  const attrRx =
    /<(?:media:)?(?:content|thumbnail|enclosure|image)\b[^>]*?\b(?:url|src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = attrRx.exec(block)) !== null) {
    const u = absoluteUrl(decodeEntities(m[1]), base);
    if (u && looksLikeImage(u)) return u;
  }

  // <image><url>...</url></image>
  const inner = block.match(/<image\b[^>]*>[\s\S]*?<url>([\s\S]*?)<\/url>/i);
  if (inner) {
    const u = absoluteUrl(decodeEntities(stripCdata(inner[1])), base);
    if (u) return u;
  }

  // <img src> znotraj description / content:encoded
  const html =
    tagText(block, ["content:encoded"]) ||
    tagText(block, ["description"]) ||
    tagText(block, ["summary"]);
  const img = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (img) {
    const u = absoluteUrl(img[1], base);
    if (u) return u;
  }

  return "";
}

function imageFromArticleHtml(html, base) {
  const patterns = [
    /<meta[^>]+property\s*=\s*["']og:image:secure_url["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image["']/i,
    /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+name\s*=\s*["']twitter:image["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']twitter:image["']/i,
    /<link[^>]+rel\s*=\s*["']image_src["'][^>]+href\s*=\s*["']([^"']+)["']/i
  ];
  for (const rx of patterns) {
    const m = html.match(rx);
    if (m) {
      const u = absoluteUrl(decodeEntities(m[1]), base);
      if (u) return u;
    }
  }
  return "";
}

/* ---------------- razčlenjevanje vira ---------------- */

function cleanTitle(title, sourceName) {
  let t = String(title || "").replace(/\s+/g, " ").trim();
  const names = [sourceName, "Reuters", "CNN", "BBC", "Al Jazeera"].filter(Boolean);
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp("\\s+[-–—]\\s*" + esc + "\\s*$", "i"), "").trim();
  }
  return t;
}

function parseFeed(xml, source) {
  let blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const isAtom = blocks.length === 0;
  if (isAtom) blocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];

  const items = [];
  const seen = new Set();

  for (const block of blocks) {
    let link = "";

    const hrefMatch = block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) link = decodeEntities(hrefMatch[1]);
    if (!link) link = tagText(block, ["link"]);
    if (!link) link = tagText(block, ["guid", "id"]);
    link = absoluteUrl(link, source.homepage);

    const title = cleanTitle(tagText(block, ["title"]), source.name);
    if (!title || !link) continue;

    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rawDate = tagText(block, ["pubDate", "published", "updated", "dc:date"]);
    const parsed = rawDate ? Date.parse(rawDate) : NaN;

    items.push({
      title,
      link,
      image: imageFromItemBlock(block, link),
      date: Number.isFinite(parsed) ? parsed : 0
    });
  }

  if (items.some(x => x.date > 0)) items.sort((a, b) => b.date - a.date);
  return items.slice(0, COUNT);
}

/* ---------------- glavni tok ---------------- */

async function loadSource(source) {
  let lastErr = null;

  for (const feed of source.feeds) {
    try {
      const xml = await get(feed);
      const items = parseFeed(xml, source);
      if (items.length) {
        console.log(`  ✓ ${source.name}: ${items.length} novic iz ${feed}`);
        return items;
      }
      console.log(`  · ${source.name}: ${feed} brez uporabnih novic`);
    } catch (err) {
      lastErr = err;
      console.log(`  · ${source.name}: ${feed} -> ${err.message}`);
    }
  }

  throw lastErr || new Error("ni novic");
}

async function enrichImages(source, items) {
  const missing = items.filter(x => !x.image);
  if (!missing.length) return;

  let i = 0;
  async function worker() {
    while (i < missing.length) {
      const item = missing[i++];
      try {
        // Sledi preusmeritvi (npr. news.google.com -> reuters.com)
        const html = await get(item.link, 18000);
        const img = imageFromArticleHtml(html, item.link);
        if (img) item.image = img;
      } catch (_) {}
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  const still = items.filter(x => !x.image).length;
  console.log(
    `    slike: ${items.length - still}/${items.length} razrešenih`
  );
}

/* Google News povezave razreši v pravi naslov članka. */
async function resolveGoogleLinks(items) {
  const google = items.filter(x => /news\.google\.com/i.test(x.link));
  if (!google.length) return;

  for (const item of google) {
    try {
      const res = await get(item.link, 18000, false);
      if (res.url && !/news\.google\.com/i.test(res.url)) {
        item.link = res.url;
      }
    } catch (_) {}
  }
}

async function main() {
  console.log("Zbiram novice ...\n");

  const out = {
    generatedAt: new Date().toISOString(),
    sources: {}
  };

  for (const source of SOURCES) {
    try {
      const items = await loadSource(source);
      await resolveGoogleLinks(items);
      await enrichImages(source, items);
      out.sources[source.id] = items;
    } catch (err) {
      console.log(`  ✗ ${source.name}: ${err.message}`);
      out.sources[source.id] = [];
    }
  }

  const target = path.resolve(process.cwd(), OUT_FILE);
  fs.writeFileSync(target, JSON.stringify(out, null, 1), "utf8");

  const total = Object.values(out.sources).reduce((a, b) => a + b.length, 0);
  const withImg = Object.values(out.sources)
    .flat()
    .filter(x => x.image).length;

  console.log(`\nZapisano: ${target}`);
  console.log(`Skupaj novic: ${total}, s sliko: ${withImg}`);
}

main().catch(err => {
  console.error("Napaka:", err);
  process.exit(1);
});
