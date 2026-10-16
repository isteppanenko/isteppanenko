// Builds assets/stats.svg and the "Tech I use" block of README.md from GitHub
// data. Runs daily in GitHub Actions, so new repos and new tech show up by themselves.
//
// Privacy: private repositories only ever contribute aggregate numbers
// (repo count, language bytes, commit and contribution counts). Their names, descriptions
// and code are never read into the card. Only public repos are listed by name.
//
// Env:
//   GH_USER      GitHub login (default: isteppanenko)
//   STATS_TOKEN  optional fine-grained token on all repos: "Metadata" read-only gives
//                private counts and languages; adding "Contents" read-only also lets
//                it spot frameworks (package.json) in private repos.
//                Without it the card is built from public data only.
//   GITHUB_TOKEN used for public data when STATS_TOKEN is missing (higher rate limit).
//
// tech.json (skillicons.dev ids): "core" = skills I know myself, listed in README by hand;
// anything else found in repos created since "aiSince" goes to the auto "Built with AI" block;
// "hide" = never show.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';

const USER = process.env.GH_USER || 'isteppanenko';
const TOKEN = process.env.STATS_TOKEN || '';
const AUTH = TOKEN || process.env.GITHUB_TOKEN || '';
const RECENT_DAYS = 120;
const API = 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USER}-profile-stats`,
  ...(AUTH && { Authorization: `Bearer ${AUTH}` }),
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

// Commits by USER on the default branch, from the contributors list
// (needs only the "Metadata" permission, not access to the code).
async function commitsIn(repo) {
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${API}/repos/${repo.full_name}/contributors?per_page=100&page=${page}`, { headers });
    if (res.status !== 200) return 0; // 204 = empty repo
    const list = await res.json();
    const me = list.find((c) => c.login?.toLowerCase() === USER.toLowerCase());
    if (me) return me.contributions;
    if (list.length < 100) return 0;
  }
  return 0;
}

// GitHub language -> skillicons.dev id
const LANG_ICONS = {
  JavaScript: 'js', TypeScript: 'ts', HTML: 'html', CSS: 'css', SCSS: 'sass', Sass: 'sass', Less: 'less',
  Astro: 'astro', Vue: 'vue', Svelte: 'svelte', Python: 'py', PHP: 'php', Java: 'java', Kotlin: 'kotlin',
  'C#': 'cs', C: 'c', 'C++': 'cpp', Go: 'go', Rust: 'rust', Ruby: 'ruby', Swift: 'swift', Dart: 'dart',
  Lua: 'lua', Shell: 'bash', PowerShell: 'powershell', Dockerfile: 'docker', Solidity: 'solidity',
};
// npm package -> [skillicons.dev id, display name]
const PKG_ICONS = {
  react: ['react', 'React'], 'react-native': ['react', 'React Native'], next: ['nextjs', 'Next.js'],
  vue: ['vue', 'Vue'], nuxt: ['nuxtjs', 'Nuxt'], svelte: ['svelte', 'Svelte'], '@sveltejs/kit': ['svelte', 'SvelteKit'],
  astro: ['astro', 'Astro'], '@angular/core': ['angular', 'Angular'], gatsby: ['gatsby', 'Gatsby'],
  tailwindcss: ['tailwind', 'Tailwind'], sass: ['sass', 'Sass'], bootstrap: ['bootstrap', 'Bootstrap'],
  typescript: ['ts', 'TypeScript'], vite: ['vite', 'Vite'], webpack: ['webpack', 'webpack'],
  express: ['express', 'Express'], '@nestjs/core': ['nestjs', 'NestJS'], redux: ['redux', 'Redux'],
  '@reduxjs/toolkit': ['redux', 'Redux'], jest: ['jest', 'Jest'], vitest: ['vitest', 'Vitest'],
  three: ['threejs', 'Three.js'], electron: ['electron', 'Electron'], prisma: ['prisma', 'Prisma'],
  mongoose: ['mongodb', 'MongoDB'], mongodb: ['mongodb', 'MongoDB'], firebase: ['firebase', 'Firebase'],
  '@supabase/supabase-js': ['supabase', 'Supabase'], jquery: ['jquery', 'jQuery'], graphql: ['graphql', 'GraphQL'],
  'styled-components': ['styledcomponents', 'styled-components'], '@mui/material': ['materialui', 'MUI'],
  wrangler: ['cloudflare', 'Cloudflare'], '@astrojs/cloudflare': ['cloudflare', 'Cloudflare'],
  pg: ['postgres', 'PostgreSQL'], mysql2: ['mysql', 'MySQL'],
  '@anthropic-ai/sdk': ['', 'Claude API'], openai: ['', 'OpenAI API'],
};

async function packagesOf(repo) {
  try {
    const res = await fetch(`${API}/repos/${repo.full_name}/contents/package.json`, {
      headers: { ...headers, Accept: 'application/vnd.github.raw+json' },
    });
    if (!res.ok) return null;
    const pkg = JSON.parse(await res.text());
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch { return null; }
}

async function contributionsLastYear() {
  if (AUTH) {
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

const FW_COLORS = {
  React: '#61dafb', 'React Native': '#61dafb', 'Next.js': '#e6edf3', Nuxt: '#00dc82', SvelteKit: '#ff3e00',
  Angular: '#dd0031', Tailwind: '#38bdf8', Vite: '#bd34fe', Express: '#c9d1d9', Redux: '#764abc',
  Cloudflare: '#f38020', Firebase: '#ffca28', Supabase: '#3ecf8e', 'Claude API': '#d97757',
};
const COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c',
  Astro: '#ff5a03', Vue: '#41b883', Svelte: '#ff3e00', Python: '#3572A5', Shell: '#89e051',
  PowerShell: '#012456', Java: '#b07219', 'C#': '#178600', PHP: '#4F5D95', Go: '#00ADD8',
  Rust: '#dea584', MDX: '#fcb32c', Less: '#1d365d', Handlebars: '#f7931e', Dockerfile: '#384d54',
};
const colorOf = (lang) => COLORS[lang] || FW_COLORS[lang] || `hsl(${[...lang].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 60% 60%)`;
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

// "Built with AI" only looks at repos created since I started vibe coding
const conf = existsSync('tech.json') ? JSON.parse(readFileSync('tech.json', 'utf8')) : {};
const aiSince = new Date(conf.aiSince || 0).getTime();
const langTotals = {}, recentLangs = {}, recentPkgs = {};
const aiLangs = {}, aiPkgs = {};
let aiNode = false;
const commits = { pub: 0, priv: 0 };
const cutoff = Date.now() - RECENT_DAYS * 864e5;
for (const r of repos) {
  let langs = {};
  try { langs = await get(`/repos/${r.full_name}/languages`); } catch {}
  commits[r.private ? 'priv' : 'pub'] += await commitsIn(r);
  const recent = new Date(r.pushed_at) >= cutoff;
  const ai = new Date(r.created_at).getTime() >= aiSince;
  const pkgs = await packagesOf(r);
  if (pkgs && ai) aiNode = true;
  for (const p of pkgs || []) {
    if (!PKG_ICONS[p]) continue;
    const [, label] = PKG_ICONS[p];
    if (ai) aiPkgs[label] = (aiPkgs[label] || 0) + 1;
    if (recent) recentPkgs[label] = Math.max(recentPkgs[label] || 0, new Date(r.pushed_at).getTime());
  }
  for (const [lang, bytes] of Object.entries(langs)) {
    langTotals[lang] = (langTotals[lang] || 0) + bytes;
    if (recent) recentLangs[lang] = (recentLangs[lang] || 0) + bytes;
    if (ai) aiLangs[lang] = (aiLangs[lang] || 0) + bytes;
  }
}
const totalBytes = Object.values(langTotals).reduce((a, b) => a + b, 0) || 1;
let langs = Object.entries(langTotals).sort((a, b) => b[1] - a[1]);
if (langs.length > 8) {
  const rest = langs.slice(7).reduce((a, [, b]) => a + b, 0);
  langs = [...langs.slice(0, 7), ['Other', rest]];
}
const lately = [...new Set([
  ...Object.entries(recentPkgs).sort((a, b) => b[1] - a[1]).map(([l]) => l),
  ...Object.entries(recentLangs).sort((a, b) => b[1] - a[1]).map(([l]) => l),
])].slice(0, 8);

/* ---------------- README tech block ---------------- */
const hide = new Set([...(conf.hide || []), ...(conf.core || [])]);
const icons = [];
const add = (id) => { if (id && !hide.has(id) && !icons.includes(id)) icons.push(id); };
for (const [lang] of Object.entries(aiLangs).sort((a, b) => b[1] - a[1])) add(LANG_ICONS[lang]);
for (const [label] of Object.entries(aiPkgs).sort((a, b) => b[1] - a[1])) {
  add(Object.values(PKG_ICONS).find(([, l]) => l === label)?.[0]);
}
if (aiNode) add('nodejs');
if (existsSync('README.md')) {
  const readme = readFileSync('README.md', 'utf8');
  const block = icons.length ? `<!-- TECH:START -->
### 🤖 Built with AI

Tech from my projects that I built together with AI. I know the basics and learn the rest as I go.

<p align="center">
  <a href="https://skillicons.dev"><img src="https://skillicons.dev/icons?i=${icons.join(',')}&theme=dark&perline=10" alt="Tech: ${icons.join(', ')}"></a>
</p>
<!-- TECH:END -->` : '<!-- TECH:START -->\n<!-- TECH:END -->';
  const next = readme.replace(/<!-- TECH:START -->[\s\S]*?<!-- TECH:END -->/, block);
  if (next !== readme) writeFileSync('README.md', next);
}
const recent = pub
  .filter((r) => r.name.toLowerCase() !== USER.toLowerCase())
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, 4);
const stars = pub.reduce((a, r) => a + r.stargazers_count, 0);
const contrib = await contributionsLastYear();

/* ---------------- render ---------------- */
const W = 800, H = 408, SHIFT = 56;
const tiles = [
  [fmt(pub.length), 'public repos'],
  [TOKEN ? fmt(priv.length) : '—', 'private repos 🔒'],
  [fmt(commits.pub), 'commits · public'],
  [TOKEN ? fmt(commits.priv) : '—', 'commits · private 🔒'],
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
<rect class="cur" x="${32 + (USER.length + 26) * 7.45 + 4}" y="25" width="7" height="14" fill="#a371f7"/>
<line x1="24" y1="52" x2="${W - 24}" y2="52" stroke="#2f2a52"/>
${tileSvg}
<text class="h" x="${BX}" y="70">Languages</text>
<clipPath id="bar"><rect x="${BX}" y="80" width="${BW}" height="10" rx="5"/></clipPath>
<g clip-path="url(#bar)"><rect x="${BX}" y="80" width="${BW}" height="10" fill="#2f2a52"/>${barSvg}</g>
${legendSvg}
<g transform="translate(0 ${SHIFT})">
<line x1="24" y1="212" x2="${W - 24}" y2="212" stroke="#2f2a52"/>
<text class="h" x="32" y="234">Recently pushed</text>
${recentSvg}
<text class="h" x="${BX}" y="234">Lately using</text>
${chipSvg}
</g>
<text class="dim" x="${W - 24}" y="${H - 16}" text-anchor="end" font-size="10">${TOKEN ? 'incl. private repos (numbers only)' : 'public repos'} · updated ${today}</text>
</svg>
`;

mkdirSync('assets', { recursive: true });
writeFileSync('assets/stats.svg', svg);
console.log(`stats.svg: ${pub.length} public, ${priv.length} private, commits ${commits.pub}/${commits.priv}, ${langs.length} langs, lately: ${lately.join(', ') || '—'}, icons: ${icons.join(',')}, contributions: ${contrib}`);
