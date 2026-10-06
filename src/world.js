// =====================================================================
//  NIVEL + TERRENO + PARALLAX
// =====================================================================
const GW = 960, GH = 540;

const LEVEL = {
  length: 6400,
  ground: [[-200, 470], [560, 470], [660, 452], [880, 452], [980, 470], [1500, 470], [1560, 478], [2500, 478], [2600, 480], [3600, 480],
    [3700, 452], [3900, 432], [4050, 432], [4200, 466], [4500, 466], [4650, 430], [4850, 430], [5000, 470], [5300, 480], [7000, 480]],
  buildings: [{ x: 1220, w: 230, h: 118, seed: 1 }, { x: 1690, w: 210, h: 138, seed: 2 }, { x: 5560, w: 260, h: 170, seed: 3, bg: true }, { x: 5980, w: 220, h: 130, seed: 4, bg: true }],
  ledges: [{ x1: 2040, x2: 2200, y: 392 }, { x1: 4270, x2: 4370, y: 350, tower: true }],
  decor: [
    ['palm', 70], ['bush', 260], ['palm2', 430], ['palm', 900], ['bush', 1010], ['palm2', 1600], ['bush', 1990], ['palm', 2470], ['palm2', 2560],
    ['bush', 3100], ['palm', 3480], ['palm2', 3640], ['bush', 3980], ['palm', 4130], ['palm2', 4560], ['bush', 4900], ['palm', 5160], ['palm2', 5330],
  ],
  fg: [300, 1100, 1850, 2700, 3400, 4250, 5050, 5700, 6250],
  sandbags: [760, 2660, 3010, 4390, 5480],
  crates: [[600, 'B'], [1950, 'medal'], [2860, 'food'], [3880, 'S'], [4620, 'medal']],
  barrels: [1180, 1545, 2310, 2930, 3330, 4790],
  pows: [[1080, 'H'], [2390, 'B'], [4450, 'H']],
  // eventos: se disparan cuando el borde derecho de la cámara pasa "at"
  events: [
    { at: 900, spawn: [['rifle', 1010, 'idle'], ['rifle', 1160, 'idle']] },
    { at: 1250, spawn: [['grenadier', 1330, 'idle', 'roof0'], ['rifle', 1490, 'idle']] },
    { at: 1500, spawn: [['rifle', 1560, 'para'], ['rifle', 1700, 'para']] },
    { at: 1850, spawn: [['knife', 'R', 'run'], ['knife', 'R', 'run', null, 0.7]] },
    { at: 2000, spawn: [['rifle', 1790, 'idle', 'roof1'], ['rifle', 2130, 'idle', 'ledge0'], ['rifle', 2270, 'idle']] },
    { at: 2450, spawn: [['rifle', 'R', 'run'], ['grenadier', 2520, 'idle'], ['rifle', 'R', 'run', null, 1.0]] },
    { at: 3560, lock: 2600, boss: 'tank' },
    { at: 3800, spawn: [['rifle', 3800, 'idle'], ['rifle', 3960, 'idle'], ['grenadier', 4030, 'idle']] },
    { at: 4150, heli: true },
    { at: 4330, spawn: [['knife', 'R', 'run'], ['rifle', 4320, 'idle', 'ledge1'], ['knife', 'R', 'run', null, 0.8]] },
    { at: 4750, spawn: [['rifle', 4800, 'idle'], ['rifle', 4900, 'idle'], ['grenadier', 5010, 'idle'], ['rifle', 5050, 'para']] },
    { at: 5250, spawn: [['knife', 'R', 'run'], ['rifle', 'R', 'run', null, 0.6]] },
    { at: 6360, lock: 5400, boss: 'walker' },
  ],
};

class World {
  constructor(scene) {
    this.scene = scene; this.pts = LEVEL.ground; this.length = LEVEL.length;
    this.platforms = []; this.solids = []; this.named = {};
  }
  groundY(x) {
    const P = this.pts;
    if (x <= P[0][0]) return P[0][1];
    let lo = 0, hi = P.length - 1;
    if (x >= P[hi][0]) return P[hi][1];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= x) lo = m; else hi = m; }
    const a = P[lo], b = P[hi];
    return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }
  // superficie más alta en x que esté por debajo (o a la altura) de y
  floorAt(x, y, drop = false, hw = 0) {
    let best = this.groundY(x);
    if (!drop) for (const p of this.platforms) if (x >= p.x1 && x <= p.x2 && p.y >= y - 1 && p.y < best) best = p.y;
    for (const s of this.solids) if (!s.dead && x + hw > s.x && x - hw < s.x + s.w && s.y >= y - 1 && s.y < best) best = s.y;
    return best;
  }
  onPlatform(x, y) { return this.platforms.some(p => x >= p.x1 && x <= p.x2 && Math.abs(p.y - y) < 2); }

  build() {
    const sc = this.scene;
    // ---- fondo parallax
    sc.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(-100);
    this.bg = [
      [sc.add.tileSprite(0, 20, GW, 260, 'clouds'), 0.04, 1],
      [sc.add.tileSprite(0, 200, GW, 300, 'bg_mount'), 0.12, 0],
      [sc.add.tileSprite(0, 250, GW, 260, 'bg_hills'), 0.28, 0],
      [sc.add.tileSprite(0, 300, GW, 240, 'bg_near'), 0.5, 0],
    ];
    this.bg.forEach(([ts], i) => ts.setOrigin(0).setScrollFactor(0).setDepth(-95 + i));
    // ---- terreno horneado en trozos
    const CH = 512, TOP = 380, R = mulberry(77), feats = [];
    for (let x = -100; x < this.length + 700; x += 18 + R() * 30) feats.push({ x, t: R() < 0.22 ? 'rock' : R() < 0.75 ? 'tuft' : 'flower', s: 0.6 + R() * 0.8, d: 14 + R() * 60, r: R() });
    for (let i = -1; i * CH < this.length + 700; i++) {
      const x0 = i * CH, key = 'ter' + i;
      mkCanvas(sc, key, CH + 2, GH - TOP, c => { c.translate(-x0, -TOP); this.drawTerrain(c, x0 - 20, x0 + CH + 20, feats); });
      sc.add.image(x0, TOP, key).setOrigin(0).setDepth(10);
    }
    // ---- edificios (los techos son plataformas)
    LEVEL.buildings.forEach((b, i) => {
      const gy = Math.max(this.groundY(b.x), this.groundY(b.x + b.w));
      const key = 'bld' + i;
      mkCanvas(sc, key, b.w + 8, b.h + 30, c => drawBuilding(c, b.w, b.h, mulberry(b.seed * 31), b.bg));
      sc.add.image(b.x - 4, gy + 12, key).setOrigin(0, 1).setDepth(b.bg ? 4 : 6);
      if (!b.bg) { const p = { x1: b.x + 4, x2: b.x + b.w - 4, y: gy - b.h }; this.platforms.push(p); this.named['roof' + i] = p; }
    });
    LEVEL.ledges.forEach((l, i) => {
      const gy = this.groundY((l.x1 + l.x2) / 2), h = gy - l.y + 10, w = l.x2 - l.x1;
      const key = 'ledge' + i;
      mkCanvas(sc, key, w + 8, h + 30, c => drawLedge(c, w, h, l.tower));
      sc.add.image(l.x1 - 4, l.y - (l.tower ? 30 : 6), key).setOrigin(0).setDepth(6);
      const p = { x1: l.x1, x2: l.x2, y: l.y }; this.platforms.push(p); this.named['ledge' + i] = p;
    });
    // ---- decorado
    LEVEL.decor.forEach(([k, x]) => { const im = img(sc, x, this.groundY(x) + 4, k).setDepth(5); if (k === 'bush') im.setTint(0xb0a0a0); });
    LEVEL.sandbags.forEach(x => img(sc, x, this.groundY(x) + 3, 'sandbags').setDepth(30));
    // follaje de primer plano (parallax > 1)
    this.fg = LEVEL.fg.map((x, i) => { const im = img(sc, x, GH + 20, 'fg_leaves').setDepth(95).setScrollFactor(1.25, 1); if (i % 2) im.setFlipX(true); return im; });
  }

  drawTerrain(c, xa, xb, feats) {
    const step = 8;
    const path = () => {
      c.beginPath(); c.moveTo(xa, GH + 10);
      for (let x = xa; x <= xb; x += step) c.lineTo(x, this.groundY(x));
      c.lineTo(xb, this.groundY(xb)); c.lineTo(xb, GH + 10); c.closePath();
    };
    path();
    c.fillStyle = lg(c, 0, 420, 0, GH, [[0, '#7a5534'], [0.35, '#5a3a24'], [1, '#2a1812']]); c.fill();
    c.save(); path(); c.clip();
    // estratos
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      for (let x = xa; x <= xb; x += step) { const y = this.groundY(x) + 22 + k * 15 + Math.sin(x * 0.013 + k * 2) * 4; x === xa ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.lineWidth = 2; c.strokeStyle = 'rgba(30,15,10,0.25)'; c.stroke();
    }
    for (const f of feats) {
      if (f.x < xa - 40 || f.x > xb + 40) continue;
      if (f.t === 'rock') {
        const y = this.groundY(f.x) + f.d;
        c.beginPath(); c.ellipse(f.x, y, 9 * f.s, 6 * f.s, f.r, 0, 7); fs(c, lg(c, 0, y - 6, 0, y + 6, [[0, '#9a8068'], [1, '#4a3628']]), 1.6);
      }
    }
    c.restore();
    // capa de hierba + borde iluminado por el atardecer
    c.beginPath();
    for (let x = xa; x <= xb; x += step) { const y = this.groundY(x); x === xa ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.lineWidth = 12; c.strokeStyle = '#3e5a26'; c.stroke();
    c.lineWidth = 5; c.strokeStyle = '#6e8c34'; c.translate(0, -3); c.stroke(); c.translate(0, 3);
    c.lineWidth = 2; c.strokeStyle = '#e8b060'; c.translate(0, -6); c.stroke(); c.translate(0, 6);
    c.lineWidth = 2.5; c.strokeStyle = '#1e2a12'; c.translate(0, 7); c.stroke(); c.translate(0, -7);
    for (const f of feats) {
      if (f.x < xa - 20 || f.x > xb + 20) continue;
      const y = this.groundY(f.x) - 3;
      if (f.t === 'tuft') {
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(f.x + k * 2.5, y + 2); c.quadraticCurveTo(f.x + k * 3, y - 6 * f.s, f.x + k * 4.5, y - 10 * f.s); c.lineWidth = 2; c.strokeStyle = k % 2 ? '#4a6a2a' : '#7a9a3a'; c.stroke(); }
      } else if (f.t === 'flower') {
        line(c, f.x, y + 2, f.x + 1, y - 8, 1.5, '#4a6a2a');
        c.beginPath(); c.arc(f.x + 1, y - 9, 2.4, 0, 7); c.fillStyle = f.r > 0.5 ? '#f2d04a' : '#e86a8a'; c.fill();
      }
    }
  }

  updateParallax(cam, t) {
    for (const [ts, k, drift] of this.bg) ts.tilePositionX = cam.scrollX * k + (drift ? t * 0.006 : 0);
  }
}

function drawBuilding(c, w, h, R, bg) {
  const X = 4, top = 18, bot = top + h;
  const wall = bg ? '#8a6a5a' : '#c49a6a';
  // silueta con techo roto
  c.beginPath(); c.moveTo(X, bot + 10); c.lineTo(X, top + 8);
  c.lineTo(X + w, top + 8); c.lineTo(X + w, bot + 10); c.closePath();
  fs(c, lg(c, 0, top, 0, bot, [[0, shade(wall, 0.1)], [1, shade(wall, -0.35)]]), 2.6);
  c.save(); c.clip();
  // ladrillos expuestos
  for (let i = 0; i < 4; i++) {
    const bx = X + R() * (w - 50), by = top + 20 + R() * (h - 50), bw = 30 + R() * 30, bh = 20 + R() * 16;
    c.beginPath(); c.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, R(), 0, 7); c.fillStyle = shade(wall, -0.25); c.fill();
    c.save(); c.clip();
    for (let yy = by; yy < by + bh; yy += 6) for (let xx = bx + ((yy / 6) % 2) * 6; xx < bx + bw; xx += 12) { c.fillStyle = '#a0583a'; c.fillRect(xx, yy, 10, 4.5); }
    c.restore();
  }
  // ventanas
  const cols = Math.max(2, Math.floor(w / 62)), rows = Math.max(1, Math.floor((h - 50) / 50));
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const wx = X + (k + 0.5) * w / cols - 13, wy = top + 30 + r * 50;
    c.beginPath(); rr(c, wx, wy, 26, 30, 3); fs(c, R() > 0.3 ? '#2a1a24' : '#f0a050', 2);
    line(c, wx - 3, wy + 31, wx + 29, wy + 31, 3, shade(wall, -0.4));
    if (R() > 0.5) { c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx - 10, wy + 4); c.lineTo(wx - 10, wy + 28); c.lineTo(wx, wy + 30); fs(c, '#5a7a8a', 1.6); }
  }
  // puerta
  const dx = X + w * (0.3 + R() * 0.4);
  c.beginPath(); c.moveTo(dx, bot + 10); c.lineTo(dx, bot - 36); c.quadraticCurveTo(dx + 15, bot - 46, dx + 30, bot - 36); c.lineTo(dx + 30, bot + 10); fs(c, '#1e1418', 2);
  // agujeros de bala y grietas
  for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(X + R() * w, top + 14 + R() * h, 1.6 + R() * 1.8, 0, 7); c.fillStyle = 'rgba(30,15,15,0.7)'; c.fill(); }
  for (let i = 0; i < 3; i++) {
    let x = X + R() * w, y = top + 10; c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 16; y += 6 + R() * 10; c.lineTo(x, y); }
    c.lineWidth = 1.4; c.strokeStyle = 'rgba(40,20,20,0.6)'; c.stroke();
  }
  c.fillStyle = 'rgba(255,150,80,0.14)'; c.fillRect(X + w * 0.6, top, w * 0.4, h + 20); // luz cálida lateral
  c.restore();
  // losa del techo (plataforma) con bordes rotos
  c.beginPath(); c.moveTo(X - 2, top + 12);
  for (let k = 0; k <= 10; k++) c.lineTo(X - 2 + (w + 4) * k / 10, top + (k % 3 === 0 ? 2 : 0));
  c.lineTo(X + w + 2, top + 12); c.closePath();
  fs(c, lg(c, 0, top, 0, top + 12, [[0, '#b8aa98'], [1, '#6a5c50']]), 2.4);
  // varillas sueltas
  for (let i = 0; i < 3; i++) { const x = X + 10 + R() * (w - 20); line(c, x, top + 2, x + (R() - 0.5) * 10, top - 14 - R() * 10, 1.6, '#4a3a34'); }
}
function drawLedge(c, w, h, tower) {
  const X = 4, top = tower ? 30 : 6;
  // postes
  for (const px of tower ? [X + 6, X + w - 10] : [X + 10, X + w / 2 - 4, X + w - 18]) {
    c.beginPath(); rr(c, px, top + 6, 8, h, 2); fs(c, lg(c, px, 0, px + 8, 0, [[0, '#8a5a30'], [1, '#3a2010']]), 2);
  }
  if (tower) {
    line(c, X + 10, top + 20, X + w - 6, top + h - 10, 3, '#6a4220'); line(c, X + w - 6, top + 20, X + 10, top + h - 10, 3, '#6a4220');
    // techito
    c.beginPath(); c.moveTo(X - 4, top - 4); c.lineTo(X + w / 2, top - 30); c.lineTo(X + w + 4, top - 4); c.closePath(); fs(c, '#6a4a2a', 2.2);
    line(c, X + 6, top - 4, X + 6, top + 6, 3, '#4a2a14'); line(c, X + w - 6, top - 4, X + w - 6, top + 6, 3, '#4a2a14');
  } else {
    line(c, X + 14, top + 14, X + w / 2, top + h * 0.7, 3, '#6a4220'); line(c, X + w - 14, top + 14, X + w / 2, top + h * 0.7, 3, '#6a4220');
  }
  // tablones
  c.beginPath(); rr(c, X - 2, top, w + 4, 10, 2); fs(c, lg(c, 0, top, 0, top + 10, [[0, '#c08a50'], [1, '#6a4220']]), 2.2);
  for (let x = X + 12; x < X + w; x += 16) line(c, x, top + 1, x, top + 9, 1, 'rgba(50,25,10,0.6)');
}
