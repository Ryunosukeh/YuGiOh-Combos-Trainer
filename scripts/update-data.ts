// Holt die aktuellen Daten von Project Ignis und YGOPRODeck und baut daraus das Bundle in data/bundle/.
//
//   npm run update-data                  # alles aktualisieren
//   npm run update-data -- --no-fetch    # nur aus .cache/ neu bauen (offline)
//   npm run update-data -- --out <dir>   # anderes Zielverzeichnis
//
// Hinter einem HTTP-Proxy (z. B. Cloud-Sessions) mit NODE_USE_ENV_PROXY=1 starten, sonst ignoriert fetch den Proxy.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  BUNDLE_FILES, BUNDLE_FORMAT, type CardRecord, type LfList, type Manifest, type ScriptIndex, type StringTable,
} from "../src/data/types";

const args = process.argv.slice(2);
const FETCH = !args.includes("--no-fetch");
const OUT = path.resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : "data/bundle");
const CACHE = path.resolve(".cache");
const REPOS = {
  CardScripts: "https://github.com/ProjectIgnis/CardScripts.git",
  BabelCDB: "https://github.com/ProjectIgnis/BabelCDB.git",
  LFLists: "https://github.com/ProjectIgnis/LFLists.git",
  Distribution: "https://github.com/ProjectIgnis/Distribution.git",
};
const YGOPRODECK = "https://db.ygoprodeck.com/api/v7";

function git(cwd: string, ...a: string[]) {
  return execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

function syncRepo(name: string, url: string) {
  const dir = path.join(CACHE, "repos", name);
  if (FETCH) {
    if (!existsSync(path.join(dir, ".git"))) {
      mkdirSync(path.dirname(dir), { recursive: true });
      console.log(`  klone ${name} …`);
      git(path.dirname(dir), "clone", "--quiet", "--depth", "1", url, name);
    } else {
      console.log(`  aktualisiere ${name} …`);
      git(dir, "fetch", "--quiet", "--depth", "1", "origin", "HEAD");
      git(dir, "reset", "--quiet", "--hard", "FETCH_HEAD");
    }
  } else if (!existsSync(dir)) {
    throw new Error(`${dir} fehlt – einmal ohne --no-fetch ausführen`);
  }
  return { dir, commit: git(dir, "rev-parse", "HEAD"), date: git(dir, "log", "-1", "--format=%cI") };
}

// ---------- Karten (cards.cdb + release-*.cdb) ----------
function readCdb(file: string, into: Map<number, CardRecord>) {
  const db = new DatabaseSync(file, { readOnly: true });
  const stmt = db.prepare("SELECT d.*, t.* FROM datas d JOIN texts t ON t.id = d.id");
  stmt.setReadBigInts(true);
  for (const row of stmt.all() as Record<string, bigint | string>[]) {
    const num = (k: string) => Number(row[k]);
    const setcode = BigInt.asUintN(64, row.setcode as bigint);
    const setcodes: number[] = [];
    for (let i = 0n; i < 4n; i++) {
      const s = Number((setcode >> (16n * i)) & 0xffffn);
      if (s) setcodes.push(s);
    }
    const strings: string[] = [];
    for (let i = 1; i <= 16; i++) strings.push(String(row[`str${i}`] ?? ""));
    while (strings.length && !strings[strings.length - 1]) strings.pop();
    into.set(num("id"), {
      id: num("id"), alias: num("alias"), setcodes, type: num("type"), atk: num("atk"), def: num("def"),
      level: Number(BigInt.asUintN(32, row.level as bigint)), race: num("race"), attribute: num("attribute"),
      ot: num("ot"), category: num("category"),
      name: String(row.name), desc: String(row.desc).replace(/\r\n/g, "\n"), strings,
    });
  }
  db.close();
}

// ---------- Deutsche Texte (YGOPRODeck) ----------
interface YpdCard { id: number; name: string; desc: string; pend_desc?: string; monster_desc?: string }

async function loadGerman(): Promise<{ map: Map<number, YpdCard>; dbVersion: string }> {
  const file = path.join(CACHE, "ygoprodeck-de.json");
  const verFile = path.join(CACHE, "ygoprodeck-version.json");
  if (FETCH) {
    try {
      const ver = (await (await fetch(`${YGOPRODECK}/checkDBVer.php`)).json()) as { database_version: string }[];
      const cached = existsSync(verFile) ? JSON.parse(readFileSync(verFile, "utf8")) : null;
      if (!existsSync(file) || cached?.[0]?.database_version !== ver[0].database_version) {
        // Ein einziger Request für alle Karten – YGOPRODeck bittet ausdrücklich darum, lokal zu cachen.
        console.log("  lade deutsche Kartentexte von YGOPRODeck …");
        const res = await fetch(`${YGOPRODECK}/cardinfo.php?language=de`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: YpdCard[] };
        writeFileSync(file, JSON.stringify(json.data.map(({ id, name, desc, pend_desc, monster_desc }) => ({ id, name, desc, pend_desc, monster_desc }))));
        writeFileSync(verFile, JSON.stringify(ver));
      } else {
        console.log("  deutsche Kartentexte unverändert (Cache)");
      }
    } catch (e) {
      // Kein Abbruch: Englische Daten reichen zum Spielen; deutsche Texte kommen beim nächsten Lauf.
      console.warn(`  WARNUNG: YGOPRODeck nicht erreichbar (${e instanceof Error ? e.message : e}) – nutze Cache, falls vorhanden`);
    }
  }
  if (!existsSync(file)) return { map: new Map(), dbVersion: "keine" };
  const list = JSON.parse(readFileSync(file, "utf8")) as YpdCard[];
  const dbVersion = existsSync(verFile) ? JSON.parse(readFileSync(verFile, "utf8"))[0].database_version : "?";
  return { map: new Map(list.map((c) => [c.id, c])), dbVersion };
}

function germanDesc(c: YpdCard) {
  // Pendelmonster: YGOPRODeck trennt Pendel- und Monstereffekt.
  if (c.pend_desc && c.monster_desc) return `[Pendeleffekt]\n${c.pend_desc}\n[Monstereffekt]\n${c.monster_desc}`;
  return c.desc;
}

// ---------- Skripte ----------
function buildScriptPack(scriptsDir: string) {
  const files: [string, string][] = [];
  for (const f of readdirSync(scriptsDir)) if (f.endsWith(".lua")) files.push([f, path.join(scriptsDir, f)]);
  for (const f of readdirSync(path.join(scriptsDir, "official"))) if (f.endsWith(".lua")) files.push([f, path.join(scriptsDir, "official", f)]);
  files.push(["proc_unofficial.lua", path.join(scriptsDir, "unofficial", "proc_unofficial.lua")]);
  files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const index: ScriptIndex = {};
  const chunks: Buffer[] = [];
  let offset = 0;
  for (const [name, file] of files) {
    if (index[name]) throw new Error(`Skriptname doppelt: ${name}`);
    const buf = readFileSync(file);
    index[name] = [offset, buf.length];
    chunks.push(buf);
    offset += buf.length;
  }
  return { pack: Buffer.concat(chunks), index };
}

// ---------- Banlisten ----------
function parseLfLists(dir: string): LfList[] {
  const lists: LfList[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".lflist.conf") && !/rush/i.test(f))) {
    let cur: LfList | null = null;
    for (const raw of readFileSync(path.join(dir, f), "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("!")) lists.push((cur = { name: line.slice(1).trim(), cards: {} }));
      else if (cur && /^\d/.test(line)) {
        const [code, count] = line.split(/\s+/);
        cur.cards[code] = Number(count);
      }
    }
  }
  return lists;
}

// ---------- strings.conf ----------
function parseStrings(file: string): StringTable {
  const t: StringTable = { system: {}, victory: {}, counter: {}, setname: {} };
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^!(system|victory|counter|setname)\s+(\S+)\s+(.*)$/.exec(raw.trim());
    if (!m) continue;
    const key = m[1] === "system" ? String(Number(m[2])) : String(parseInt(m[2], 16));
    t[m[1] as keyof StringTable][key] = m[3].split("\t")[0].trim();
  }
  return t;
}

// ---------- Hauptprogramm ----------
async function main() {
  console.log(FETCH ? "Hole Quellen …" : "Baue aus Cache (--no-fetch) …");
  const src = Object.fromEntries(Object.entries(REPOS).map(([n, u]) => [n, syncRepo(n, u)])) as Record<keyof typeof REPOS, ReturnType<typeof syncRepo>>;

  console.log("Lese Kartendatenbank …");
  const cards = new Map<number, CardRecord>();
  readCdb(path.join(src.BabelCDB.dir, "cards.cdb"), cards);
  for (const f of readdirSync(src.BabelCDB.dir).filter((f) => /^release-.*\.cdb$/.test(f)).sort())
    readCdb(path.join(src.BabelCDB.dir, f), cards);

  const german = await loadGerman();
  let cardsDe = 0;
  for (const c of cards.values()) {
    const de = german.map.get(c.id) ?? (c.alias ? german.map.get(c.alias) : undefined);
    if (de) { c.nameDe = de.name; c.descDe = germanDesc(de); cardsDe++; }
  }

  console.log("Packe Skripte …");
  const { pack, index } = buildScriptPack(src.CardScripts.dir);
  const missing = [...cards.values()].filter((c) => c.type & 0x20 /* Effekt */ && !c.alias && !index[`c${c.id}.lua`]);
  if (missing.length) console.log(`  Hinweis: ${missing.length} Effektmonster ohne Skript (z. B. ${missing.slice(0, 3).map((c) => c.name).join(", ")})`);

  const lflists = parseLfLists(src.LFLists.dir);
  const distCfg = path.join(src.Distribution.dir, "config");
  const strings = { en: parseStrings(path.join(distCfg, "strings.conf")), de: parseStrings(path.join(distCfg, "languages", "Deutsch", "strings.conf")) };

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const files: Manifest["files"] = {};
  const write = (name: string, data: Buffer | string) => {
    const buf = typeof data === "string" ? Buffer.from(data) : data;
    writeFileSync(path.join(OUT, name), buf);
    files[name] = { bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
  };
  const cardList = [...cards.values()].sort((a, b) => a.id - b.id);
  write(BUNDLE_FILES.cards, gzipSync(JSON.stringify({ format: BUNDLE_FORMAT, cards: cardList }), { level: 9 }));
  write(BUNDLE_FILES.scriptPack, gzipSync(pack, { level: 9 }));
  write(BUNDLE_FILES.scriptIndex, JSON.stringify(index));
  write(BUNDLE_FILES.lflists, JSON.stringify(lflists));
  write(BUNDLE_FILES.strings, JSON.stringify(strings));

  const corePkg = JSON.parse(readFileSync(path.resolve("node_modules/ocgcore-wasm/package.json"), "utf8"));
  const short = (s: string) => s.slice(0, 7);
  const manifest: Manifest = {
    format: BUNDLE_FORMAT,
    version: `${new Date().toISOString().slice(0, 10)}-${short(src.CardScripts.commit)}-${short(src.BabelCDB.commit)}-${short(src.LFLists.commit)}`,
    builtAt: new Date().toISOString(),
    coreVersion: `ocgcore-wasm ${corePkg.version}`,
    sources: {
      ...Object.fromEntries(Object.entries(src).map(([n, s]) => [n, { url: REPOS[n as keyof typeof REPOS], commit: s.commit, date: s.date }])),
      YGOPRODeck: { url: `${YGOPRODECK}/cardinfo.php?language=de`, note: `Datenbank-Version ${german.dbVersion}` },
    },
    counts: { cards: cardList.length, cardsDe, scripts: Object.keys(index).length },
    files,
  };
  writeFileSync(path.join(OUT, BUNDLE_FILES.manifest), JSON.stringify(manifest, null, 2));

  const mb = (n: number) => (n / 1048576).toFixed(1) + " MB";
  console.log(`Fertig: ${OUT}`);
  console.log(`  ${cardList.length} Karten (${cardsDe} mit deutschem Text), ${Object.keys(index).length} Skripte, ${lflists.length} Banlisten`);
  for (const [n, f] of Object.entries(files)) console.log(`  ${n.padEnd(18)} ${mb(f.bytes)}`);
}

main().catch((e) => {
  console.error(e);
  // In GitHub Actions als Annotation sichtbar machen.
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=update-data::${String(e instanceof Error ? e.stack ?? e.message : e).replace(/\r?\n/g, "%0A")}`);
  process.exit(1);
});
