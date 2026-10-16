// Builds assets/stats.svg from GitHub data. Runs daily in GitHub Actions.
//
// Privacy: private repositories only ever contribute aggregate numbers
// (repo count, language bytes, contribution count). Their names, descriptions
// and code are never read into the card. Only public repos are listed by name.
//
// Env:
//   GH_USER      GitHub login (default: isteppanenko)
//   STATS_TOKEN  optional fine-grained token, read-only "Metadata" on all repos.
//                Without it the card is built from public data only.
import { writeFileSync, mkdirSync } from 'node:fs';

const USER = process.env.GH_USER || 'isteppanenko';
const TOKEN = process.env.STATS_TOKEN || '';
const RECENT_DAYS = 120;
const API = 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USER}-profile-stats`,
  ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
};

async function get(path) {
  const res = await fetch(path.startsWith('http') ? path : API + path, { headers });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function listRepos() {
  const base = TOKEN
    ? '/user/repos?affiliation=owner&visibility=all&per_page=100'
    : `/users/${USER}/repos?type=owner&per_page=100`;
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await get(`${base}&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter((r) => !r.fork && !r.archived && r.owner.login.toLowerCase() === USER.toLowerCase());
}

async function contributionsLastYear() {
  if (TOKEN) {
    try {
      const res = await fetch(`${API}/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: `{ user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions } } } }` }),
      });
      const n = (await res.json())?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions;
      if (Number.isFinite(n)) return n;
    } catch {}
  }
  try {
    const html = await (await fetch(`https://github.com/users/${USER}/contributions`, { headers: { 'User-Agent': headers['User-Agent'] } })).text();
    const m = html.match(/([\d,]+)\s+contributions?\s+in the last year/i);
    if (m) return +m[1].replace(/,/g, '');
  } catch {}
  return null;
}

const COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c',
  Astro: '#ff5a03', Vue: '#41b883', Svelte: '#ff3e00', Python: '#3572A5', Shell: '#89e051',
  PowerShell: '#012456', Java: '#b07219', 'C#': '#178600', PHP: '#4F5D95', Go: '#00ADD8',
  Rust: '#dea584', MDX: '#fcb32c', Less: '#1d365d', Handlebars: '#f7931e', Dockerfile: '#384d54',
};
const colorOf = (lang) => COLORS[lang] || `hsl(${[...lang].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 60% 60%)`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}

const repos = await listRepos();
const pub = repos.filter((r) => !r.private);
const priv = repos.filter((r) => r.private);

const langTotals = {}, recentLangs = {};
const cutoff = Date.now() - RECENT_DAYS * 864e5;
for (const r of repos) {
  let langs = {};
  try { langs = await get(`/repos/${r.full_name}/languages`); } catch {}
  const recent = new Date(r.pushed_at) >= cutoff;
  for (const [lang, bytes] of Object.entries(langs)) {
    langTotals[lang] = (langTotals[lang] || 0) + bytes;
    if (recent) recentLangs[lang] = (recentLangs[lang] || 0) + bytes;
  }
}
const totalBytes = Object.values(langTotals).reduce((a, b) => a + b, 0) || 1;
let langs = Object.entries(langTotals).sort((a, b) => b[1] - a[1]);
if (langs.length > 8) {
  const rest = langs.slice(7).reduce((a, [, b]) => a + b, 0);
  langs = [...langs.slice(0, 7), ['Other', rest]];
}
const lately = Object.entries(recentLangs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l);
const recent = pub
  .filter((r) => r.name.toLowerCase() !== USER.toLowerCase())
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, 4);
const stars = pub.reduce((a, r) => a + r.stargazers_count, 0);
const contrib = await contributionsLastYear();

/* ---------------- render ---------------- */
const W = 800, H = 352;
const tiles = [
  [fmt(pub.length), 'public repos'],
  [TOKEN ? fmt(priv.length) : '—', 'private repos 🔒'],
  [fmt(contrib), 'contributions · last year'],
  [fmt(stars), 'stars earned'],
];
const tileSvg = tiles.map(([num, label], i) => {
  const x = 32 + (i % 2) * 140, y = 72 + Math.floor(i / 2) * 64;
  return `<g class="fade" style="animation-delay:${0.1 + i * 0.1}s">
    <text class="num" x="${x}" y="${y + 28}">${esc(num)}</text>
    <text class="lbl" x="${x}" y="${y + 46}">${esc(label)}</text></g>`;
}).join('');

const BX = 330, BW = 438;
let off = 0;
const barSvg = langs.map(([lang, bytes], i) => {
  const w = (bytes / totalBytes) * BW, x = BX + off; off += w;
  return `<rect class="grow" style="animation-delay:${0.3 + i * 0.06}s" x="${x.toFixed(2)}" y="80" width="${Math.max(w, 0).toFixed(2)}" height="10" fill="${colorOf(lang)}"/>`;
}).join('');
const legendSvg = langs.map(([lang, bytes], i) => {
  const x = BX + (i % 2) * 220, y = 116 + Math.floor(i / 2) * 22;
  const pct = ((bytes / totalBytes) * 100).toFixed(1);
  return `<g class="fade" style="animation-delay:${0.5 + i * 0.05}s"><circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${colorOf(lang)}"/>
    <text class="txt" x="${x + 16}" y="${y}">${esc(lang)}</text><text class="dim" x="${x + 200}" y="${y}" text-anchor="end">${pct}%</text></g>`;
}).join('');

const recentSvg = recent.map((r, i) => {
  const y = 254 + i * 22;
  return `<g class="fade" style="animation-delay:${0.8 + i * 0.08}s">
    <circle cx="37" cy="${y - 4}" r="4" fill="${r.language ? colorOf(r.language) : '#6e7681'}"/>
    <text class="txt" x="48" y="${y}">${esc(r.name.length > 26 ? r.name.slice(0, 25) + '…' : r.name)}</text>
    <text class="dim" x="296" y="${y}" text-anchor="end">${ago(r.pushed_at)}</text></g>`;
}).join('') || `<text class="dim" x="32" y="254">no public repos yet</text>`;

let cx = BX;
const chipSvg = lately.map((lang, i) => {
  const w = lang.length * 7.2 + 30;
  if (cx + w > BX + BW) return '';
  const x = cx; cx += w + 8;
  return `<g class="fade" style="animation-delay:${0.9 + i * 0.08}s"><rect x="${x}" y="244" width="${w}" height="24" rx="12" fill="${colorOf(lang)}" fill-opacity=".14" stroke="${colorOf(lang)}" stroke-opacity=".6"/>
    <circle cx="${x + 13}" cy="256" r="4" fill="${colorOf(lang)}"/><text class="txt" x="${x + 22}" y="260">${esc(lang)}</text></g>`;
}).join('') || `<text class="dim" x="${BX}" y="256">quiet lately</text>`;

const today = new Date().toISOString().slice(0, 10);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="GitHub stats for ${esc(USER)}: ${pub.length} public repositories, top languages ${esc(langs.slice(0, 3).map(([l]) => l).join(', '))}">
<style>
  text { font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; }
  .mono { font: 13px 'JetBrains Mono', Consolas, 'Courier New', monospace; fill: #8b949e; }
  .mono b, .acc { fill: #a371f7; }
  .h { font-size: 12px; font-weight: 700; letter-spacing: .08em; fill: #a371f7; text-transform: uppercase; }
  .num { font: 700 28px 'JetBrains Mono', Consolas, monospace; fill: #e6edf3; }
  .lbl { font-size: 12px; fill: #8b949e; }
  .txt { font-size: 13px; fill: #c9d1d9; }
  .dim { font-size: 12px; fill: #8b949e; }
  .fade { animation: fade .6s ease-out both; }
  @keyframes fade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  .grow { transform-box: fill-box; transform-origin: left; animation: grow .7s ease-out both; }
  @keyframes grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  .cur { animation: blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0 } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important } }
</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="#13111f" stroke="#2f2a52" stroke-width="2"/>
<text class="mono" x="32" y="36"><tspan class="acc">${esc(USER)}@github</tspan>:~$ git stats --all</text>
<rect class="cur" x="${32 + (USER.length + 26) * 7.8}" y="25" width="7" height="14" fill="#a371f7"/>
<line x1="24" y1="52" x2="${W - 24}" y2="52" stroke="#2f2a52"/>
${tileSvg}
<text class="h" x="${BX}" y="70">Languages</text>
<clipPath id="bar"><rect x="${BX}" y="80" width="${BW}" height="10" rx="5"/></clipPath>
<g clip-path="url(#bar)"><rect x="${BX}" y="80" width="${BW}" height="10" fill="#2f2a52"/>${barSvg}</g>
${legendSvg}
<line x1="24" y1="212" x2="${W - 24}" y2="212" stroke="#2f2a52"/>
<text class="h" x="32" y="234">Recently pushed</text>
${recentSvg}
<text class="h" x="${BX}" y="234">Lately using</text>
${chipSvg}
<text class="dim" x="${W - 24}" y="${H - 16}" text-anchor="end" font-size="10">${TOKEN ? 'incl. private repos (numbers only)' : 'public repos'} · updated ${today}</text>
</svg>
`;

mkdirSync('assets', { recursive: true });
writeFileSync('assets/stats.svg', svg);
console.log(`stats.svg: ${pub.length} public, ${priv.length} private, ${langs.length} langs, lately: ${lately.join(', ') || '—'}, contributions: ${contrib}`);
