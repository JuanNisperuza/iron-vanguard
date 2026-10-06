// =====================================================================
//  EFECTOS: partículas propias, escombros, casquillos, textos flotantes
// =====================================================================
const C_FIRE = [0xfff4c0, 0xffc040, 0xff7a18, 0xc83010, 0x401008];
const C_SPARK = [0xffffff, 0xffe080, 0xff8020];
const C_SMOKE = [0x6a5a5a, 0x3a3034, 0x2a2228];
const C_DUST = [0xc8a070, 0x8a6a4a];

class Fx {
  constructor(scene, world) {
    this.s = scene; this.world = world; this.pool = []; this.active = []; this.bodies = []; this.pops = [];
    for (let i = 0; i < 400; i++) this.pool.push(scene.add.image(-100, -100, 'fx_dot').setVisible(false));
  }
  _get() {
    let im = this.pool.pop();
    if (!im) { if (this.active.length > 900) return null; im = this.s.add.image(0, 0, 'fx_dot'); }
    return im;
  }
  emit(o) {
    const im = this._get(); if (!im) return null;
    im.setTexture(o.tex || 'fx_dot').setVisible(true).setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setDepth(o.depth ?? 80).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setRotation(o.rot || 0).setAlpha(o.a0 ?? 1).setScrollFactor(o.sf ?? 1);
    const p = { im, x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.5, t: 0, s0: o.s0 ?? 1, s1: o.s1 ?? 0, a0: o.a0 ?? 1, a1: o.a1 ?? 0,
      cols: o.cols || null, grav: o.grav || 0, drag: o.drag || 0, vr: o.vr || 0, stretch: o.stretch || 0, sy: o.sy || 1, fixedRot: o.rot };
    if (!p.cols) im.clearTint();
    this.active.push(p); this._apply(p, 0);
    return p;
  }
  _col(cols, u) {
    if (cols.length === 1) return cols[0];
    const f = u * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(f)), k = f - i;
    const a = cols[i], b = cols[i + 1];
    const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k;
    const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k;
    const bl = (a & 255) + ((b & 255) - (a & 255)) * k;
    return (r << 16) | (g << 8) | bl;
  }
  _apply(p, u) {
    const s = lerp(p.s0, p.s1, u), im = p.im;
    im.x = p.x; im.y = p.y;
    if (p.stretch) { im.rotation = Math.atan2(p.vy, p.vx); im.setScale(s * (1 + Math.hypot(p.vx, p.vy) * p.stretch), s * p.sy); }
    else { im.setScale(s, s * p.sy); if (p.vr) im.rotation += p.vr / 60; }
    im.alpha = lerp(p.a0, p.a1, u);
    if (p.cols) im.setTint(this._col(p.cols, u));
  }
  update(dt) {
    const A = this.active;
    for (let i = A.length - 1; i >= 0; i--) {
      const p = A[i]; p.t += dt; const u = p.t / p.life;
      if (u >= 1) { p.im.setVisible(false); this.pool.push(p.im); A[i] = A[A.length - 1]; A.pop(); continue; }
      if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      this._apply(p, u);
    }
    // cuerpos físicos simples (escombros/casquillos)
    const B = this.bodies;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.t += dt;
      if (b.t > b.life) { b.im.destroy(); B.splice(i, 1); continue; }
      b.vy += 1400 * dt; const py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.im.rotation += b.vr * dt;
      const fl = this.world.floorAt(b.x, py - 1) - b.r;
      if (b.y > fl) {
        b.y = fl;
        if (b.vy > 120) { if (b.snd && b.bounces < 2) Sound.play(b.snd); b.bounces++; }
        b.vy = -b.vy * b.bounce; b.vx *= 0.6; b.vr *= 0.6; if (Math.abs(b.vy) < 50) b.vy = 0;
      }
      b.im.x = b.x; b.im.y = b.y;
      if (b.life - b.t < 0.6) b.im.alpha = (b.life - b.t) / 0.6;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]; p.t += dt;
      p.tx.y -= dt * 40 * Math.max(0, 1 - p.t);
      if (p.t > 0.9) p.tx.alpha = Math.max(0, 1 - (p.t - 0.9) / 0.4);
      if (p.t > 1.3) { p.tx.destroy(); this.pops.splice(i, 1); }
    }
  }
  body(x, y, tex, vx, vy, o = {}) {
    if (this.bodies.length > 160) { const b = this.bodies.shift(); b.im.destroy(); }
    const im = img(this.s, x, y, tex).setDepth(o.depth ?? 45).setRotation(Math.random() * 6);
    if (o.tint) im.setTint(o.tint);
    if (o.scale) im.setScale(o.scale);
    if (o.flip) im.scaleX = -im.scaleX;
    const b = { im, x, y, vx, vy, vr: o.vr ?? rnd(-12, 12), life: o.life ?? 2.5, t: 0, r: o.r ?? 2, bounce: o.bounce ?? 0.35, snd: o.snd, bounces: 0 };
    this.bodies.push(b); return b;
  }

  // ------------------------------------------------------------- recetas
  sparks(x, y, ang, spread, n, spd = 300, cols = C_SPARK) {
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-spread, spread), v = spd * rnd(0.4, 1.2);
      this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, tex: 'fx_spark', life: rnd(0.12, 0.3), s0: rnd(0.4, 0.8), s1: 0.1, cols, add: true, grav: 700, stretch: 0.002, sy: 0.7 });
    }
  }
  dust(x, y, n, spread = 1, cols = C_DUST) {
    for (let i = 0; i < n; i++) {
      this.emit({ x: x + rnd(-6, 6), y, vx: rnd(-80, 80) * spread, vy: rnd(-90, -20), tex: 'fx_smoke', life: rnd(0.35, 0.7), s0: rnd(0.2, 0.35), s1: rnd(0.5, 0.8), a0: 0.7, a1: 0, cols, drag: 3, depth: 46 });
    }
  }
  smoke(x, y, n, s = 1, depth = 79) {
    for (let i = 0; i < n; i++) {
      this.emit({ x: x + rnd(-10, 10) * s, y: y + rnd(-6, 6) * s, vx: rnd(-30, 30), vy: rnd(-70, -20), tex: 'fx_smoke', life: rnd(0.8, 1.6), s0: 0.4 * s, s1: rnd(1.0, 1.6) * s, a0: 0.75, a1: 0, cols: C_SMOKE, drag: 1.5, vr: rnd(-1, 1), depth });
    }
  }
  muzzle(x, y, ang, s = 1, big = false) {
    this.emit({ x, y, tex: big ? 'fx_blast' : 'fx_muzzle', ox: 2 / 48, rot: ang, life: big ? 0.09 : 0.055, s0: s * rnd(0.8, 1.15), s1: s * 0.7, a0: 1, a1: 0.6, add: true, depth: 82 });
    this.emit({ x, y, tex: 'fx_glow', life: 0.07, s0: 0.45 * s, s1: 0.2, a0: 0.6, a1: 0, cols: [0xffd080], add: true, depth: 81 });
    if (big) this.smoke(x + Math.cos(ang) * 20, y + Math.sin(ang) * 20, 3, 0.6);
  }
  shell(x, y, f) {
    this.body(x, y, 'shell', -f * rnd(60, 140), rnd(-260, -160), { life: 1.4, r: 1.5, bounce: 0.45, vr: rnd(-25, 25), depth: 47, snd: null });
  }
  bulletHit(x, y, ang, kind) {
    if (kind === 'metal') { this.sparks(x, y, ang + Math.PI, 1.1, 6, 260); this.emit({ x, y, tex: 'fx_glow', life: 0.08, s0: 0.3, s1: 0.1, cols: [0xfff0b0], add: true }); }
    else if (kind === 'ground') { this.dust(x, y, 3, 0.6); this.sparks(x, y, -Math.PI / 2, 1, 3, 160, [0xffe0a0, 0xa07040]); }
    else { this.sparks(x, y, ang, 0.6, 4, 200, [0xffffff, 0xffc060]); this.emit({ x, y, tex: 'fx_glow', life: 0.07, s0: 0.25, s1: 0.1, cols: [0xfff0c0], add: true }); }
  }
  explosion(x, y, size = 1, ground = true) {
    this.emit({ x, y, tex: 'fx_glow', life: 0.18, s0: 1.6 * size, s1: 2.6 * size, a0: 1, a1: 0, cols: [0xffffff, 0xffd080], add: true, depth: 84 });
    this.emit({ x, y, tex: 'fx_ring', life: 0.3, s0: 0.1, s1: 1.2 * size, a0: 0.9, a1: 0, cols: [0xfff0c0, 0xff8040], add: true, depth: 84 });
    for (let i = 0; i < 14 * size; i++) {
      const a = rnd(0, TAU), v = rnd(30, 190) * size;
      this.emit({ x: x + Math.cos(a) * 8 * size, y: y + Math.sin(a) * 8 * size, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 * size, tex: 'fx_soft', life: rnd(0.35, 0.7), s0: rnd(0.5, 0.9) * size, s1: rnd(1, 1.6) * size, a0: 1, a1: 0, cols: C_FIRE, add: true, drag: 3.5, grav: -120, depth: 83 });
    }
    for (let i = 0; i < 10 * size; i++) {
      const a = rnd(0, TAU), v = rnd(20, 120) * size;
      this.emit({ x: x + Math.cos(a) * 10 * size, y: y + Math.sin(a) * 6 * size, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, tex: 'fx_smoke', life: rnd(1, 1.9), s0: 0.6 * size, s1: rnd(1.4, 2.2) * size, a0: 0.85, a1: 0, cols: C_SMOKE, drag: 2, grav: -40, vr: rnd(-1, 1), depth: 78 });
    }
    this.sparks(x, y, -Math.PI / 2, 1.6, 12 * size, 520 * size, C_FIRE);
    if (ground) for (let i = 0; i < 5 * size; i++) this.body(x + rnd(-10, 10), y - 4, 'deb_rock', rnd(-260, 260) * size, rnd(-520, -200) * size, { life: 1.6, r: 3 });
  }
  ring(x, y, s, col = 0xffffff) { this.emit({ x, y, tex: 'fx_ring', life: 0.25, s0: 0.1, s1: s, a0: 0.8, a1: 0, cols: [col], add: true, depth: 84 }); }
  glow(x, y, s, col, life = 0.1) { this.emit({ x, y, tex: 'fx_glow', life, s0: s, s1: s * 0.5, a0: 0.8, a1: 0, cols: [col], add: true, depth: 84 }); }
  popup(x, y, text, color = '#fff6b0', size = 16) {
    const tx = this.s.add.text(x, y, text, { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: size + 'px', color, stroke: '#1a1220', strokeThickness: 4 }).setOrigin(0.5).setDepth(90);
    this.pops.push({ tx, t: 0 });
  }
}
