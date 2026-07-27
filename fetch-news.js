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
    translate: true,
    feeds: [
      "https://reutersbest.com/topic/politics-general/feed/",
      "https://reutersbest.com/topic/business-finance/feed/",
      "https://news.google.com/rss/search?q=site%3Areuters.com%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
      "https://openrss.org/reuters.com/world"
    ]
  },
  {
    id: "nyt",
    name: "New York Times",
    homepage: "https://www.nytimes.com/",
    translate: true,
    lang: "EN",
    /*
      CNN je bil odstranjen: svojih RSS virov ne vzdrzuje vec,
      stari naslovi vracajo clanke izpred let, prek Google News
      pa ni mogoce priti do slik.
      NYT ima delujoc, aktivno vzdrzevan vir s slikami v RSS-u.

      Ce bi kdaj raje nemski Bild, zadostuje zamenjava tega bloka:
        id:"bild", name:"Bild", homepage:"https://www.bild.de/",
        translate:true, lang:"DE",
        feeds:["https://www.bild.de/feed/alles.xml"]
      Prevajanje samodejno upostevata polje "lang".
    */
    feeds: [
      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
    ]
  },
  {
    id: "bbc",
    name: "BBC",
    homepage: "https://www.bbc.com/news",
    translate: true,
    feeds: [
      "https://feeds.bbci.co.uk/news/rss.xml",
      "https://news.google.com/rss/search?q=site%3Abbc.com%2Fnews%20when%3A1d&hl=en-GB&gl=GB&ceid=GB%3Aen"
    ]
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    homepage: "https://www.aljazeera.com/",
    translate: true,
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

/*
  Slike, ki niso slika clanka, ampak logotip posrednika.
  Google News na svojih straneh ponuja og:image s svojim logotipom -
  brez tega filtra bi vsi clanki dobili isto Googlovo ikono.
  Vzorci so namenoma ozki: prejsnja razlicica je z "/default" in
  "/fallback" lahko zavrnila tudi povsem veljavne slike.
*/
function isRejectedImage(u) {
  const s = String(u || "").toLowerCase();
  return (
    /news\.google\.com/.test(s) ||
    /\bgstatic\.com/.test(s) ||
    /lh\d+\.googleusercontent\.com/.test(s) ||
    /google\.com\/(?:images|logos)\//.test(s) ||
    /\/(?:google-?news|gnews)[-_.]/.test(s)
  );
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
    if (u && looksLikeImage(u) && !isRejectedImage(u)) return u;
  }

  // <image><url>...</url></image>
  const inner = block.match(/<image\b[^>]*>[\s\S]*?<url>([\s\S]*?)<\/url>/i);
  if (inner) {
    const u = absoluteUrl(decodeEntities(stripCdata(inner[1])), base);
    if (u && !isRejectedImage(u)) return u;
  }

  // <img src> znotraj description / content:encoded
  const html =
    tagText(block, ["content:encoded"]) ||
    tagText(block, ["description"]) ||
    tagText(block, ["summary"]);
  const img = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (img) {
    const u = absoluteUrl(img[1], base);
    if (u && !isRejectedImage(u)) return u;
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
      if (u && !isRejectedImage(u)) return u;
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

    /*
      Google News ima obcasno vnos, katerega naslov je le ime vira.
      Po ciscenju ostane npr. "-" ali "CNN" - tak vnos zavrzemo.
    */
    if (!title || !link) continue;
    if (title.replace(/[^\p{L}\p{N}]/gu, "").length < 10) continue;

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

/* ---------------- prevajanje v slovenscino ---------------- */

/*
  Prevajamo SAMO nove naslove. Ze prevedene preberemo iz prejsnjega
  news.json in jih uporabimo znova. Brez tega bi ob prozitvi vsaki
  2 minuti prislo do ~17.000 prevodov na dan, kar noben brezplacen
  servis ne prenese. Tako jih je realno 100-200 na dan.
*/

function readPreviousTranslations() {
  const map = new Map();
  try {
    const target = path.resolve(process.cwd(), OUT_FILE);
    if (!fs.existsSync(target)) return map;

    const old = JSON.parse(fs.readFileSync(target, "utf8"));
    for (const items of Object.values(old.sources || {})) {
      for (const item of items) {
        if (item && item.title && item.titleSl) {
          map.set(item.title, item.titleSl);
        }
      }
    }
  } catch (_) {}
  return map;
}

/*
  Kakovost prevoda.

  Brezplacni Google brez kljuca je pri kratkih, telegrafskih naslovih
  slab - "cycling great" prevede kot "kolesarsko kolesarjenje".
  DeepL je za angleščino-slovenščino bistveno boljsi, zato ga
  uporabimo, ce je na voljo kljuc v okoljski spremenljivki DEEPL_KEY
  (v GitHubu se nastavi kot Secret). Brez kljuca vse deluje kot doslej.
*/
const DEEPL_KEY = (process.env.DEEPL_KEY || "").trim();

async function translateBatchDeepL(texts, sourceLang) {
  if (!DEEPL_KEY || !texts.length) return null;

  /* Kljuci brezplacnega paketa se koncajo na ":fx". */
  const host = DEEPL_KEY.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";

  const params = new URLSearchParams();
  for (const t of texts) params.append("text", t);
  params.append("source_lang", sourceLang || "EN");
  params.append("target_lang", "SL");
  /* Novinarski naslovi niso formalno pisanje. */
  params.append("formality", "prefer_less");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);

  try {
    const res = await fetch(host + "/v2/translate", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: "DeepL-Auth-Key " + DEEPL_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA
      },
      body: params.toString()
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    if (!data || !Array.isArray(data.translations)) return null;

    return data.translations.map(t => String(t.text || "").trim());
  } finally {
    clearTimeout(timer);
  }
}

async function translateOne(text) {
  /* 1) Google (neuraden naslov, brez kljuca) */
  try {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=auto&tl=sl&dt=t&q=" +
      encodeURIComponent(text);
    const raw = await get(url, 12000);
    const data = JSON.parse(raw);
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const out = data[0]
        .map(part => (part && part[0] ? part[0] : ""))
        .join("")
        .trim();
      if (out) return out;
    }
  } catch (_) {}

  /* 2) MyMemory (rezerva, prav tako brez kljuca) */
  try {
    const url =
      "https://api.mymemory.translated.net/get?langpair=en|sl&q=" +
      encodeURIComponent(text);
    const raw = await get(url, 12000);
    const data = JSON.parse(raw);
    const out = data && data.responseData && data.responseData.translatedText;
    if (out && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) {
      return String(out).trim();
    }
  } catch (_) {}

  return "";
}

async function translateItems(source, items, cache) {
  let reused = 0;

  /* Najprej iz pomnilnika - teh ni treba prevajati. */
  const todo = [];
  for (const item of items) {
    const known = cache.get(item.title);
    if (known) {
      item.titleSl = known;
      reused++;
    } else {
      todo.push(item);
    }
  }

  let fresh = 0;
  let via = "";

  if (todo.length) {
    /* 1) DeepL v enem samem zahtevku za vse nove naslove. */
    try {
      const out = await translateBatchDeepL(
        todo.map(x => x.title),
        source.lang
      );
      if (out && out.length === todo.length) {
        todo.forEach((item, i) => {
          const t = out[i];
          if (t && t !== item.title) {
            item.titleSl = t;
            cache.set(item.title, t);
            fresh++;
          }
        });
        via = " (DeepL)";
      }
    } catch (err) {
      console.log(`    DeepL ni uspel: ${err.message} - uporabljam rezervo`);
    }

    /* 2) Kar je ostalo, prevedemo po enem prek Googla / MyMemory. */
    for (const item of todo) {
      if (item.titleSl) continue;

      const translated = await translateOne(item.title);
      if (translated && translated !== item.title) {
        item.titleSl = translated;
        cache.set(item.title, translated);
        fresh++;
        if (!via) via = " (Google)";
      }
      await new Promise(r => setTimeout(r, 250));
    }
  }

  const missing = items.filter(x => !x.titleSl).length;
  console.log(
    `    prevod${via}: ${fresh} novih, ${reused} iz pomnilnika` +
      (missing ? `, ${missing} neuspesnih` : "")
  );
}

/* ---------------- na danasnji dan ---------------- */

/*
  Vir: dnevna stran slovenske Wikipedije, npr. "27. julij".
  Prednost pred Wikimedijinim onthisday API-jem: ta podpira le nekaj
  jezikov, slovenscine ne. Dnevna stran pa je ze v slovenscini in
  po naravi vsebuje vec slovenskih dogodkov.
*/

const SL_MESECI = [
  "januar", "februar", "marec", "april", "maj", "junij",
  "julij", "avgust", "september", "oktober", "november", "december"
];

/* Kljucne besede, po katerih slovenske dogodke potisnemo naprej. */
const SL_KLJUCNE = /(sloven|ljubljan|maribor|celje|kranj|koper|ptuj|novo mesto|velenje|jugoslavij|prešern|trubar|plečnik|cankar|triglav|primorsk|štajersk|gorenjsk|dolenjsk|prekmurj|korošk|istr|soč|posoč|bled|piran|obala)/i;

function cleanWikitext(input) {
  let t = String(input || "");

  t = t.replace(/<ref[^>]*\/>/gi, "");
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  t = t.replace(/<!--[\s\S]*?-->/g, "");

  /* Predloge lahko gnezdijo - odstranjujemo od znotraj navzven. */
  for (let i = 0; i < 5; i++) {
    const before = t;
    t = t.replace(/\{\{[^{}]*\}\}/g, "");
    if (t === before) break;
  }

  t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");
  t = t.replace(/\[\[([^\]]*)\]\]/g, "$1");
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1");
  t = t.replace(/'''/g, "").replace(/''/g, "");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/g, " ");
  t = t.replace(/&amp;/g, "&");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

function extractWikiSection(wikitext, names) {
  const lines = String(wikitext || "").split("\n");
  const out = [];
  let inside = false;

  for (const line of lines) {
    const heading = line.match(/^\s*(={2,})\s*(.+?)\s*\1\s*$/);
    if (heading) {
      const title = cleanWikitext(heading[2]).toLowerCase();
      inside = names.some(n => title === n || title.startsWith(n));
      continue;
    }
    if (inside) out.push(line);
  }

  return out;
}

function parseWikiEvents(lines, type) {
  const items = [];

  for (const raw of lines) {
    if (!/^\s*\*/.test(raw)) continue;

    const line = cleanWikitext(raw.replace(/^\s*\*+\s*/, ""));
    if (!line) continue;

    /* Oblika: "1214 – opis"  ali  "44 pr. n. št. – opis" */
    const m = line.match(
      /^(\d{1,4}\s*(?:pr\.\s*n\.\s*št\.)?)\s*[–—-]\s*(.+)$/
    );
    if (!m) continue;

    const year = m[1].replace(/\s+/g, " ").trim();
    let text = m[2].trim();
    if (text.length < 8) continue;

    text = text.charAt(0).toUpperCase() + text.slice(1);
    items.push({ year, text, type });
  }

  return items;
}

async function loadOnThisDay(previous) {
  const now = new Date();
  const dayKey =
    String(now.getDate()).padStart(2, "0") +
    "." +
    String(now.getMonth() + 1).padStart(2, "0");

  /* Vsebina se spremeni enkrat na dan - prejsnjo uporabimo znova. */
  if (
    previous &&
    previous.date === dayKey &&
    Array.isArray(previous.items) &&
    previous.items.length
  ) {
    console.log(`  · Na današnji dan: iz pomnilnika (${previous.items.length})`);
    return previous;
  }

  const pageTitle = `${now.getDate()}._${SL_MESECI[now.getMonth()]}`;
  const url =
    "https://sl.wikipedia.org/w/api.php?action=parse&format=json" +
    "&formatversion=2&redirects=1&prop=wikitext&page=" +
    encodeURIComponent(pageTitle);

  try {
    const raw = await get(url, 20000);
    const data = JSON.parse(raw);
    const wikitext = data && data.parse && data.parse.wikitext;
    if (!wikitext) throw new Error("stran brez vsebine");

    const events = parseWikiEvents(
      extractWikiSection(wikitext, ["dogodki"]),
      "dogodek"
    );
    const births = parseWikiEvents(
      extractWikiSection(wikitext, ["rojstva"]),
      "rojstvo"
    );
    const deaths = parseWikiEvents(
      extractWikiSection(wikitext, ["smrti"]),
      "smrt"
    );

    /*
      Slovenski dogodki gredo naprej, znotraj skupine pa novejsi
      pred starejse - ti so obicajno bolj prepoznavni.
    */
    const rank = it => (SL_KLJUCNE.test(it.text) ? 0 : 1);
    const yearNum = it => {
      const n = parseInt(it.year, 10);
      return /pr\./i.test(it.year) ? -n : n;
    };

    const ordered = [...events, ...births, ...deaths].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      const typeOrder = { dogodek: 0, rojstvo: 1, smrt: 2 };
      const t = typeOrder[a.type] - typeOrder[b.type];
      if (t !== 0) return t;
      return yearNum(b) - yearNum(a);
    });

    const items = ordered.slice(0, 20);
    const slCount = items.filter(x => SL_KLJUCNE.test(x.text)).length;

    console.log(
      `  ✓ Na današnji dan: ${items.length} zapisov iz "${pageTitle.replace("_", " ")}"` +
        ` (slovenskih: ${slCount})`
    );

    return {
      date: dayKey,
      pageUrl: "https://sl.wikipedia.org/wiki/" + encodeURIComponent(pageTitle),
      items
    };
  } catch (err) {
    console.log(`  ✗ Na današnji dan: ${err.message}`);
    return previous && previous.items ? previous : { date: dayKey, items: [] };
  }
}

/* ---------------- glavni tok ---------------- */

/*
  Nekateri stari RSS naslovi se odzivajo, a jih medij ne polni vec
  (npr. rss.cnn.com je vracal clanke izpred let). Napake ni, zato
  se brez te preverbe zastarela vsebina tiho prikaze kot novica.

  Prag je namenoma velikodusen: loviti hocemo MRTVE vire (leta stare),
  ne pa pocasnejsih tematskih virov. Pri 3 dneh je bil prag prestrog
  in je zavrnil delujoc reutersbest.com.
*/
const MAX_FEED_AGE_DAYS = 14;

function feedAgeDays(items) {
  const dated = items.filter(x => x.date > 0);
  if (!dated.length) return null; /* brez datumov ne moremo soditi */
  const newest = Math.max(...dated.map(x => x.date));
  return (Date.now() - newest) / 86400000;
}

async function loadSource(source) {
  let lastErr = null;

  for (const feed of source.feeds) {
    try {
      const xml = await get(feed);
      const items = parseFeed(xml, source);

      if (!items.length) {
        console.log(`  · ${source.name}: ${feed} brez uporabnih novic`);
        continue;
      }

      const age = feedAgeDays(items);
      if (age !== null && age > MAX_FEED_AGE_DAYS) {
        console.log(
          `  · ${source.name}: ${feed} je ZASTAREL ` +
            `(najnovejša novica stara ${age.toFixed(1)} dni) - preskakujem`
        );
        continue;
      }

      console.log(`  ✓ ${source.name}: ${items.length} novic iz ${feed}`);
      return items;
    } catch (err) {
      lastErr = err;
      console.log(`  · ${source.name}: ${feed} -> ${err.message}`);
    }
  }

  throw lastErr || new Error("ni svežih novic");
}

async function enrichImages(source, items) {
  /*
    Tudi pri nerazresenih Google News povezavah slike POSKUSIMO
    poiskati. Ce zahtevek pristane na pravem clanku, dobimo sliko;
    ce pristane na Googlu, jo zavrne isRejectedImage. Prej sem te
    povezave preskakoval in Reuters je zato ostal brez slik.
  */
  const missing = items.filter(x => !x.image);
  if (!missing.length) return;

  let i = 0;
  async function worker() {
    while (i < missing.length) {
      const item = missing[i++];
      try {
        const html = await get(item.link, 18000);
        const img = imageFromArticleHtml(html, item.link);
        if (img) item.image = img;
      } catch (_) {}
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  const withImg = items.filter(x => x.image).length;
  console.log(`    slike: ${withImg}/${items.length} razrešenih`);
}

/*
  Google News povezavo razresimo v pravi naslov clanka.
  Dve poti:
   1) preusmeritev HTTP (deluje pri starejsih povezavah)
   2) dekodiranje - v naslovu "/articles/CBMi..." je base64 blok,
      v katerem je pravi naslov pogosto berljiv kot navaden niz
*/
function decodeGoogleNewsUrl(link) {
  const m = String(link).match(/\/articles\/([A-Za-z0-9_-]+)/);
  if (!m) return "";

  try {
    let b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const raw = Buffer.from(b64, "base64").toString("latin1");
    const found = raw.match(/https?:\/\/[^\x00-\x20"'\\<>]+/);
    if (found) {
      const u = absoluteUrl(found[0]);
      if (u && !/news\.google\.com/i.test(u)) return u;
    }
  } catch (_) {}

  return "";
}

async function resolveGoogleLinks(items) {
  const google = items.filter(x => /news\.google\.com/i.test(x.link));
  if (!google.length) return;

  let resolved = 0;

  for (const item of google) {
    /* 1) preusmeritev */
    try {
      const res = await get(item.link, 18000, false);
      if (res.url && !/news\.google\.com/i.test(res.url)) {
        item.link = res.url;
        resolved++;
        continue;
      }
    } catch (_) {}

    /* 2) dekodiranje naslova */
    const decoded = decodeGoogleNewsUrl(item.link);
    if (decoded) {
      item.link = decoded;
      resolved++;
    }
  }

  console.log(
    `    povezave: ${resolved}/${google.length} razrešenih iz Google News`
  );
}

function readPreviousFile() {
  try {
    const target = path.resolve(process.cwd(), OUT_FILE);
    if (!fs.existsSync(target)) return null;
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch (_) {
    return null;
  }
}

async function main() {
  console.log("Zbiram novice ...\n");

  const previousFile = readPreviousFile();

  /* Prevode iz prejsnjega zagona preberemo, preden datoteko prepisemo. */
  const translationCache = readPreviousTranslations();
  if (translationCache.size) {
    console.log(`(v pomnilniku ${translationCache.size} prevodov)\n`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    sources: {}
  };

  for (const source of SOURCES) {
    try {
      const items = await loadSource(source);
      await resolveGoogleLinks(items);
      await enrichImages(source, items);

      if (source.translate) {
        await translateItems(source, items, translationCache);
      }

      out.sources[source.id] = items;
    } catch (err) {
      console.log(`  ✗ ${source.name}: ${err.message}`);
      out.sources[source.id] = [];
    }
  }

  out.onThisDay = await loadOnThisDay(
    previousFile ? previousFile.onThisDay : null
  );

  const target = path.resolve(process.cwd(), OUT_FILE);
  fs.writeFileSync(target, JSON.stringify(out, null, 1), "utf8");

  const all = Object.values(out.sources).flat();
  const total = all.length;
  const withImg = all.filter(x => x.image).length;
  const withSl = all.filter(x => x.titleSl).length;
  const needSl = SOURCES.filter(s => s.translate)
    .reduce((sum, s) => sum + (out.sources[s.id] || []).length, 0);

  console.log(`\nZapisano: ${target}`);
  console.log(`Skupaj novic: ${total}, s sliko: ${withImg}`);
  console.log(`Prevedenih naslovov: ${withSl}/${needSl}`);
  console.log(`Na današnji dan: ${(out.onThisDay.items || []).length} zapisov`);
}

main().catch(err => {
  console.error("Napaka:", err);
  process.exit(1);
});
