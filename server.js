import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { WebcastPushConnection } from "tiktok-live-connector";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3e3;
const getAiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
const STOPLIST = /* @__PURE__ */ new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "as",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "all",
  "both",
  "each",
  "every",
  "some",
  "any",
  "no",
  "not",
  "i",
  "me",
  "my",
  "mine",
  "we",
  "us",
  "our",
  "ours",
  "you",
  "your",
  "yours",
  "he",
  "him",
  "his",
  "she",
  "her",
  "hers",
  "they",
  "them",
  "their",
  "theirs",
  "which",
  "who",
  "whom",
  "whose",
  "into",
  "over",
  "after",
  "before",
  "between",
  "under",
  "through",
  "during"
]);
function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
function stripDisambiguator(s) {
  return String(s || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}
const CURATED_ARTICLES = [
  {
    date: "2026-10-31",
    title: "Aurora",
    category: "Planetary Physics & Space",
    difficulty: "Standard",
    quote: "An aurora is a natural light display in the sky, predominantly seen in high-latitude regions around the Arctic and Antarctic.",
    fallbackParagraphs: [
      "An aurora, sometimes referred to as polar lights, northern lights, or southern lights, is a natural light display in Earth's sky, predominantly seen in high-latitude regions around the Arctic and Antarctic. Auroras display dynamic patterns of brilliant lights that appear as curtains, rays, spirals, or dynamic flickers covering the entire sky.",
      "Auroras are the result of disturbances in the magnetosphere caused by the solar wind. Major disturbances result from enhancements in the speed of the solar wind from coronal holes and coronal mass ejections. These disturbances alter the trajectories of charged particles in the magnetospheric plasma.",
      "The resulting ionization and excitation of atmospheric constituents emit light of varying color and complexity. The form of the aurora, occurring within bands around both polar regions, is also dependent on the amount of acceleration imparted to the precipitating particles, mostly electrons and protons."
    ],
    semanticRelated: {
      aurora: 1,
      polar: 4,
      magnetosphere: 7,
      solar: 9,
      northern: 12,
      arctic: 15,
      sky: 18,
      light: 22,
      wind: 28,
      plasma: 34,
      electrons: 41,
      atmosphere: 48,
      magnetic: 55,
      sun: 64,
      earth: 72,
      night: 85,
      glow: 96,
      radiation: 115,
      ionosphere: 130,
      Borealis: 3,
      Australis: 5,
      curtains: 140,
      particles: 52,
      protons: 60,
      coronal: 38,
      space: 90,
      astronomy: 110
    }
  },
  {
    date: "2026-10-30",
    title: "Octopus",
    category: "Marine Biology",
    difficulty: "Standard",
    quote: "Octopuses are soft-bodied, eight-limbed molluscs that inhabit coral reefs, pelagic waters, and the seabed.",
    fallbackParagraphs: [
      "An octopus is a soft-bodied, eight-limbed mollusc of the order Octopoda. The order consists of some 300 species and is grouped within the class Cephalopoda with squids, cuttlefish, and nautiloids. Like other cephalopods, an octopus is bilaterally symmetric with two eyes and a beaked mouth at the center point of the eight limbs.",
      "The soft body can radically alter its shape, enabling octopuses to squeeze through small gaps. They trail their eight appendages behind them as they swim. The siphon is used both for respiration and for locomotion, by expelling a jet of water. Octopuses have a complex nervous system and excellent sight, and are among the most intelligent and behaviorally diverse of all invertebrates.",
      "Octopuses inhabit various regions of the ocean, including coral reefs, pelagic waters, and the seabed; some live in the intertidal zone and others at abyssal depths. Most species grow quickly, mature early, and are short-lived. Strategies to defend themselves against predators include the expulsion of ink, the use of camouflage and threat displays, and the ability to jet quickly through the water."
    ],
    semanticRelated: {
      octopus: 1,
      squid: 4,
      cephalopod: 6,
      tentacle: 8,
      mollusc: 12,
      ocean: 16,
      marine: 22,
      camouflage: 29,
      ink: 33,
      sea: 39,
      coral: 45,
      reef: 50,
      water: 58,
      intelligent: 66,
      invertebrate: 74,
      siphon: 82,
      arms: 91,
      beak: 105,
      predator: 120,
      biology: 145
    }
  },
  {
    date: "2026-10-29",
    title: "Espresso",
    category: "Culinary Arts & Chemistry",
    difficulty: "Standard",
    quote: "Espresso is a concentrated coffee-brewing method of Italian origin in which pressurized hot water is forced through finely ground coffee beans.",
    fallbackParagraphs: [
      "Espresso is a coffee-brewing method of Italian origin, in which a small amount of nearly boiling water is forced under pressure through finely ground coffee beans. Espresso can be made with a wide variety of coffee beans and roast degrees. Espresso is the most common way of making coffee in southern Europe, especially in Italy, Spain, and Portugal.",
      "The result is a concentrated coffee with a thicker consistency than coffees brewed by other methods, a crema foam on top, and a higher concentration of suspended and dissolved solids. Because of the pressurized brewing process, the flavors and chemicals in a typical cup of espresso are very concentrated.",
      "Espresso is also the base for several other coffee drinks, such as caff\xE8 latte, cappuccino, macchiato, caff\xE8 mocha, flat white, and caff\xE8 Americano. Espresso has more caffeine per unit volume than most coffee beverages, but because the usual serving size is much smaller, the total caffeine content is less than a mug of standard drip-brewed coffee."
    ],
    semanticRelated: {
      espresso: 1,
      coffee: 2,
      barista: 5,
      cappuccino: 7,
      caffeine: 10,
      crema: 14,
      italian: 18,
      roast: 23,
      beans: 27,
      latte: 31,
      brew: 36,
      pressure: 44,
      cup: 55,
      drink: 68,
      mocha: 75
    }
  },
  {
    date: "2026-10-28",
    title: "Lighthouse",
    category: "Maritime Architecture",
    difficulty: "Standard",
    quote: "A lighthouse is a tower, building, or other type of physical structure designed to emit light from a system of lamps and lenses to serve as a navigational aid.",
    fallbackParagraphs: [
      "A lighthouse is a tower, building, or other type of physical structure designed to emit light from a system of lamps and lenses and to serve as a beacon for navigational aid, for maritime pilots at sea or on inland waterways. Lighthouses mark dangerous coastlines, hazardous shoals, reefs, rocks, and safe entries to harbors.",
      "Once widely used, the number of operational lighthouses has declined due to the expense of maintenance and the advent of electronic navigational systems. In a lighthouse, the source of light is called the lamp and the light is concentrated by the lens or optic, historically engineered using the Fresnel lens.",
      "Originally lit by open fires and later candles or whale oil lamps, the Argand hollow-wick lamp and parabolic reflector were introduced in the late 18th century. Today, automated electric beacons and GPS satellite navigation have largely replaced resident lighthouse keepers across the globe."
    ],
    semanticRelated: {
      lighthouse: 1,
      beacon: 3,
      maritime: 6,
      tower: 9,
      coast: 12,
      harbor: 15,
      ship: 19,
      navigation: 24,
      lens: 30,
      sea: 35,
      Fresnel: 42,
      sailors: 49,
      ocean: 56,
      reef: 65
    }
  },
  {
    date: "2026-10-27",
    title: "Golden Gate Bridge",
    category: "Civil Engineering",
    difficulty: "Challenging",
    quote: "The Golden Gate Bridge is a suspension bridge spanning the Golden Gate, the one-mile-wide strait connecting San Francisco Bay and the Pacific Ocean.",
    fallbackParagraphs: [
      "The Golden Gate Bridge is a suspension bridge spanning the Golden Gate, the one-mile-wide strait connecting San Francisco Bay and the Pacific Ocean. The structure links the U.S. city of San Francisco, California\u2014the northern tip of the San Francisco Peninsula\u2014to Marin County, carrying both U.S. Route 101 and California State Route 1 across the strait.",
      "The bridge is one of the most internationally recognized symbols of San Francisco and California. It was initially designed by engineer Joseph Strauss in 1917. At the time of its opening in 1937, it was both the longest and the tallest suspension bridge in the world, with a main span of 4,200 feet and a total height of 746 feet.",
      "Painted in a distinctive International Orange sealant to enhance visibility in thick Pacific fog and protect the steel cables from salt-air corrosion, the Golden Gate Bridge remains a landmark of modern civil engineering."
    ],
    semanticRelated: {
      golden: 2,
      gate: 3,
      bridge: 1,
      suspension: 5,
      california: 9,
      francisco: 11,
      pacific: 16,
      strait: 21,
      steel: 28,
      cables: 34,
      bay: 40,
      orange: 47,
      engineering: 54,
      span: 62
    }
  },
  {
    date: "2026-10-26",
    title: "Photosynthesis",
    category: "Biochemistry & Botany",
    difficulty: "Challenging",
    quote: "Photosynthesis is a biological process used by plants, algae, and certain bacteria to convert light energy into chemical energy.",
    fallbackParagraphs: [
      "Photosynthesis is a system of biological processes by which photosynthetic organisms, such as most plants, algae, and cyanobacteria, convert light energy, typically from sunlight, into the chemical energy necessary to fuel their metabolism. Photosynthesis usually refers to oxygenic photosynthesis, a process that produces oxygen.",
      "Photosynthetic organisms store the chemical energy so produced within intracellular organic compounds, especially carbohydrates like sugars, synthesized from carbon dioxide and water. Most plants, algae, and cyanobacteria perform photosynthesis inside specialized organelles called chloroplasts using the green pigment chlorophyll.",
      "Photosynthesis is critical for the existence of the vast majority of life on Earth. It is the way in which virtually all energy in the biosphere becomes available to living things, producing the atmospheric oxygen required by aerobic organisms."
    ],
    semanticRelated: {
      photosynthesis: 1,
      chlorophyll: 3,
      chloroplast: 5,
      plant: 8,
      sunlight: 11,
      oxygen: 14,
      carbon: 18,
      energy: 22,
      leaf: 26,
      algae: 31,
      biology: 38,
      sugar: 45,
      glucose: 50
    }
  },
  {
    date: "2026-10-25",
    title: "Black Hole",
    category: "Astrophysics & Relativity",
    difficulty: "Expert",
    quote: "A black hole is a region of spacetime where gravity is so strong that nothing, including light or other electromagnetic waves, has enough energy to escape.",
    fallbackParagraphs: [
      "A black hole is a region of spacetime where gravity is so strong that nothing, including light and other electromagnetic waves, contains enough energy to escape its event horizon. The theory of general relativity predicts that a sufficiently compact mass can deform spacetime to form a black hole.",
      "The boundary of no escape is called the event horizon. Although it has a great effect on the fate and circumstances of an object crossing it, it has no locally detectable features according to general relativity. In many ways, a black hole acts like an ideal black body, as it reflects no light.",
      "Black holes of stellar mass form when massive stars collapse at the end of their life cycle in a supernova explosion. Supermassive black holes of millions of solar masses exist at the centers of most galaxies, including Sagittarius A* at the core of the Milky Way."
    ],
    semanticRelated: {
      black: 2,
      hole: 1,
      gravity: 4,
      horizon: 6,
      relativity: 9,
      spacetime: 12,
      star: 16,
      singularity: 20,
      galaxy: 25,
      mass: 30,
      einstein: 36,
      supernova: 42,
      light: 48
    }
  },
  {
    date: "2026-10-24",
    title: "Origami",
    category: "Traditional Arts & Geometry",
    difficulty: "Standard",
    quote: "Origami is the Japanese art of paper folding, transforming a flat square sheet of paper into a finished sculpture without cuts or glue.",
    fallbackParagraphs: [
      "Origami is the Japanese art of paper folding. In modern usage, the word origami is often used as an inclusive term for all folding practices, regardless of their culture of origin. The goal is to transform a flat square sheet of paper into a finished sculpture through folding and sculpting techniques.",
      "Modern origami practitioners generally discourage the use of cuts, glue, or markings on the paper. A small number of basic origami folds can be combined in a variety of ways to make intricate designs. The best-known origami model is the Japanese paper crane.",
      "Beyond ceremonial and artistic traditions, mathematical origami principles are widely applied in modern aerospace engineering, such as folding solar panel arrays for space telescopes, surgical stents, and automotive airbag deployment."
    ],
    semanticRelated: {
      origami: 1,
      paper: 3,
      folding: 4,
      crane: 7,
      japanese: 10,
      crease: 15,
      square: 21,
      sculpture: 28,
      geometry: 35,
      art: 42,
      sheet: 50,
      craft: 58
    }
  }
];
async function fetchWikipediaArticle(titleOrRandom) {
  const curated = CURATED_ARTICLES.find(
    (a) => titleOrRandom && a.title.toLowerCase() === titleOrRandom.toLowerCase()
  );
  const targetTitle = titleOrRandom || CURATED_ARTICLES[Math.floor(Math.random() * CURATED_ARTICLES.length)].title;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
      targetTitle
    )}&prop=text|categories&formatversion=2&format=json&redirects=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "WikiContextoWordTycoon/2.0 (wordtycoon.live)" },
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.parse && json.parse.text) {
        const cleanTitle = stripDisambiguator(json.parse.title || targetTitle);
        const rawHtml = json.parse.text;
        const cleaned = rawHtml.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<table[\s\S]*?<\/table>/gi, "").replace(/<figure[\s\S]*?<\/figure>/gi, "").replace(/<sup[\s\S]*?<\/sup>/gi, "").replace(/<div[^>]*class="[^"]*(?:hatnote|thumb|gallery|reflist|shortdescription)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
        const paragraphs = [];
        const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
        let m;
        let totalChars = 0;
        while ((m = pRe.exec(cleaned)) !== null) {
          const text = m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
          if (text.length < 60) continue;
          if (/^Coordinates:/i.test(text) || /^Cite error:/i.test(text)) continue;
          paragraphs.push(text);
          totalChars += text.length;
          if (paragraphs.length >= 3 || totalChars >= 1100) break;
        }
        if (paragraphs.length >= 1) {
          return {
            title: cleanTitle,
            category: curated?.category || "Wikipedia Featured Discovery",
            quote: curated?.quote || paragraphs[0].split(". ").slice(0, 2).join(". ") + ".",
            paragraphs
          };
        }
      }
    }
  } catch (_) {
  }
  const fallback = curated || CURATED_ARTICLES[Math.floor(Math.random() * CURATED_ARTICLES.length)];
  return {
    title: fallback.title,
    category: fallback.category,
    quote: fallback.quote,
    paragraphs: fallback.fallbackParagraphs
  };
}
const LETTER_POOL = "EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRSSSSSSTTTTTTLLLLUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";
function getNeighbors(idx, rows, cols) {
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        out.push(nr * cols + nc);
      }
    }
  }
  return out;
}
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function placeSnakeWord(word, cells, rows, cols) {
  const upper = word.toUpperCase();
  const total = rows * cols;
  const starts = [];
  for (let i = 0; i < total; i++) {
    if (cells[i] === upper[0]) starts.push(i);
  }
  const blanks = [];
  for (let i = 0; i < total; i++) {
    if (cells[i] === null) blanks.push(i);
  }
  const candidates = [...shuffleArray(starts), ...shuffleArray(blanks)];
  for (let attempt = 0; attempt < Math.min(candidates.length, 45); attempt++) {
    const startIdx = candidates[attempt];
    const path2 = [startIdx];
    const used = /* @__PURE__ */ new Set([startIdx]);
    let ok = true;
    for (let li = 1; li < upper.length; li++) {
      const prev = path2[path2.length - 1];
      const wanted = upper[li];
      const neighbors = shuffleArray(getNeighbors(prev, rows, cols));
      let chosen = -1;
      for (const n of neighbors) {
        if (!used.has(n) && cells[n] === wanted) {
          chosen = n;
          break;
        }
      }
      if (chosen === -1) {
        for (const n of neighbors) {
          if (!used.has(n) && cells[n] === null) {
            chosen = n;
            break;
          }
        }
      }
      if (chosen === -1) {
        ok = false;
        break;
      }
      path2.push(chosen);
      used.add(chosen);
    }
    if (ok) {
      for (let i = 0; i < upper.length; i++) {
        cells[path2[i]] = upper[i];
      }
      return path2;
    }
  }
  return null;
}
function buildWikirecGrid(titleWords, articleWordsFreq, rows, cols) {
  const cells = new Array(rows * cols).fill(null);
  const targets = [];
  const placedNorms = /* @__PURE__ */ new Set();
  for (const tw of titleWords) {
    const norm = normalize(tw);
    if (norm.length < 3 || norm.length > 10 || placedNorms.has(norm)) continue;
    const path2 = placeSnakeWord(norm, cells, rows, cols);
    if (path2) {
      placedNorms.add(norm);
      targets.push({
        id: `target-${norm}`,
        word: tw.toUpperCase(),
        norm,
        length: norm.length,
        tier: "TITLE",
        revealed: false,
        closeness: 0,
        hintLetters: new Array(norm.length).fill(""),
        path: path2
      });
    }
  }
  const sortedCandidates = Array.from(articleWordsFreq.entries()).filter(([w]) => w.length >= 4 && w.length <= 8 && !placedNorms.has(w) && !STOPLIST.has(w) && !/^\d/.test(w)).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([w]) => w);
  const pyramidTiers = [
    "PYRAMID_1",
    "PYRAMID_2",
    "PYRAMID_2",
    "PYRAMID_3",
    "PYRAMID_3",
    "PYRAMID_3"
  ];
  let tierIdx = 0;
  for (const cand of sortedCandidates) {
    if (tierIdx >= pyramidTiers.length) break;
    const path2 = placeSnakeWord(cand, cells, rows, cols);
    if (path2) {
      placedNorms.add(cand);
      targets.push({
        id: `target-${cand}`,
        word: cand.toUpperCase(),
        norm: cand,
        length: cand.length,
        tier: pyramidTiers[tierIdx],
        revealed: false,
        closeness: 0,
        hintLetters: new Array(cand.length).fill(""),
        path: path2
      });
      tierIdx++;
    }
  }
  const finalCells = cells.map(
    (c) => c || LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)]
  );
  return {
    rows,
    cols,
    cells: finalCells,
    targets,
    bonusWordsFound: []
  };
}
function computeWordCloseness(guessNorm, targetNorm) {
  if (guessNorm === targetNorm) return 100;
  const gChars = new Set(guessNorm.split(""));
  const tChars = targetNorm.split("");
  let shared = 0;
  for (const c of tChars) {
    if (gChars.has(c)) shared++;
  }
  let score = Math.round(shared / tChars.length * 65);
  if (guessNorm[0] === targetNorm[0]) score += 18;
  if (guessNorm.length === targetNorm.length) score += 12;
  return Math.min(95, score);
}
async function createNewRound(opts) {
  const mode = opts.mode || "WIKICONTEXTO";
  const isDaily = !!opts.isDaily;
  const dailyDate = opts.dailyDate || "2026-10-31";
  let targetArticleTitle = opts.customTitle;
  if (isDaily && !targetArticleTitle) {
    const found = CURATED_ARTICLES.find((a) => a.date === dailyDate) || CURATED_ARTICLES[0];
    targetArticleTitle = found.title;
  }
  const articleData = await fetchWikipediaArticle(targetArticleTitle);
  const curatedMatch = CURATED_ARTICLES.find(
    (a) => a.title.toLowerCase() === articleData.title.toLowerCase()
  );
  const rawTitleWords = articleData.title.split(/\s+/).filter(Boolean);
  const titleNormsSet = /* @__PURE__ */ new Set();
  const titleTokens = rawTitleWords.map((tw, idx) => {
    const norm = normalize(tw);
    if (norm) titleNormsSet.add(norm);
    return {
      index: idx,
      text: tw,
      norm,
      length: tw.length,
      revealed: false
    };
  });
  let tokenIdCounter = 1;
  let totalWords = 0;
  let revealedWordsCount = 0;
  const wordFreq = /* @__PURE__ */ new Map();
  const sourceParagraphs = mode === "WIKIWORD_QUOTE" ? [articleData.quote] : articleData.paragraphs;
  const paragraphs = sourceParagraphs.map((paraText) => {
    const tokens = [];
    const collapsed = paraText.replace(/(\d),(?=\d)/g, "$1");
    const re = /([\p{L}\p{N}\p{M}]+(?:'[\p{L}]+)?)|([^\p{L}\p{N}\p{M}]+)/gu;
    let m;
    while ((m = re.exec(collapsed)) !== null) {
      if (m[1]) {
        const word = m[1];
        const norm = normalize(word);
        const isStop = STOPLIST.has(norm);
        const isNumber = /^\d/.test(norm);
        const digitCount = (norm.match(/\d/g) || []).length;
        const isTitleWord = titleNormsSet.has(norm);
        if (!isStop) {
          totalWords++;
          wordFreq.set(norm, (wordFreq.get(norm) || 0) + 1);
        } else {
          revealedWordsCount++;
        }
        tokens.push({
          id: tokenIdCounter++,
          type: "word",
          text: word,
          norm,
          length: isTitleWord ? 8 : word.length,
          isStop,
          isNumber,
          digitCount,
          isTitleWord,
          revealed: isStop
        });
      } else {
        tokens.push({
          id: tokenIdCounter++,
          type: "space",
          text: m[2],
          norm: "",
          length: m[2].length,
          isStop: true,
          isNumber: false,
          digitCount: 0,
          isTitleWord: false,
          revealed: true
        });
      }
    }
    return tokens;
  });
  const semanticRanks = /* @__PURE__ */ new Map();
  titleTokens.forEach((tt, idx) => {
    semanticRanks.set(tt.norm, idx + 1);
  });
  if (curatedMatch) {
    for (const [w, r] of Object.entries(curatedMatch.semanticRelated)) {
      const n = normalize(w);
      if (!semanticRanks.has(n)) semanticRanks.set(n, r);
    }
  }
  const sortedArticleWords = Array.from(wordFreq.entries()).sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length
  );
  let nextRank = 10;
  for (const [norm] of sortedArticleWords) {
    if (!semanticRanks.has(norm)) {
      while (Array.from(semanticRanks.values()).includes(nextRank)) {
        nextRank++;
      }
      semanticRanks.set(norm, nextRank++);
    }
  }
  const rows = mode === "WIKIWORD_QUOTE" ? 5 : 7;
  const cols = 7;
  const gridBoard = buildWikirecGrid(rawTitleWords, wordFreq, rows, cols);
  return {
    roundId: `round_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    mode,
    isDaily,
    dailyDate: isDaily ? dailyDate : void 0,
    articleTitle: articleData.title,
    articleCategory: articleData.category,
    articleSummaryQuote: articleData.quote,
    titleTokens,
    paragraphs,
    wordFreq,
    semanticRanks,
    revealedSet: new Set(STOPLIST),
    totalWords,
    revealedWordsCount,
    guessCount: 0,
    solved: false,
    topRankCards: [],
    recentTicker: [],
    leaderboard: /* @__PURE__ */ new Map(),
    lastAnnouncement: null,
    gridBoard,
    startedAt: Date.now()
  };
}
function serializeRound(round) {
  return {
    roundId: round.roundId,
    mode: round.mode,
    isDaily: round.isDaily,
    dailyDate: round.dailyDate,
    articleTitle: round.solved ? round.articleTitle : "REDACTED ARTICLE",
    articleCategory: round.articleCategory,
    articleSummaryQuote: round.solved ? round.articleSummaryQuote : void 0,
    titleTokens: round.titleTokens.map((t) => ({
      index: t.index,
      text: t.revealed || round.solved ? t.text : "\u2022".repeat(Math.min(Math.max(t.length, 4), 9)),
      norm: t.revealed || round.solved ? t.norm : "",
      length: t.length,
      revealed: t.revealed || round.solved,
      foundBy: t.foundBy
    })),
    paragraphs: round.paragraphs.map(
      (para) => para.map((tok) => ({
        id: tok.id,
        type: tok.type,
        text: tok.revealed || round.solved ? tok.text : "",
        norm: tok.revealed || round.solved ? tok.norm : "",
        length: tok.length,
        isStop: tok.isStop,
        isNumber: tok.isNumber,
        digitCount: tok.digitCount,
        isTitleWord: tok.isTitleWord,
        revealed: tok.revealed || round.solved,
        foundBy: tok.foundBy
      }))
    ),
    totalWords: round.totalWords,
    revealedWordsCount: round.revealedWordsCount,
    guessCount: round.guessCount,
    solved: round.solved,
    solvedBy: round.solvedBy,
    topRankCards: round.topRankCards,
    recentTicker: round.recentTicker,
    leaderboard: Array.from(round.leaderboard.values()).sort((a, b) => b.score - a.score).slice(0, 15),
    lastAnnouncement: round.lastAnnouncement,
    gridBoard: {
      rows: round.gridBoard.rows,
      cols: round.gridBoard.cols,
      cells: round.gridBoard.cells,
      targets: round.gridBoard.targets.map((t) => ({
        id: t.id,
        word: t.revealed || round.solved ? t.word : t.hintLetters.map((l) => l || "\u2022").join(""),
        norm: t.revealed || round.solved ? t.norm : "",
        length: t.length,
        tier: t.tier,
        revealed: t.revealed || round.solved,
        closeness: t.closeness,
        hintLetters: t.hintLetters,
        path: t.revealed || round.solved ? t.path : [],
        finder: t.finder
      })),
      bonusWordsFound: round.gridBoard.bonusWordsFound
    },
    startedAt: round.startedAt
  };
}
async function evaluateSemanticRank(wordNorm, round) {
  if (round.semanticRanks.has(wordNorm)) {
    const r = round.semanticRanks.get(wordNorm);
    const sim = Math.max(15, Math.min(99, Math.round(100 - Math.log10(Math.max(1, r)) * 26)));
    return { rank: r, similarity: r === 1 ? 100 : sim };
  }
  const ai = getAiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Target Wikipedia Article: "${round.articleTitle}" (Category: ${round.articleCategory}). Player guessed word: "${wordNorm}". Estimate semantic relevance rank from 50 (very closely related concept) to 4500 (completely unrelated) and similarity percentage (1 to 88).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rank: { type: Type.INTEGER },
              similarity: { type: Type.INTEGER }
            }
          }
        }
      });
      const parsed = JSON.parse((response.text || "{}").trim());
      if (typeof parsed.rank === "number") {
        const clampedRank = Math.max(35, Math.min(4999, parsed.rank));
        const clampedSim = Math.max(5, Math.min(89, parsed.similarity || 40));
        round.semanticRanks.set(wordNorm, clampedRank);
        return { rank: clampedRank, similarity: clampedSim };
      }
    } catch (_) {
    }
  }
  const titleNorm = normalize(round.articleTitle);
  const closeness = computeWordCloseness(wordNorm, titleNorm);
  const heuristicRank = Math.max(120, Math.min(4800, Math.round(3500 - closeness * 32 + wordNorm.charCodeAt(0) * 17 % 400)));
  round.semanticRanks.set(wordNorm, heuristicRank);
  return { rank: heuristicRank, similarity: Math.max(8, Math.min(72, closeness)) };
}
const TITLE_WORD_BONUSES = [5e4, 4e4, 3e4, 2e4];
async function handleGuess(round, rawGuess, player) {
  const trimmed = String(rawGuess || "").trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return { valid: false, reason: "multi_word" };
  }
  const collapsed = trimmed.replace(/(\d),(?=\d)/g, "$1");
  const guessNorm = normalize(collapsed);
  if (!guessNorm || guessNorm.length < 1 || STOPLIST.has(guessNorm)) {
    return { valid: false, reason: "stop_or_short" };
  }
  const guessPossessiveStem = normalize(collapsed.replace(/['’]s$/i, ""));
  round.guessCount++;
  const alreadyRevealed = round.revealedSet.has(guessNorm);
  let titleMatched = false;
  let newlyFoundTitleIndex = -1;
  const previouslyFoundTitles = round.titleTokens.filter((t) => t.revealed).length;
  for (const tt of round.titleTokens) {
    if ((tt.norm === guessNorm || guessPossessiveStem && tt.norm === guessPossessiveStem) && !tt.revealed) {
      tt.revealed = true;
      tt.foundBy = {
        username: player.username,
        avatar: player.avatar,
        platform: player.platform
      };
      titleMatched = true;
      newlyFoundTitleIndex = previouslyFoundTitles;
    }
  }
  let occurrencesRevealed = 0;
  if (!alreadyRevealed) {
    for (const para of round.paragraphs) {
      for (const tok of para) {
        if (tok.type === "word" && !tok.revealed) {
          const tokPossessiveStem = normalize(tok.text.replace(/['’]s$/i, ""));
          if (tok.norm === guessNorm || guessPossessiveStem && tokPossessiveStem && tokPossessiveStem === guessPossessiveStem) {
            tok.revealed = true;
            tok.length = tok.text.length;
            tok.foundBy = {
              username: player.username,
              avatar: player.avatar,
              platform: player.platform
            };
            occurrencesRevealed++;
            round.revealedWordsCount++;
          }
        }
      }
    }
    if (occurrencesRevealed > 0 || titleMatched) {
      round.revealedSet.add(guessNorm);
    }
  }
  let gridTargetHit = false;
  for (const gt of round.gridBoard.targets) {
    if (!gt.revealed) {
      if (gt.norm === guessNorm) {
        gt.revealed = true;
        gt.closeness = 100;
        gt.hintLetters = gt.word.split("");
        gt.finder = {
          username: player.username,
          displayName: player.displayName,
          avatar: player.avatar,
          platform: player.platform
        };
        gridTargetHit = true;
      } else {
        const c = computeWordCloseness(guessNorm, gt.norm);
        if (c > gt.closeness) {
          gt.closeness = c;
          if (c >= 60 && !gt.hintLetters[0]) {
            gt.hintLetters[0] = gt.word[0];
          }
        }
      }
    }
  }
  const { rank, similarity } = await evaluateSemanticRank(guessNorm, round);
  let pointsEarned = 0;
  let rarity = "COMMON";
  if (titleMatched) {
    rarity = "TITLE";
    const bonus = TITLE_WORD_BONUSES[Math.min(newlyFoundTitleIndex, TITLE_WORD_BONUSES.length - 1)];
    pointsEarned += bonus + occurrencesRevealed * 1500;
  } else if (occurrencesRevealed > 0 || gridTargetHit) {
    const isNumber = /^\d/.test(guessNorm);
    if (isNumber) {
      const d = guessNorm.length;
      const numTable = { 1: 500, 2: 1e3, 3: 5e3, 4: 1e4 };
      pointsEarned = numTable[d] || Math.min(2e5, 1e4 * Math.pow(2, d - 4));
      rarity = d >= 4 ? "RARE" : "UNCOMMON";
    } else {
      if (rank <= 25 || guessNorm.length >= 9) {
        rarity = "ULTRA";
        pointsEarned = 12e3 + occurrencesRevealed * 800 + guessNorm.length * 250;
      } else if (rank <= 80 || guessNorm.length >= 7) {
        rarity = "RARE";
        pointsEarned = 8e3 + occurrencesRevealed * 600 + guessNorm.length * 180;
      } else if (rank <= 250 || guessNorm.length >= 5) {
        rarity = "UNCOMMON";
        pointsEarned = 4e3 + occurrencesRevealed * 400 + guessNorm.length * 120;
      } else {
        rarity = "COMMON";
        pointsEarned = 1e3 + occurrencesRevealed * 250 + guessNorm.length * 80;
      }
    }
    if (gridTargetHit) {
      pointsEarned += 6500;
    }
  } else if (!alreadyRevealed) {
    if (rank <= 100) {
      pointsEarned = 1200;
      rarity = "UNCOMMON";
    } else if (rank <= 500) {
      pointsEarned = 450;
    } else {
      pointsEarned = 100;
    }
  }
  const playerKey = `${player.platform}:${player.username.toLowerCase()}`;
  const existingPlayer = round.leaderboard.get(playerKey) || {
    id: playerKey,
    username: player.username,
    displayName: player.displayName || player.username,
    avatar: player.avatar,
    platform: player.platform,
    score: 0,
    wordsFound: 0,
    titleWordsFound: 0,
    bestRank: 9999,
    elo: 1200 + Math.floor(Math.random() * 250),
    cosmeticTitle: player.cosmeticTitle || "Wiki Explorer",
    borderColor: "#19e4ff"
  };
  if (player.avatar && player.avatar.startsWith("http")) {
    existingPlayer.avatar = player.avatar;
  }
  if (player.displayName) {
    existingPlayer.displayName = player.displayName;
  }
  if (pointsEarned > 0) {
    existingPlayer.score += pointsEarned;
    if (occurrencesRevealed > 0 || gridTargetHit) existingPlayer.wordsFound += 1;
    if (titleMatched) existingPlayer.titleWordsFound += 1;
  }
  if (rank < existingPlayer.bestRank) {
    existingPlayer.bestRank = rank;
  }
  round.leaderboard.set(playerKey, existingPlayer);
  const card = {
    word: rawGuess.trim().toUpperCase(),
    norm: guessNorm,
    rank: titleMatched ? 1 : rank,
    similarity: titleMatched ? 100 : similarity,
    countInArticle: occurrencesRevealed,
    pointsEarned,
    rarity,
    finder: {
      username: player.username,
      displayName: player.displayName || player.username,
      avatar: player.avatar,
      platform: player.platform,
      cosmeticTitle: existingPlayer.cosmeticTitle
    },
    timestamp: Date.now()
  };
  const existingIdx = round.topRankCards.findIndex((c) => c.norm === guessNorm);
  if (existingIdx === -1) {
    round.topRankCards.push(card);
    round.topRankCards.sort((a, b) => a.rank - b.rank);
    round.topRankCards = round.topRankCards.slice(0, 6);
  }
  round.recentTicker = [
    card,
    ...round.recentTicker.filter((c) => c.norm !== guessNorm)
  ].slice(0, 18);
  if (pointsEarned >= 1e3 || titleMatched || gridTargetHit) {
    round.lastAnnouncement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      username: player.username,
      displayName: player.displayName || player.username,
      avatar: player.avatar,
      platform: player.platform,
      word: rawGuess.trim().toUpperCase(),
      rarity,
      pointsEarned,
      totalPoints: existingPlayer.score,
      rank: card.rank,
      timestamp: Date.now()
    };
  }
  const allTitlesRevealed = round.titleTokens.every((t) => t.revealed);
  const allGridTargetsRevealed = round.mode !== "WIKICONTEXTO" && round.gridBoard.targets.length > 0 && round.gridBoard.targets.every((t) => t.revealed);
  if ((allTitlesRevealed || allGridTargetsRevealed) && !round.solved) {
    round.solved = true;
    round.solvedBy = {
      username: player.username,
      displayName: player.displayName || player.username,
      avatar: player.avatar,
      platform: player.platform
    };
    existingPlayer.elo += 24;
  }
  return {
    valid: true,
    alreadyRevealed,
    occurrencesRevealed,
    titleMatched,
    gridTargetHit,
    pointsEarned,
    rank: card.rank,
    similarity: card.similarity,
    rarity,
    solved: round.solved,
    card
  };
}
function revealHintOnRound(round) {
  const unrevealedTargets = round.gridBoard.targets.filter((t) => !t.revealed);
  if (unrevealedTargets.length > 0) {
    const target = unrevealedTargets[Math.floor(Math.random() * unrevealedTargets.length)];
    const emptyIdx = target.hintLetters.findIndex((l) => !l);
    if (emptyIdx !== -1) {
      target.hintLetters[emptyIdx] = target.word[emptyIdx];
      target.closeness = Math.min(95, target.closeness + 25);
    }
  }
  const unrevealedBodyWords = [];
  for (const para of round.paragraphs) {
    for (const tok of para) {
      if (tok.type === "word" && !tok.revealed && !tok.isTitleWord && !tok.isStop) {
        unrevealedBodyWords.push(tok.norm);
      }
    }
  }
  if (unrevealedBodyWords.length > 0) {
    const chosenNorm = unrevealedBodyWords[Math.floor(Math.random() * unrevealedBodyWords.length)];
    for (const para of round.paragraphs) {
      for (const tok of para) {
        if (tok.type === "word" && tok.norm === chosenNorm && !tok.revealed) {
          tok.revealed = true;
          tok.length = tok.text.length;
          round.revealedWordsCount++;
        }
      }
    }
    round.revealedSet.add(chosenNorm);
    return chosenNorm.toUpperCase();
  }
  return null;
}
let adminCredentials = {
  username: "Admin",
  password: "MissingWiki"
};
const authorizedUsers = /* @__PURE__ */ new Map([
  ["mrdimpz", { username: "mrdimpz", displayHandle: "@mrdimpz", key: "wiki123" }]
]);
const activeUserSessions = /* @__PURE__ */ new Map();
async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: "*" }
  });
  let activeRound = await createNewRound({
    mode: "WIKICONTEXTO",
    isDaily: true,
    dailyDate: "2026-10-31"
  });
  let tiktokConn = null;
  async function evaluateChatIntoGame(chatData) {
    const rawComment = String(chatData.comment || "").trim();
    if (!rawComment || /\s/.test(rawComment)) return;
    const collapsed = rawComment.replace(/(\d),(?=\d)/g, "$1");
    const norm = normalize(collapsed);
    if (!norm || STOPLIST.has(norm)) return;
    const result = await handleGuess(activeRound, rawComment, {
      username: chatData.uniqueId || "tiktok_viewer",
      displayName: chatData.nickname || chatData.uniqueId || "Viewer",
      avatar: chatData.profilePictureUrl || "",
      platform: "tiktok",
      cosmeticTitle: "TikTok Live"
    });
    if (result.valid) {
      io.emit("round:state", serializeRound(activeRound));
    }
  }
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body || {};
    if (String(username) === adminCredentials.username && String(password) === adminCredentials.password) {
      const list = Array.from(authorizedUsers.values()).map((u) => ({
        username: u.displayHandle,
        key: u.key,
        online: activeUserSessions.has(u.username)
      }));
      return res.json({
        ok: true,
        adminUsername: adminCredentials.username,
        authorizedUsers: list
      });
    }
    return res.status(401).json({ ok: false, error: "Invalid Admin username or password." });
  });
  app.post("/api/admin/update", (req, res) => {
    const { currentUsername, currentPassword, newUsername, newPassword, usersList } = req.body || {};
    if (String(currentUsername) !== adminCredentials.username || String(currentPassword) !== adminCredentials.password) {
      return res.status(401).json({ ok: false, error: "Unauthorized admin request." });
    }
    if (newUsername && String(newUsername).trim()) {
      adminCredentials.username = String(newUsername).trim();
    }
    if (newPassword && String(newPassword).trim()) {
      adminCredentials.password = String(newPassword).trim();
    }
    if (Array.isArray(usersList)) {
      authorizedUsers.clear();
      for (const item of usersList) {
        const rawHandle = String(item.username || "").trim();
        const key = String(item.key || "").trim();
        if (!rawHandle || !key) continue;
        const clean = rawHandle.replace(/^@+/, "").toLowerCase();
        if (!clean) continue;
        authorizedUsers.set(clean, {
          username: clean,
          displayHandle: `@${clean}`,
          key
        });
      }
    }
    const list = Array.from(authorizedUsers.values()).map((u) => ({
      username: u.displayHandle,
      key: u.key,
      online: activeUserSessions.has(u.username)
    }));
    return res.json({
      ok: true,
      adminUsername: adminCredentials.username,
      authorizedUsers: list
    });
  });
  app.get("/api/round", (_req, res) => {
    res.json({
      ok: true,
      round: serializeRound(activeRound),
      archive: CURATED_ARTICLES.map((a) => ({
        date: a.date,
        title: a.title,
        category: a.category,
        difficulty: a.difficulty,
        wordCount: a.fallbackParagraphs.join(" ").split(/\s+/).length
      }))
    });
  });
  app.post("/api/round/new", async (req, res) => {
    try {
      const { mode, isDaily, dailyDate, customTitle } = req.body || {};
      activeRound = await createNewRound({ mode, isDaily, dailyDate, customTitle });
      const serialized = serializeRound(activeRound);
      io.emit("round:state", serialized);
      res.json({ ok: true, round: serialized });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to create round" });
    }
  });
  app.post("/api/round/guess", async (req, res) => {
    try {
      const { word, player } = req.body || {};
      if (!word) return res.status(400).json({ ok: false, error: "Missing word" });
      const result = await handleGuess(activeRound, String(word), {
        username: player?.username || "explorer",
        displayName: player?.displayName || "Wiki Explorer",
        avatar: player?.avatar || "WE",
        platform: player?.platform || "web",
        cosmeticTitle: player?.cosmeticTitle || "Tycoon Scholar"
      });
      const serialized = serializeRound(activeRound);
      io.emit("round:state", serialized);
      res.json({ ok: true, result, round: serialized });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.post("/api/round/hint", (_req, res) => {
    const revealedWord = revealHintOnRound(activeRound);
    const serialized = serializeRound(activeRound);
    io.emit("round:state", serialized);
    res.json({ ok: true, revealedWord, round: serialized });
  });
  app.post("/api/round/reveal", (_req, res) => {
    activeRound.solved = true;
    for (const tt of activeRound.titleTokens) tt.revealed = true;
    for (const para of activeRound.paragraphs) {
      for (const tok of para) tok.revealed = true;
    }
    for (const gt of activeRound.gridBoard.targets) {
      gt.revealed = true;
      gt.closeness = 100;
    }
    const serialized = serializeRound(activeRound);
    io.emit("round:state", serialized);
    res.json({ ok: true, round: serialized });
  });
  io.on("connection", (socket) => {
    socket.emit("round:state", serializeRound(activeRound));
    let socketAuthUser = null;
    socket.on("streamer-auth-login", (payload, cb) => {
      const rawUser = String(payload?.username || "").trim();
      const rawKey = String(payload?.key || "").trim();
      const cleanUser = rawUser.replace(/^@+/, "").toLowerCase();
      const record = authorizedUsers.get(cleanUser);
      if (!record || record.key !== rawKey) {
        const errResp = {
          ok: false,
          error: "Invalid @username or admin-provided key. Ask Admin to authorise your handle."
        };
        if (cb) cb(errResp);
        return;
      }
      const existingSession = activeUserSessions.get(cleanUser);
      if (existingSession && existingSession.socketId !== socket.id) {
        const activeSocket = io.sockets.sockets.get(existingSession.socketId);
        if (activeSocket && activeSocket.connected) {
          const lockResp = {
            ok: false,
            error: `@${cleanUser} is already logged in on another active window. Multiple logins under the same @ are not permitted.`
          };
          if (cb) cb(lockResp);
          return;
        }
      }
      if (socketAuthUser && socketAuthUser !== cleanUser) {
        const prev = activeUserSessions.get(socketAuthUser);
        if (prev?.tiktokConn) {
          try {
            prev.tiktokConn.disconnect();
          } catch (_) {
          }
        }
        activeUserSessions.delete(socketAuthUser);
      }
      socketAuthUser = cleanUser;
      activeUserSessions.set(cleanUser, {
        socketId: socket.id,
        lastActive: Date.now(),
        tiktokConn: existingSession?.tiktokConn || null
      });
      const okResp = {
        ok: true,
        username: `@${cleanUser}`,
        cleanUsername: cleanUser
      };
      if (cb) cb(okResp);
    });
    const releaseSocketUser = () => {
      if (!socketAuthUser) return;
      const sess = activeUserSessions.get(socketAuthUser);
      if (sess && sess.socketId === socket.id) {
        if (sess.tiktokConn) {
          try {
            sess.tiktokConn.disconnect();
          } catch (_) {
          }
        }
        activeUserSessions.delete(socketAuthUser);
      }
      socketAuthUser = null;
    };
    socket.on("streamer-auth-logout", () => {
      releaseSocketUser();
      socket.emit("tiktok-disconnected");
    });
    socket.on("connect-tiktok", (username) => {
      const rawInput = String(username || "").trim();
      const cleanUsername = rawInput.startsWith("@") ? rawInput.substring(1) : rawInput;
      if (!cleanUsername) {
        socket.emit("tiktok-error", "Please enter a valid TikTok @username");
        return;
      }
      const userSession = socketAuthUser ? activeUserSessions.get(socketAuthUser) : null;
      if (userSession?.tiktokConn) {
        try {
          userSession.tiktokConn.disconnect();
        } catch (_) {
        }
        userSession.tiktokConn = null;
      } else if (tiktokConn) {
        try {
          tiktokConn.disconnect();
        } catch (_) {
        }
        tiktokConn = null;
      }
      const conn = new WebcastPushConnection(cleanUsername);
      tiktokConn = conn;
      if (userSession) {
        userSession.tiktokConn = conn;
        userSession.lastActive = Date.now();
      }
      conn.connect().then((state) => {
        socket.emit("tiktok-connected", {
          username: cleanUsername,
          roomId: state.roomId
        });
      }).catch((err) => {
        socket.emit("tiktok-error", err?.message || "Failed to connect to TikTok Live");
      });
      conn.on("chat", (data) => {
        if (userSession) userSession.lastActive = Date.now();
        io.emit("chat-message", data);
        evaluateChatIntoGame(data);
      });
      conn.on("like", (data) => {
        if (userSession) userSession.lastActive = Date.now();
        io.emit("like-event", data);
      });
      conn.on("gift", (data) => {
        if (userSession) userSession.lastActive = Date.now();
        io.emit("gift-event", data);
        revealHintOnRound(activeRound);
        io.emit("round:state", serializeRound(activeRound));
      });
      conn.on("disconnected", () => {
        io.emit("tiktok-disconnected");
      });
    });
    socket.on("disconnect-tiktok", () => {
      const userSession = socketAuthUser ? activeUserSessions.get(socketAuthUser) : null;
      if (userSession?.tiktokConn) {
        try {
          userSession.tiktokConn.disconnect();
        } catch (_) {
        }
        userSession.tiktokConn = null;
      }
      if (tiktokConn) {
        try {
          tiktokConn.disconnect();
        } catch (_) {
        }
        tiktokConn = null;
      }
      socket.emit("tiktok-disconnected");
    });
    socket.on("chat-message", (data) => {
      if (socketAuthUser) {
        const sess = activeUserSessions.get(socketAuthUser);
        if (sess) sess.lastActive = Date.now();
      }
      io.emit("chat-message", data);
      evaluateChatIntoGame(data);
    });
    socket.on("like-event", (data) => {
      if (socketAuthUser) {
        const sess = activeUserSessions.get(socketAuthUser);
        if (sess) sess.lastActive = Date.now();
      }
      io.emit("like-event", data);
    });
    socket.on("gift-event", (data) => {
      if (socketAuthUser) {
        const sess = activeUserSessions.get(socketAuthUser);
        if (sess) sess.lastActive = Date.now();
      }
      io.emit("gift-event", data);
      revealHintOnRound(activeRound);
      io.emit("round:state", serializeRound(activeRound));
    });
    socket.on("disconnect", () => {
      releaseSocketUser();
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`WikiContexto \xD7 Wikirec Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
