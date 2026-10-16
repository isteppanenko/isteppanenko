// Generates the animated header and the "coder at the desk" scene.
// Run once after editing the texts below:  node scripts/build-art.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const NAME = 'Ihor';
const PHRASES = [
  `Hi, I'm ${NAME}`,
  'Frontend: JavaScript · React',
  'Base from GoIT courses',
  'Now: vibe coding with AI',
  'Solid basics → faster builds',
];
const CODE = [
  [['k', 'const '], ['v', 'dev'], ['p', ' = {']],
  [['p', '  '], ['a', 'name'], ['p', ': '], ['s', `"${NAME}"`], ['p', ',']],
  [['p', '  '], ['a', 'base'], ['p', ': ['], ['s', '"HTML"'], ['p', ', '], ['s', '"CSS"'], ['p', ', '], ['s', '"JS"'], ['p', ', '], ['s', '"React"'], ['p', '],']],
  [['p', '  '], ['a', 'school'], ['p', ': '], ['s', '"GoIT"'], ['p', ',']],
  [['p', '  '], ['a', 'now'], ['p', ': '], ['s', '"vibe coding + AI"'], ['p', ',']],
  [['p', '};']],
  [],
  [['v', 'dev'], ['p', '.'], ['f', 'build'], ['p', '();  '], ['c', '// faster, with AI']],
];
const TERMINAL = '$ npm run dev';
const TERMINAL_OK = '✓ ready';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r = (n) => +n.toFixed(4);
const kt = (times, D) => times.map((t) => r(t / D)).join(';');

/* ---------------- header: typing phrases ---------------- */
function header() {
  const W = 800, H = 64, CW = 15, FS = 25, Y = 42;
  const tl = []; // [t, width, phraseIndex]
  let t = 0.3;
  const parts = PHRASES.map((p, i) => {
    const n = [...p].length, w = n * CW;
    const s = t, typed = s + n * 0.075, held = typed + 1.9, erased = held + n * 0.025;
    t = erased + 0.35;
    return { p, n, w, x: (W - w) / 2, s, typed, held, erased, i };
  });
  const D = r(t);
  const texts = parts.map(({ p, w, x, s, typed, held, erased, i }) => {
    const times = [0, s, typed, held, erased, D];
    return `
  <clipPath id="c${i}"><rect x="${x}" y="0" height="${H}" width="0">
    <animate attributeName="width" dur="${D}s" repeatCount="indefinite" keyTimes="${kt(times, D)}" values="0;0;${w};${w};0;0"/>
  </rect></clipPath>
  <text x="${x}" y="${Y}" textLength="${w}" lengthAdjust="spacingAndGlyphs" clip-path="url(#c${i})">${esc(p)}</text>`;
  });
  // cursor follows the edge of the currently typed phrase
  const ct = [0], cx = [parts[0].x];
  for (const q of parts) {
    ct.push(q.s, q.typed, q.held, q.erased);
    cx.push(q.x, q.x + q.w, q.x + q.w, q.x);
    const next = parts[q.i + 1];
    if (next) { ct.push(q.erased); cx.push(next.x); }
  }
  ct.push(D); cx.push(parts[0].x);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(PHRASES.join(' · '))}">
  <style>
    text { font: 600 ${FS}px 'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace; fill: #a371f7; }
    .cur { fill: #a371f7; animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  </style>${texts.join('')}
  <rect class="cur" x="${parts[0].x}" y="${Y - 24}" width="3" height="30">
    <animate attributeName="x" dur="${D}s" repeatCount="indefinite" keyTimes="${kt(ct, D)}" values="${cx.map(r).join(';')}"/>
  </rect>
</svg>
`;
}

/* ---------------- scene: coder at the desk ---------------- */
function scene() {
  const CW = 6, X0 = 394, Y0 = 114, LH = 15, CPS = 0.055;
  let t = 0.6;
  const ct = [0], cx = [X0], cy = [Y0];
  const lines = CODE.map((segs, i) => {
    const text = segs.map((s) => s[1]).join('');
    const n = [...text].length, w = n * CW, y = Y0 + i * LH;
    const s = t, e = s + Math.max(n, 1) * CPS;
    ct.push(s, s, e); cx.push(cx.at(-1), X0, X0 + w); cy.push(cy.at(-1), y, y);
    t = e + (n ? 0.28 : 0.1);
    return { segs, n, w, y, s, e, i };
  });
  // terminal line
  const TY = 249, TX = 380, tn = [...TERMINAL].length, tw = tn * CW;
  const ts = t + 0.3, te = ts + tn * 0.07, okAt = te + 0.7;
  ct.push(ts, ts, te); cx.push(cx.at(-1), TX, TX + tw); cy.push(cy.at(-1), TY, TY);
  const holdEnd = okAt + 3.2, fadeEnd = holdEnd + 0.5, D = r(fadeEnd + 0.4);
  ct.push(D); cx.push(cx.at(-1)); cy.push(cy.at(-1));
  // last keyframe back to start so the loop restarts cleanly (hidden by fade)
  ct.push(D); cx.push(X0); cy.push(Y0);

  const codeLines = lines.map(({ segs, n, w, y, s, e, i }) => {
    if (!n) return '';
    const tspans = segs.map(([c, s]) => `<tspan class="${c}">${esc(s)}</tspan>`).join('');
    return `
      <clipPath id="l${i}"><rect x="${X0}" y="${y - 11}" height="15" width="0">
        <animate attributeName="width" dur="${D}s" repeatCount="indefinite" keyTimes="${kt([0, s, e, D], D)}" values="0;0;${w};${w}"/>
      </rect></clipPath>
      <text xml:space="preserve" x="${X0}" y="${y}" textLength="${w}" lengthAdjust="spacingAndGlyphs" clip-path="url(#l${i})">${tspans}</text>`;
  }).join('');
  const gutter = lines.map(({ y, i }) => `<text class="ln" x="386" y="${y}" text-anchor="end">${i + 1}</text>`).join('');
  const fade = `<animate attributeName="opacity" dur="${D}s" repeatCount="indefinite" keyTimes="${kt([0, holdEnd, fadeEnd, D], D)}" values="1;1;0;0"/>`;
  const okShow = `<animate attributeName="opacity" dur="${D}s" repeatCount="indefinite" keyTimes="${kt([0, okAt, okAt + 0.15, D], D)}" values="0;0;1;1"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420" role="img" aria-label="Animated illustration: a developer in headphones types code at a desk at night, a small dog wags its tail next to the keyboard">
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1638"/><stop offset="1" stop-color="#110d22"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a42"/><stop offset="1" stop-color="#3b2a66"/></linearGradient>
  <linearGradient id="deskf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2042"/><stop offset="1" stop-color="#140f24"/></linearGradient>
  <radialGradient id="screenGlow"><stop offset="0" stop-color="#58a6ff" stop-opacity=".35"/><stop offset="1" stop-color="#58a6ff" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonGlow"><stop offset="0" stop-color="#f8e7b5" stop-opacity=".45"/><stop offset="1" stop-color="#f8e7b5" stop-opacity="0"/></radialGradient>
  <filter id="neon" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="win"><rect x="44" y="44" width="142" height="122"/></clipPath>
</defs>
<style>
  * { transform-box: view-box; }
  .code text { font: 10px 'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace; }
  .k { fill: #ff7b72 } .v { fill: #ffa657 } .p { fill: #c9d1d9 } .a { fill: #79c0ff } .s { fill: #a5d6ff }
  .n { fill: #79c0ff } .f { fill: #d2a8ff } .c { fill: #8b949e; font-style: italic }
  .ln { fill: #484f58; font: 9px Consolas, monospace }
  .term { fill: #c9d1d9 } .ok { fill: #3fb950 }
  .ui { font: 9px 'Segoe UI', Helvetica, Arial, sans-serif; fill: #8b949e }
  .cur { animation: blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0 } }

  .head { transform-origin: 232px 206px; animation: bob .9s ease-in-out infinite; }
  @keyframes bob { 0%,100% { transform: rotate(0) } 50% { transform: rotate(4deg) translateY(1px) } }
  .hl { animation: tap .2s ease-in-out infinite alternate; }
  .hr { animation: tap .26s ease-in-out infinite alternate-reverse; }
  @keyframes tap { from { transform: translateY(0) } to { transform: translateY(-2.5px) } }

  .star { animation: twinkle 3s ease-in-out infinite; }
  .s2 { animation-delay: -.7s } .s3 { animation-delay: -1.4s } .s4 { animation-delay: -2.1s } .s5 { animation-delay: -2.6s }
  @keyframes twinkle { 0%,100% { opacity: 1 } 50% { opacity: .15 } }

  .steam { stroke: #c9d1d9; stroke-width: 2; fill: none; stroke-linecap: round; opacity: 0; animation: steam 3s ease-out infinite; }
  .st2 { animation-delay: 1s } .st3 { animation-delay: 2s }
  @keyframes steam { 0% { opacity: 0; transform: translateY(6px) } 30% { opacity: .55 } 100% { opacity: 0; transform: translateY(-18px) } }

  .note { opacity: 0; animation: note 3.6s ease-out infinite; }
  .n2 { animation-delay: 1.8s }
  @keyframes note { 0% { opacity: 0; transform: translate(0,0) } 20% { opacity: 1 } 100% { opacity: 0; transform: translate(26px,-50px) rotate(15deg) } }

  .tail { transform-origin: 66px 284px; animation: wag .35s ease-in-out infinite alternate; }
  @keyframes wag { from { transform: rotate(-18deg) } to { transform: rotate(16deg) } }
  .dhead { transform-origin: 124px 284px; animation: tilt 5s ease-in-out infinite; }
  @keyframes tilt { 0%,40%,100% { transform: rotate(0) } 50%,70% { transform: rotate(-9deg) } }
  .ear { transform-origin: 120px 262px; animation: flop 5s ease-in-out infinite; }
  @keyframes flop { 0%,40%,100% { transform: rotate(0) } 50%,70% { transform: rotate(8deg) } }
  .heart { opacity: 0; font: 12px 'Segoe UI Symbol', Arial, sans-serif; fill: #ff79c6; animation: heart 5s ease-out infinite 1s; }
  @keyframes heart { 0% { opacity: 0; transform: translate(0,0) } 15% { opacity: 1 } 45%,100% { opacity: 0; transform: translate(6px,-30px) } }

  .leaf { transform-origin: 752px 278px; animation: sway 5s ease-in-out infinite; }
  @keyframes sway { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }

  .neon { animation: flicker 6s linear infinite; }
  @keyframes flicker { 0%,18%,22%,60%,100% { opacity: 1 } 19%,21% { opacity: .25 } 61% { opacity: .5 } }

  .led { animation: rgb 6s linear infinite; }
  @keyframes rgb { 0%,100% { stroke: #ff79c6 } 33% { stroke: #8be9fd } 66% { stroke: #a371f7 } }

  .glow { animation: pulse 4s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: .8 } 50% { opacity: 1 } }

  @media (prefers-reduced-motion: reduce) { * { animation: none !important } }
</style>

<!-- room -->
<rect width="800" height="420" fill="url(#wall)"/>
<polygon points="44,166 186,166 250,300 60,300" fill="#8a7fd1" opacity=".05"/>

<!-- window -->
<g clip-path="url(#win)">
  <rect x="44" y="44" width="142" height="122" fill="url(#sky)"/>
  <circle cx="150" cy="76" r="40" fill="url(#moonGlow)"/>
  <circle cx="150" cy="76" r="15" fill="#f8e7b5"/>
  <circle cx="157" cy="70" r="13" fill="#17204a"/>
  <circle class="star" cx="70" cy="62" r="1.6" fill="#fff"/>
  <circle class="star s2" cx="102" cy="88" r="1.2" fill="#fff"/>
  <circle class="star s3" cx="62" cy="120" r="1.4" fill="#fff"/>
  <circle class="star s4" cx="118" cy="132" r="1.1" fill="#fff"/>
  <circle class="star s5" cx="172" cy="118" r="1.5" fill="#fff"/>
  <path d="M44 166 L44 150 Q60 140 76 148 Q92 136 110 146 Q128 138 146 150 Q166 140 186 150 L186 166 Z" fill="#0c0a1c"/>
  <rect x="58" y="152" width="4" height="5" fill="#ffd27a" opacity=".8"/><rect x="128" y="154" width="4" height="4" fill="#ffd27a" opacity=".7"/>
</g>
<rect x="41" y="41" width="148" height="128" fill="none" stroke="#2f2a52" stroke-width="6" rx="3"/>
<path d="M115 44 V166 M44 105 H186" stroke="#2f2a52" stroke-width="4"/>

<!-- neon sign -->
<g class="neon" filter="url(#neon)">
  <text x="730" y="118" text-anchor="middle" font-family="Consolas, 'Courier New', monospace" font-size="38" font-weight="700" fill="none" stroke="#ff79c6" stroke-width="2">&lt;/&gt;</text>
</g>

<!-- screen glow -->
<ellipse class="glow" cx="510" cy="175" rx="230" ry="140" fill="url(#screenGlow)"/>

<!-- monitor -->
<rect x="497" y="268" width="26" height="26" fill="#1a1b2b"/>
<rect x="466" y="292" width="88" height="8" rx="4" fill="#23243a"/>
<rect x="362" y="70" width="296" height="200" rx="10" fill="#0b0c14" stroke="#2f3150" stroke-width="2"/>
<rect x="370" y="78" width="280" height="184" rx="3" fill="#0d1117"/>
<rect x="370" y="78" width="280" height="16" rx="3" fill="#161b22"/>
<circle cx="380" cy="86" r="3" fill="#ff5f56"/><circle cx="390" cy="86" r="3" fill="#ffbd2e"/><circle cx="400" cy="86" r="3" fill="#27c93f"/>
<rect x="412" y="80" width="46" height="14" rx="2" fill="#0d1117"/>
<text class="ui" x="420" y="90">dev.js</text>
<g class="code">
  ${gutter}
  <g>
    ${fade}
    ${codeLines}
    <rect x="370" y="232" width="280" height="30" fill="#161b22"/>
    <text class="ui" x="378" y="241" font-size="7">TERMINAL</text>
    <clipPath id="tc"><rect x="${TX}" y="${TY - 11}" height="15" width="0">
      <animate attributeName="width" dur="${D}s" repeatCount="indefinite" keyTimes="${kt([0, ts, te, D], D)}" values="0;0;${tw};${tw}"/>
    </rect></clipPath>
    <text class="term" x="${TX}" y="${TY}" textLength="${tw}" lengthAdjust="spacingAndGlyphs" clip-path="url(#tc)">${esc(TERMINAL)}</text>
    <text class="ok" x="${TX + tw + 14}" y="${TY}" opacity="0">${esc(TERMINAL_OK)}${okShow}</text>
    <g class="cur"><rect width="1.6" height="11" fill="#e6edf3">
      <animate attributeName="x" dur="${D}s" repeatCount="indefinite" keyTimes="${kt(ct, D)}" values="${cx.map(r).join(';')}"/>
      <animate attributeName="y" dur="${D}s" repeatCount="indefinite" keyTimes="${kt(ct, D)}" values="${cy.map((v) => v - 9).join(';')}"/>
    </rect></g>
  </g>
</g>

<!-- desk -->
<rect x="0" y="300" width="800" height="120" fill="url(#deskf)"/>
<rect x="0" y="298" width="800" height="8" fill="#3a2e5c"/>
<line class="led" x1="0" y1="309" x2="800" y2="309" stroke="#ff79c6" stroke-width="2" filter="url(#neon)"/>

<!-- keyboard -->
<rect x="312" y="291" width="104" height="9" rx="2" fill="#262840"/>
<path d="M318 294 H410 M318 297 H410" stroke="#3b3e5e" stroke-width="1" stroke-dasharray="4 2"/>

<!-- coffee -->
<g transform="translate(0 0)">
  <path class="steam" d="M686 262 q-4 -6 0 -12 q4 -6 0 -12"/>
  <path class="steam st2" d="M694 262 q-4 -6 0 -12 q4 -6 0 -12"/>
  <path class="steam st3" d="M702 262 q-4 -6 0 -12 q4 -6 0 -12"/>
  <rect x="680" y="268" width="28" height="30" rx="4" fill="#e6edf3"/>
  <path d="M708 275 q11 0 11 9 q0 9 -11 9" stroke="#e6edf3" stroke-width="4" fill="none"/>
  <text x="694" y="287" text-anchor="middle" font-family="Consolas, monospace" font-size="9" font-weight="700" fill="#a371f7">&lt;/&gt;</text>
</g>

<!-- plant -->
<g class="leaf">
  <path d="M752 278 Q732 252 738 232 Q752 252 752 278" fill="#3fb950"/>
  <path d="M752 278 Q770 250 768 230 Q752 252 752 278" fill="#2ea043"/>
  <path d="M752 278 Q750 246 758 222 Q760 252 752 278" fill="#56d364"/>
</g>
<path d="M738 276 H766 L762 300 H742 Z" fill="#8957e5"/>

<!-- dog -->
<g>
  <g class="tail"><path d="M66 284 Q54 278 52 264" stroke="#d99a55" stroke-width="7" fill="none" stroke-linecap="round"/></g>
  <ellipse cx="92" cy="286" rx="30" ry="13" fill="#e8ad68"/>
  <ellipse cx="72" cy="294" rx="10" ry="5" fill="#d99a55"/>
  <ellipse cx="114" cy="289" rx="9" ry="8" fill="#fff4e6"/>
  <ellipse cx="126" cy="296" rx="8" ry="3.6" fill="#fff4e6"/>
  <ellipse cx="136" cy="297" rx="7" ry="3.4" fill="#fff4e6"/>
  <g class="dhead">
    <circle cx="126" cy="270" r="15" fill="#e8ad68"/>
    <ellipse cx="138" cy="277" rx="9" ry="6.5" fill="#fff4e6"/>
    <circle cx="146" cy="274" r="2.6" fill="#2a1d17"/>
    <path d="M140 281 q3 2 6 0" stroke="#2a1d17" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="141" cy="284" rx="2.4" ry="3.2" fill="#ff7b9c"/>
    <circle cx="131" cy="266" r="2.3" fill="#2a1d17"/><circle cx="131.8" cy="265.2" r=".7" fill="#fff"/>
    <g class="ear"><path d="M114 258 Q108 262 109 276 Q116 278 121 262 Z" fill="#b8763a"/></g>
  </g>
  <text class="heart" x="140" y="252">♥</text>
</g>

<!-- developer (3/4 back view) -->
<ellipse cx="268" cy="190" rx="46" ry="70" fill="#58a6ff" opacity=".08"/>
<path d="M150 330 C150 258 176 222 232 218 C286 222 306 250 312 286 L318 330 Z" fill="#5b4b8a"/>
<ellipse cx="228" cy="220" rx="36" ry="12" fill="#4a3c74"/>
<rect x="223" y="198" width="18" height="20" fill="#c98f6b"/>
<g class="head">
  <rect x="190" y="160" width="11" height="24" rx="5" fill="#1c1c2b"/>
  <circle cx="234" cy="177" r="29" fill="#e0a982"/>
  <circle cx="226" cy="172" r="30" fill="#2a1d17"/>
  <path d="M206 150 q8 -14 20 -8 q6 -12 18 -4 q10 -2 12 8 q-26 -6 -50 4 Z" fill="#2a1d17"/>
  <ellipse cx="256" cy="181" rx="4.5" ry="7" fill="#d4996f"/>
  <path d="M197 170 A31 31 0 0 1 258 162" stroke="#4b4e73" stroke-width="6" fill="none" stroke-linecap="round"/>
  <rect x="250" y="164" width="15" height="26" rx="7" fill="#ff79c6"/>
  <rect x="254" y="169" width="7" height="16" rx="3.5" fill="#c74f9a"/>
  <text class="note" x="268" y="160" font-size="14" fill="#8be9fd">♪</text>
  <text class="note n2" x="268" y="160" font-size="12" fill="#ff79c6">♫</text>
</g>
<!-- chair -->
<rect x="156" y="250" width="152" height="180" rx="24" fill="#1e1f36"/>
<rect x="210" y="258" width="44" height="172" rx="10" fill="#ff79c6" opacity=".55"/>
<!-- arms & hands -->
<path d="M292 240 Q318 270 332 290" stroke="#5b4b8a" stroke-width="18" fill="none" stroke-linecap="round"/>
<path d="M286 250 Q300 278 316 292" stroke="#4a3c74" stroke-width="15" fill="none" stroke-linecap="round"/>
<ellipse class="hl" cx="322" cy="292" rx="7" ry="4.5" fill="#d4996f"/>
<ellipse class="hr" cx="340" cy="291" rx="7.5" ry="5" fill="#e0a982"/>
</svg>
`;
}

mkdirSync('assets', { recursive: true });
writeFileSync('assets/header.svg', header());
writeFileSync('assets/coder.svg', scene());
console.log('assets/header.svg, assets/coder.svg written');
