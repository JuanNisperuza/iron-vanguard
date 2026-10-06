// =====================================================================
//  RIG PROCEDURAL — esqueleto humanoide con IK de 2 huesos y ragdoll
// =====================================================================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const approach = (a, b, s) => a < b ? Math.min(b, a + s) : Math.max(b, a - s);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// IK analítica de dos huesos. bend=+1 → la articulación se dobla hacia +x local (rodillas)
function ik2(hx, hy, tx, ty, l1, l2, bend) {
  let dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < 0.001) d = 0.001;
  const a = Math.atan2(dy, dx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a1 = a - bend * off;
  return { jx: hx + Math.cos(a1) * l1, jy: hy + Math.sin(a1) * l1, ex: hx + dx, ey: hy + dy };
}
const V = (x, y) => ({ x, y });
const dirv = (a, l = 1) => V(Math.cos(a) * l, Math.sin(a) * l);
const add = (a, b, k = 1) => V(a.x + b.x * k, a.y + b.y * k);
const rot = (x, y, a) => V(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));

let RIG_SEQ = 0;
class Humanoid {
  constructor(scene, set, opts = {}) {
    this.scene = scene; this.set = set; this.id = RIG_SEQ++;
    this.x = 0; this.y = 0; this.f = 1;
    this.gunKey = opts.gun || null; this.tail = !!opts.tail;
    this.armMode = opts.armMode || 'gun';
    this.phase = Math.random() * TAU; this.t = Math.random() * 10;
    this.walkK = 0; this.crouchK = 0; this.airK = 0; this.land = 0;
    this.aim = 0; this.recoil = 0; this.act = null; this.actT = 0; this.actDur = 1;
    this.headTilt = 0; this.flashT = 0; this.J = {};
    this.muzzle = { x: 0, y: 0, a: 0 }; this.eject = { x: 0, y: 0 };
    this.rd = null;
    const order = ['uarmB', 'farmB', 'handB', 'thighB', 'shinB', 'bootB', 'tail1', 'tail2', 'torso', 'thighF', 'shinF', 'bootF', 'head', 'gun', 'knife', 'uarmF', 'farmF', 'handF'];
    this.parts = {}; this.list = [];
    for (const n of order) {
      let key;
      if (n === 'gun') key = this.gunKey || 'g_pistol';
      else if (n === 'knife') key = 'g_knife';
      else if (n.startsWith('tail')) { if (!this.tail) continue; key = 'pl_tail'; }
      else key = set + '_' + n.replace(/[FB]$/, '');
      const im = img(scene, 0, 0, key);
      im.baseTint = (n.endsWith('B') && !n.startsWith('tail')) ? 0xa8a2ba : (n.startsWith('tail') ? 0xe0d0d0 : 0xffffff);
      if (im.baseTint !== 0xffffff) im.setTint(im.baseTint);
      this.parts[n] = im; this.list.push(im);
    }
    if (!this.gunKey) this.parts.gun.setVisible(false);
    this.parts.knife.setVisible(false);
    this.setDepth(opts.depth || 50);
  }
  setDepth(d) { this.depth = d; const b = d + (this.id % 40) * 0.002; this.list.forEach((im, i) => im.setDepth(b + i * 0.0001)); return this; }
  setGun(key) {
    this.gunKey = key; const g = this.parts.gun;
    if (key) { g.setTexture(key); const o = Tex.O[key]; g.setOrigin(o[0], o[1]); g.setVisible(true); } else g.setVisible(false);
  }
  setAlpha(a) { this.list.forEach(im => im.setAlpha(a)); }
  setVisible(v) { this.list.forEach(im => { if (im === this.parts.gun) im.setVisible(v && !!this.gunKey && !this.rd); else if (im === this.parts.knife) im.setVisible(false); else im.setVisible(v); }); }
  flash(t = 0.06) { this.flashT = t; this.list.forEach(im => im.setTintFill(0xffffff)); }
  _unflash() { this.list.forEach(im => { im.clearTint(); if (im.baseTint !== 0xffffff) im.setTint(im.baseTint); }); }
  tintAll(c) { this.list.forEach(im => im.setTint(c)); }
  playAct(name, dur) { this.act = name; this.actT = 0; this.actDur = dur; }
  destroy() { this.list.forEach(im => im.destroy()); this.list = []; }

  // ------------------------------------------------------------------
  //  Pose procedural (espacio local: mirando a la derecha, origen en los pies, y hacia abajo)
  //  p = { move, grounded, vy, crouch, groundAt(dx) }
  // ------------------------------------------------------------------
  pose(dt, p) {
    if (this.rd) return;
    this.t += dt;
    const fwd = (p.move || 0) * this.f, spd = Math.abs(fwd);
    const ex = k => 1 - Math.exp(-dt * k);
    this.walkK = lerp(this.walkK, (p.grounded && spd > 10) ? Math.min(1, spd / 80) : 0, ex(10));
    this.crouchK = lerp(this.crouchK, p.crouch ? 1 : 0, ex(18));
    this.airK = lerp(this.airK, p.grounded ? 0 : 1, ex(16));
    this.land = Math.max(0, this.land - dt * 5);
    this.recoil = lerp(this.recoil, 0, ex(22));
    if (this.act) { this.actT += dt; if (this.actT >= this.actDur) this.act = null; }
    const J = this.J, wk = this.walkK, ck = this.crouchK, ak = this.airK;
    const stride = (9 + Math.min(spd, 230) * 0.036) * (1 - ck * 0.35);
    if (p.grounded && spd > 10) this.phase += Math.sign(fwd) * dt * spd / (4 * stride) * TAU;

    // ---- pelvis
    const px = ck * 2;
    const py = -lerp(38, 23, ck) + Math.cos(2 * this.phase) * 1.7 * wk + Math.sin(this.t * 2.2) * 0.6 * (1 - wk) + this.land * 7;
    J.pelvis = V(px, py);

    // ---- pies: ciclo de marcha (apoyo / balanceo) mezclado con reposo y aire
    const lift = 8 + spd * 0.025, feet = [];
    for (let k = 0; k < 2; k++) {
      const u = (((this.phase + k * Math.PI) / TAU) % 1 + 1) % 1;
      let wx, wy, sw = 0;
      if (u < 0.5) { const s = u / 0.5; wx = stride * (1 - 2 * s); wy = 0; }
      else { const s = (u - 0.5) / 0.5; wx = -stride + 2 * stride * smooth(s); wy = -lift * Math.sin(s * Math.PI); sw = Math.sin(s * Math.PI); }
      const ix = k === 0 ? 5 + ck * 7 : -6 - ck * 7;
      let gx = lerp(ix, wx, wk), gy = lerp(0, wy, wk), slope = 0;
      if (p.groundAt && ak < 0.5) {
        gy += p.groundAt(gx);
        slope = Math.atan2(p.groundAt(gx + 4) - p.groundAt(gx - 4), 8);
      }
      gy -= 7;
      const rising = (p.vy || 0) < 0;
      const axf = k === 0 ? (rising ? 9 : 5) : (rising ? -9 : -6);
      const ayf = k === 0 ? (rising ? -16 : -8) : (rising ? -9 : -4);
      feet.push({ x: lerp(gx, axf, ak), y: lerp(gy, ayf, ak), a: lerp(slope - 0.45 * sw * wk, rising ? 0.2 : 0.45, ak) });
    }
    const hipF = V(px + 2, py), hipB = V(px - 2, py);
    const lf = ik2(hipF.x, hipF.y, feet[0].x, feet[0].y, 19, 19, 1);
    const lb = ik2(hipB.x, hipB.y, feet[1].x, feet[1].y, 19, 19, 1);
    J.hipF = hipF; J.kneeF = V(lf.jx, lf.jy); J.ankleF = V(lf.ex, lf.ey); J.footAF = feet[0].a;
    J.hipB = hipB; J.kneeB = V(lb.jx, lb.jy); J.ankleB = V(lb.ex, lb.ey); J.footAB = feet[1].a;

    // ---- torso y cabeza
    const aimN = this.aim / (Math.PI / 2);
    let lean = clamp(fwd / 160, -1, 1) * 0.13 * wk + ck * 0.22 + (aimN < 0 ? aimN * 0.12 : aimN * 0.3) + Math.sin(this.t * 2.2) * 0.012;
    if (this.act === 'knife') lean += 0.18 * Math.sin(Math.PI * this.actT / this.actDur);
    if (this.act === 'throw') lean += 0.12 * Math.sin(Math.PI * this.actT / this.actDur);
    if (this.armMode === 'flail') lean -= 0.18;
    if (this.armMode === 'tied') lean += 0.12 + Math.sin(this.t * 3) * 0.06;
    if (this.act === 'salute') lean -= 0.06;
    const ta = -Math.PI / 2 + lean;
    J.torsoA = ta;
    const neck = add(J.pelvis, dirv(ta, 26)); J.neck = neck;
    J.headA = lean * 0.5 + clamp(this.aim, -1.2, 1.2) * 0.3 + this.headTilt + (this.armMode === 'flail' ? -0.35 + Math.sin(this.t * 20) * 0.1 : 0);
    J.headC = add(neck, rot(2, -13, J.headA));
    const sh = add(J.pelvis, dirv(ta, 21));
    const shF = V(sh.x + 1, sh.y), shB = V(sh.x - 3, sh.y - 1);
    J.sh = sh; J.shF = shF; J.shB = shB;

    // ---- brazos
    const meta = Tex.M[this.gunKey] || { fore: 10, reach: 12, muzzle: [30, -4], eject: [5, -6] };
    const dA = dirv(this.aim), pA = V(-dA.y, dA.x);
    let hF, hB, gun = null, gunA = 0, knife = null, knifeA = 0;
    const swingArms = (amp) => {
      hF = add(shF, dirv(Math.PI / 2 - 0.15 + Math.cos(this.phase) * amp, 20));
      hB = add(shB, dirv(Math.PI / 2 + 0.1 - Math.cos(this.phase) * amp, 20));
    };
    switch (this.armMode) {
      case 'gun': {
        if (!this.gunKey) { swingArms(0.15 + 0.9 * wk); break; }
        const reach = meta.reach - this.recoil;
        gun = V(shF.x + dA.x * reach + pA.x * 2.5, shF.y + dA.y * reach + pA.y * 2.5);
        gunA = this.aim - this.recoil * 0.03;
        hF = gun; hB = V(gun.x + dA.x * meta.fore + pA.x * 1.5, gun.y + dA.y * meta.fore + pA.y * 1.5);
        break;
      }
      case 'knifeHold':
        hF = add(shF, dirv(0.5 + Math.cos(this.phase) * 0.45 * wk, 20));
        hB = add(shB, dirv(Math.PI / 2 + 0.2 - Math.cos(this.phase) * 0.8 * wk, 19));
        knife = hF; knifeA = -0.25;
        break;
      case 'flail':
        hF = add(shF, dirv(-Math.PI / 2 + 0.55 + Math.sin(this.t * 24) * 0.7, 22));
        hB = add(shB, dirv(-Math.PI / 2 - 0.35 + Math.sin(this.t * 24 + 2) * 0.7, 22));
        break;
      case 'tied':
        hF = V(px - 9, py - 4 + Math.sin(this.t * 6) * 1.5); hB = V(px - 12, py - 2);
        break;
      default: swingArms(0.15 + 0.9 * wk);
    }
    // acciones superpuestas
    if (this.act) {
      const u = clamp(this.actT / this.actDur, 0, 1);
      if (this.act === 'throw') hB = add(shB, dirv(lerp(-2.8, 0.4, easeOut(u)), 23));
      if (this.act === 'knife') {
        const a = lerp(-1.7, 0.9, easeOut(u));
        hF = add(shF, dirv(a, 24)); knife = hF; knifeA = a + 0.15;
        if (this.gunKey) { gun = V(shB.x + 5, shB.y + 13); gunA = 1.15; hB = gun; }
      }
      if (this.act === 'salute') { hF = add(J.headC, V(5, -4)); hB = add(shB, V(-2, 20)); }
      if (this.act === 'give') { hF = add(shF, dirv(0.25, 22)); }
      if (this.act === 'cheer') { hF = add(shF, dirv(-1.3 + Math.sin(u * 30) * 0.3, 23)); }
    }
    const af = ik2(shF.x, shF.y, hF.x, hF.y, 13, 12, -1);
    const ab = ik2(shB.x, shB.y, hB.x, hB.y, 13, 12, -1);
    J.elbowF = V(af.jx, af.jy); J.handF = V(af.ex, af.ey);
    J.elbowB = V(ab.jx, ab.jy); J.handB = V(ab.ex, ab.ey);
    J.gun = gun; J.gunA = gunA; J.knife = knife; J.knifeA = knifeA;
    if (gun) {
      const m = rot(meta.muzzle[0], meta.muzzle[1], gunA), e = rot(meta.eject[0], meta.eject[1], gunA);
      this.muzzle = { x: this.x + this.f * (gun.x + m.x), y: this.y + gun.y + m.y, a: this.f > 0 ? gunA : Math.PI - gunA };
      this.eject = { x: this.x + this.f * (gun.x + e.x), y: this.y + gun.y + e.y };
    }
    // ---- cola del pañuelo (péndulo procedural)
    if (this.tail) {
      const anc = add(neck, rot(-9, -17, J.headA));
      const w = Math.sin(this.t * 13);
      const a1 = Math.PI - 1.05 + wk * 0.75 + w * 0.16 * (0.4 + wk) - ak * ((p.vy || 0) < 0 ? 0.5 : -0.3);
      const a2 = a1 + 0.25 + Math.sin(this.t * 13 - 1.2) * 0.3;
      J.tail0 = anc; J.tail1 = add(anc, dirv(a1, 9)); J.tail2 = add(J.tail1, dirv(a2, 9));
    }
    this.render();
  }

  put(im, lx, ly, la) { im.x = this.x + this.f * lx; im.y = this.y + ly; im.rotation = this.f * la; im.scaleX = this.f; im.scaleY = 1; }
  seg(im, a, b) { this.put(im, a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x)); }
  render() {
    if (this.flashT > 0) { this.flashT -= 1 / 60; if (this.flashT <= 0) this._unflash(); }
    const J = this.J, P = this.parts;
    this.seg(P.thighF, J.hipF, J.kneeF); this.seg(P.shinF, J.kneeF, J.ankleF); this.put(P.bootF, J.ankleF.x, J.ankleF.y, J.footAF);
    this.seg(P.thighB, J.hipB, J.kneeB); this.seg(P.shinB, J.kneeB, J.ankleB); this.put(P.bootB, J.ankleB.x, J.ankleB.y, J.footAB);
    this.seg(P.torso, J.pelvis, J.neck);
    this.put(P.head, J.neck.x, J.neck.y, J.headA);
    this.seg(P.uarmF, J.shF, J.elbowF); this.seg(P.farmF, J.elbowF, J.handF);
    this.put(P.handF, J.handF.x, J.handF.y, Math.atan2(J.handF.y - J.elbowF.y, J.handF.x - J.elbowF.x));
    this.seg(P.uarmB, J.shB, J.elbowB); this.seg(P.farmB, J.elbowB, J.handB);
    this.put(P.handB, J.handB.x, J.handB.y, Math.atan2(J.handB.y - J.elbowB.y, J.handB.x - J.elbowB.x));
    if (this.gunKey) { P.gun.setVisible(!!J.gun); if (J.gun) this.put(P.gun, J.gun.x, J.gun.y, J.gunA); }
    P.knife.setVisible(!!J.knife); if (J.knife) this.put(P.knife, J.knife.x, J.knife.y, J.knifeA);
    if (this.tail) { this.seg(P.tail1, J.tail0, J.tail1); this.seg(P.tail2, J.tail1, J.tail2); }
  }

  // ------------------------------------------------------------------
  //  RAGDOLL (Verlet) — se construye desde la pose actual
  // ------------------------------------------------------------------
  die(vx, vy, spin = 0) {
    if (this.rd) return;
    const J = this.J, W = p => V(this.x + this.f * p.x, this.y + p.y);
    const src = { head: J.headC, neck: J.neck, sh: J.sh, pelvis: J.pelvis, kneeF: J.kneeF, ankleF: J.ankleF, kneeB: J.kneeB, ankleB: J.ankleB, elbowF: J.elbowF, handF: J.handF, elbowB: J.elbowB, handB: J.handB };
    const pts = {}, pc = W(J.pelvis), dt = 1 / 60;
    for (const k in src) {
      const w = W(src[k]);
      const rx = w.x - pc.x, ry = w.y - pc.y;
      const pvx = vx + (-ry) * spin + rnd(-40, 40), pvy = vy + rx * spin + rnd(-40, 40);
      pts[k] = { x: w.x, y: w.y, ox: w.x - pvx * dt, oy: w.y - pvy * dt };
    }
    const L = [['head', 'neck'], ['neck', 'sh'], ['sh', 'pelvis'], ['neck', 'pelvis'], ['head', 'sh'],
      ['sh', 'elbowF'], ['elbowF', 'handF'], ['sh', 'elbowB'], ['elbowB', 'handB'],
      ['pelvis', 'kneeF'], ['kneeF', 'ankleF'], ['pelvis', 'kneeB'], ['kneeB', 'ankleB']];
    const links = L.map(([a, b]) => [pts[a], pts[b], dist(pts[a].x, pts[a].y, pts[b].x, pts[b].y)]);
    this.rd = { pts, links, acc: 0, rest: 0 };
    this.parts.gun.setVisible(false); this.parts.knife.setVisible(false);
    if (this.tail) { this.parts.tail1.setVisible(false); this.parts.tail2.setVisible(false); }
  }
  revive() { this.rd = null; this.list.forEach(im => im.setVisible(true)); this.parts.knife.setVisible(false); if (!this.gunKey) this.parts.gun.setVisible(false); this.setAlpha(1); this._unflash(); }
  stepRagdoll(dt, world) {
    const R = this.rd; if (!R) return;
    R.acc += dt; const h = 1 / 60;
    let moving = 0;
    while (R.acc >= h) {
      R.acc -= h;
      for (const k in R.pts) {
        const p = R.pts[k];
        const vx = (p.x - p.ox) * 0.992, vy = (p.y - p.oy) * 0.992;
        p.ox = p.x; p.oy = p.y; p.x += vx; p.y += vy + 1500 * h * h;
        moving += Math.abs(vx) + Math.abs(vy);
      }
      for (let it = 0; it < 6; it++) {
        for (const [a, b, l] of R.links) {
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, df = (d - l) / d * 0.5;
          a.x += dx * df; a.y += dy * df; b.x -= dx * df; b.y -= dy * df;
        }
        for (const k in R.pts) {
          const p = R.pts[k];
          const fl = world.floorAt(p.x, p.oy - 2) - (k === 'head' ? 9 : 3);
          if (p.y > fl) { p.y = fl; p.ox = p.x - (p.x - p.ox) * 0.55; if (p.oy < p.y) p.oy = p.y + (p.y - p.oy) * 0.15; }
        }
      }
    }
    R.moving = moving;
    this.renderRagdoll();
  }
  renderRagdoll() {
    const P = this.parts, R = this.rd.pts, f = this.f;
    const la = w => f > 0 ? w : Math.PI - w;
    const putW = (im, p, w) => { im.x = p.x; im.y = p.y; im.rotation = f * la(w); im.scaleX = f; im.scaleY = 1; };
    const segW = (im, a, b) => putW(im, a, Math.atan2(b.y - a.y, b.x - a.x));
    const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    segW(P.torso, R.pelvis, R.neck);
    const hw = ang(R.neck, R.head);
    P.head.x = R.neck.x; P.head.y = R.neck.y; P.head.rotation = f * (la(hw) + Math.PI / 2); P.head.scaleX = f;
    segW(P.thighF, R.pelvis, R.kneeF); segW(P.shinF, R.kneeF, R.ankleF);
    segW(P.thighB, R.pelvis, R.kneeB); segW(P.shinB, R.kneeB, R.ankleB);
    const bootA = (a, b) => la(ang(a, b)) - Math.PI / 2;
    P.bootF.x = R.ankleF.x; P.bootF.y = R.ankleF.y; P.bootF.rotation = f * bootA(R.kneeF, R.ankleF); P.bootF.scaleX = f;
    P.bootB.x = R.ankleB.x; P.bootB.y = R.ankleB.y; P.bootB.rotation = f * bootA(R.kneeB, R.ankleB); P.bootB.scaleX = f;
    segW(P.uarmF, R.sh, R.elbowF); segW(P.farmF, R.elbowF, R.handF); putW(P.handF, R.handF, 0);
    segW(P.uarmB, R.sh, R.elbowB); segW(P.farmB, R.elbowB, R.handB); putW(P.handB, R.handB, 0);
    if (this.flashT > 0) { this.flashT -= 1 / 60; if (this.flashT <= 0) this._unflash(); }
  }
}
