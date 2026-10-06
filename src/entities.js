// =====================================================================
//  ENTIDADES: jugador, soldados, props, prisioneros, pickups
// =====================================================================
const GRAV = 1500;

function stepBody(b, dt, world) {
  b.vy = Math.min(b.vy + GRAV * dt * (b.gravK ?? 1), 950);
  let nx = b.x + b.vx * dt;
  for (const s of world.solids) {
    if (s.dead || s === b.solidSelf) continue;
    if (b.y > s.y + 3 && b.y - 50 < s.y + s.h && nx + b.hw > s.x && nx - b.hw < s.x + s.w) {
      if (b.x <= s.x + s.w / 2) nx = Math.min(nx, s.x - b.hw); else nx = Math.max(nx, s.x + s.w + b.hw);
      b.hitWall = true;
    }
  }
  b.x = nx;
  const py = b.y; let ny = b.y + b.vy * dt;
  const fl = world.floorAt(b.x, py, b.drop > 0, b.hw * 0.5);
  const was = b.grounded; b.landV = 0;
  if (ny >= fl) { if (!was) b.landV = b.vy; ny = fl; b.vy = 0; b.grounded = true; }
  else if (was && b.vy >= 0 && fl - ny < 10) { ny = fl; b.vy = 0; b.grounded = true; }
  else b.grounded = false;
  b.y = ny;
  if (b.drop > 0) b.drop -= dt;
}
function rectHit(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function circleRect(cx, cy, r, b) { const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.y, b.y + b.h); return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r; }
function groundFn(e, world) {
  const y0 = e.y;
  return dx => clamp(world.floorAt(e.x + e.f * dx, y0 - 14) - y0, -12, 12);
}

const WEAPONS = {
  pistol: { name: 'PISTOL', gun: 'g_pistol', rate: 0.1, auto: 0.19, speed: 920, dmg: 1, spread: 0.015, tex: 'b_pl', sfx: 'pistol', recoil: 3, flash: 0.7, life: 1.1 },
  hmg: { name: 'H.MACHINE GUN', gun: 'g_hmg', rate: 0.068, auto: 0.068, speed: 1050, dmg: 1, spread: 0.045, tex: 'b_hmg', sfx: 'hmg', recoil: 3.5, flash: 0.95, life: 1.1, ammo: 200, turn: 8 },
  shotgun: { name: 'SHOTGUN', gun: 'g_shot', rate: 0.5, auto: 0.62, speed: 950, dmg: 3, spread: 0.2, pellets: 8, tex: 'b_hmg', sfx: 'shotgun', recoil: 9, flash: 1.3, life: 0.22, ammo: 30 },
};

// ---------------------------------------------------------------------
//  JUGADOR
// ---------------------------------------------------------------------
class Player {
  constructor(gs, x) {
    this.gs = gs; this.x = x; this.y = gs.world.groundY(x); this.vx = 0; this.vy = 0; this.hw = 9;
    this.grounded = true; this.drop = 0; this.f = 1; this.solidSelf = null;
    this.rig = new Humanoid(gs, 'pl', { gun: 'g_pistol', tail: true, depth: 60 });
    this.weapon = 'pistol'; this.ammo = Infinity; this.bombs = 10; this.since = 1; this.throwCd = 0;
    this.inv = 1.5; this.dead = false; this.deadT = 0; this.crouch = false; this.lastStep = 0; this.alt = 0;
  }
  get alive() { return !this.dead; }
  box() { const h = (this.crouch && this.grounded) ? 32 : 50; return { x: this.x - 9, y: this.y - h, w: 18, h }; }
  setWeapon(name) {
    const W = WEAPONS[name]; this.weapon = name; this.ammo = W.ammo || Infinity; this.rig.setGun(W.gun);
  }
  update(dt, I) {
    const gs = this.gs, world = gs.world;
    if (this.dead) {
      this.rig.stepRagdoll(dt, world); this.deadT += dt;
      if (this.deadT > 1.9 && !this.reported) { this.reported = true; gs.playerDied(); }
      return;
    }
    const locked = gs.cutscene;
    let mv = 0;
    if (!locked) { if (I.left) mv -= 1; if (I.right) mv += 1; }
    this.crouch = !locked && I.down && this.grounded;
    if (mv && this.rig.act !== 'knife') this.f = mv;
    const spd = this.crouch ? 62 : 158;
    this.vx = approach(this.vx, mv * spd, dt * (this.grounded ? 1500 : 900));
    if (!locked && I.jumpP && this.grounded) {
      if (I.down && world.onPlatform(this.x, this.y)) { this.drop = 0.25; this.grounded = false; }
      else { this.vy = -575; this.grounded = false; Sound.play('jump'); gs.fx.dust(this.x, this.y, 4, 0.6); }
    }
    stepBody(this, dt, world);
    if (this.landV > 300) { this.rig.land = Math.min(1, this.landV / 800); gs.fx.dust(this.x, this.y, 5); Sound.play('land'); }
    // límites de cámara
    const minX = gs.camX + 14, maxX = gs.camX + GW - 14;
    if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx); }
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }
    // apuntado suave (el barrido del HMG sale de aquí)
    const W = WEAPONS[this.weapon];
    let target = 0;
    if (!locked && I.up) target = -Math.PI / 2;
    else if (!locked && I.down && !this.grounded) target = Math.PI / 2;
    this.rig.aim = approach(this.rig.aim, target, dt * (W.turn || 15));
    // disparo
    this.since += dt;
    if (!locked && ((I.fireP && this.since >= W.rate) || (I.fire && this.since >= W.auto))) this.shoot();
    // granada
    this.throwCd -= dt;
    if (!locked && I.bombP && this.bombs > 0 && this.throwCd <= 0 && gs.countProj('gren', 'player') < 2) {
      this.rig.playAct('throw', 0.3); this.bombs--; this.throwCd = 0.28; Sound.play('throw');
      gs.addGrenade(this.x + this.f * 4, this.y - 58, this.f * 330 + this.vx * 0.4, -360, 'player');
    }
    // pasos
    if (this.grounded && Math.abs(this.vx) > 30) {
      const st = Math.floor(this.rig.phase / Math.PI);
      if (st !== this.lastStep) { this.lastStep = st; Sound.play('step'); if (Math.random() < 0.4) gs.fx.dust(this.x - this.f * 6, this.y, 1, 0.3); }
    }
    // rig
    const R = this.rig; R.x = this.x; R.y = this.y; R.f = this.f;
    R.pose(dt, { move: this.vx, grounded: this.grounded, vy: this.vy, crouch: this.crouch, groundAt: this.grounded ? groundFn(this, world) : null });
    if (this.inv > 0) { this.inv -= dt; R.setAlpha(this.inv > 0 && Math.floor(this.inv * 18) % 2 ? 0.35 : 1); }
  }
  shoot() {
    const gs = this.gs, W = WEAPONS[this.weapon], R = this.rig;
    this.since = 0;
    if (R.aim > -0.6) {
      const e = gs.findKnifeTarget(this);
      if (e) { R.playAct('knife', 0.24); Sound.play('knife'); e.hit(5, { kind: 'knife', dir: this.f, x: this.x, y: this.y - 40 }); gs.hitstop(0.06); return; }
    }
    const m = R.muzzle;
    gs.stats.shots++;
    if (W.pellets) {
      for (let i = 0; i < W.pellets; i++) gs.addPBullet(m.x, m.y, m.a + rnd(-W.spread, W.spread), W.speed * rnd(0.8, 1.1), W.tex, W.dmg, W.life);
      gs.shake(90, 0.005);
    } else {
      this.alt = -this.alt || 1;
      const off = this.weapon === 'hmg' ? this.alt * 3 : 0;
      const ox = -Math.sin(m.a) * off, oy = Math.cos(m.a) * off;
      gs.addPBullet(m.x + ox, m.y + oy, m.a + rnd(-W.spread, W.spread), W.speed, W.tex, W.dmg, W.life);
    }
    R.recoil = W.recoil;
    gs.fx.muzzle(m.x, m.y, m.a, W.flash, !!W.pellets);
    gs.fx.shell(R.eject.x, R.eject.y, this.f);
    Sound.play(W.sfx);
    if (this.ammo !== Infinity) { this.ammo--; if (this.ammo <= 0) { this.setWeapon('pistol'); Sound.play('beep', { f: 440 }); } }
  }
  kill() {
    if (this.dead || this.inv > 0 || this.gs.missionDone) return;
    this.dead = true; this.deadT = 0; this.reported = false;
    const gun = this.rig.gunKey;
    this.rig.die(-this.f * 160, -420, this.f * 5);
    this.gs.fx.body(this.x, this.y - 40, gun, -this.f * 120, -380, { life: 2, r: 3, flip: this.f < 0, snd: 'bounce' });
    Sound.play('playerDie'); this.gs.shake(200, 0.008); this.gs.hitstop(0.12);
    this.gs.fx.sparks(this.x, this.y - 30, -Math.PI / 2, 1.5, 10, 260);
  }
  respawn(x) {
    this.dead = false; this.x = x; this.y = -40; this.vx = 0; this.vy = 120; this.grounded = false;
    this.rig.revive(); this.inv = 2.6; this.setWeapon('pistol'); this.bombs = Math.max(this.bombs, 10);
    this.rig.aim = 0;
  }
}

// ---------------------------------------------------------------------
//  SOLDADOS ENEMIGOS (fusilero, granadero, cuchillero)
// ---------------------------------------------------------------------
class Soldier {
  constructor(gs, kind, x, y, mode, anchor) {
    this.gs = gs; this.kind = kind; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.hw = 9;
    this.grounded = mode !== 'para'; this.drop = 0; this.f = -1; this.anchor = !!anchor;
    const set = { rifle: 'en', grenadier: 'eg', knife: 'ek' }[kind];
    this.rig = new Humanoid(gs, set, { gun: kind === 'rifle' ? 'g_rifle' : null, armMode: kind === 'knife' ? 'knifeHold' : (kind === 'rifle' ? 'gun' : 'swing'), depth: 50 });
    this.hp = 1; this.alive = true; this.t = 0; this.st = 0; this.cd = rnd(0.6, 1.4); this.crouch = false;
    this.state = mode; this.isEnemy = true;
    this.pref = rnd(200, 360); this.look = rnd(0, 6);
    if (mode === 'para') { this.chute = img(gs, x, y, 'chute').setDepth(49); this.vy = 70; }
    if (mode === 'run') { this.stopX = gs.camX + GW - rnd(140, 330); }
    if (mode === 'idle' && Math.random() < 0.5) this.f = 1; // algunos miran hacia otro lado
    this.rig.x = x; this.rig.y = y; this.rig.f = this.f;
    this.rig.pose(0.016, { move: 0, grounded: this.grounded, vy: 0 });
  }
  box() { const h = this.crouch ? 64 : 66; return { x: this.x - 12, y: this.y - h, w: 24, h }; }
  hitTest(x, y) { return rectHit(this.box(), x, y); }
  set(s) { this.state = s; this.st = 0; }
  update(dt) {
    const gs = this.gs, P = gs.player, world = gs.world;
    this.t += dt; this.st += dt;
    if (!this.alive) {
      this.rig.stepRagdoll(dt, world);
      if (this.st > 2.0) this.rig.setAlpha(Math.floor(this.st * 14) % 2 ? 0.2 : 1);
      if (this.st > 2.8) this.remove();
      return;
    }
    const dx = P.x - this.x, adx = Math.abs(dx), pAlive = P.alive && !gs.missionDone;
    const onScreen = this.x > gs.camX + 10 && this.x < gs.camX + GW - 10;
    let mv = 0; this.rig.headTilt = 0;
    if (this.rig.armMode === 'flail' && this.state !== 'panic') this.rig.armMode = this.kind === 'knife' ? 'knifeHold' : this.kind === 'rifle' ? 'gun' : 'swing';
    switch (this.state) {
      case 'idle':
        this.rig.headTilt = Math.sin(this.t * 0.9 + this.look) * 0.12;
        if (Math.sin(this.t * 0.35 + this.look) > 0.985 && this.st > 2) { this.f = -this.f; this.st = 0; }
        if (pAlive && adx < 470 && (Math.sign(dx) === this.f || adx < 250) && onScreen) {
          this.set('alert'); this.f = Math.sign(dx) || 1; Sound.play('alert');
          this.bubble = img(gs, this.x, this.y - 70, 'bubble').setDepth(88);
          if (this.grounded) this.vy = -230;
        }
        break;
      case 'alert':
        this.f = Math.sign(dx) || this.f;
        if (this.st > 0.55) {
          this.bubble?.destroy(); this.bubble = null;
          if (adx < 170 && Math.random() < 0.5 && !this.anchor) { this.set('panic'); this.rig.armMode = 'flail'; Sound.play('scream'); }
          else this.set('fight');
        }
        break;
      case 'panic':
        this.rig.armMode = 'flail'; mv = -Math.sign(dx) || 1; this.f = mv;
        if (this.st > 1.3) { this.set('fight'); this.rig.armMode = this.kind === 'knife' ? 'knifeHold' : this.kind === 'rifle' ? 'gun' : 'swing'; }
        break;
      case 'run':
        mv = -1; this.f = -1;
        if (this.x < this.stopX) this.set('fight');
        break;
      case 'para':
        this.f = Math.sign(dx) || -1;
        this.vx = Math.sin(this.t * 1.8) * 30;
        if (this.chute) { this.chute.x = this.x + Math.sin(this.t * 1.8) * 4; this.chute.y = this.y - 58; this.chute.rotation = Math.cos(this.t * 1.8) * 0.12; }
        if (this.grounded) {
          this.set('fight'); gs.fx.dust(this.x, this.y, 4);
          const ch = this.chute; this.chute = null;
          gs.tweens.add({ targets: ch, y: ch.y + 40, scaleY: 0.2, alpha: 0, angle: 40, duration: 700, onComplete: () => ch.destroy() });
        }
        break;
      case 'fight': this.fight(dt, dx, adx, onScreen, pAlive); mv = this.mv || 0; break;
      case 'aim': {
        this.f = Math.sign(dx) || this.f;
        this.aimAt(P, dt);
        if (this.st > 0.2 && !this.glinted) { this.glinted = true; gs.fx.glow(this.rig.muzzle.x, this.rig.muzzle.y, 0.35, 0xffe080, 0.25); }
        if (this.st > 0.45) { this.set('fire'); this.shots = this.burst; this.shotT = 0; }
        break;
      }
      case 'fire':
        this.aimAt(P, dt);
        this.shotT -= dt;
        if (this.shotT <= 0 && this.shots > 0) {
          this.shots--; this.shotT = 0.2;
          const m = this.rig.muzzle;
          const la = clamp(Math.atan2(P.y - 30 - m.y, Math.abs(P.x - m.x)), -1.1, 0.9) + rnd(-0.04, 0.04);
          gs.addEBullet(m.x, m.y, this.f > 0 ? la : Math.PI - la, 270);
          this.rig.recoil = 3; gs.fx.muzzle(m.x, m.y, m.a, 0.6); Sound.play('enemyShot');
        }
        if (this.shots <= 0 && this.shotT <= -0.15) { this.crouch = false; this.cd = rnd(1.3, 2.4); this.set('fight'); this.rig.aim = 0; }
        break;
      case 'throw':
        this.f = Math.sign(dx) || this.f;
        if (this.st > 0.18 && !this.thrown) {
          this.thrown = true;
          const T = 0.95, g = 1100, sx = this.x + this.f * 4, sy = this.y - 60;
          const tx = P.x + rnd(-30, 30), ty = P.y - 6;
          gs.addGrenade(sx, sy, (tx - sx) / T, (ty - sy - 0.5 * g * T * T) / T, 'enemy');
          Sound.play('throw');
        }
        if (this.st > 0.5) { this.cd = rnd(2, 3.2); this.set('fight'); }
        break;
      case 'slash':
        if (this.st > 0.16 && !this.slashed) {
          this.slashed = true; this.rig.playAct('knife', 0.22); Sound.play('knife');
          const r = P.box(); if (P.alive && Math.abs(P.x - (this.x + this.f * 22)) < 30 && this.y > r.y && this.y - 50 < r.y + r.h) P.kill();
        }
        if (this.st > 0.45) { this.set('recover'); }
        break;
      case 'recover':
        mv = -this.f * 0.5;
        if (this.st > 0.6) this.set('fight');
        break;
    }
    // movimiento
    const speed = this.state === 'panic' ? 150 : this.state === 'run' ? 175 : this.kind === 'knife' ? 190 : 72;
    this.vx = approach(this.vx, (this.anchor ? 0 : mv) * speed, dt * 900);
    if (this.state === 'para') this.vx = Math.sin(this.t * 1.8) * 30;
    if (this.state === 'para') this.gravK = 0.0; else this.gravK = 1;
    if (this.state === 'para') { this.vy = 75; }
    stepBody(this, dt, world);
    if (this.bubble) { this.bubble.x = this.x; this.bubble.y = this.y - 68 - Math.abs(Math.sin(this.st * 12)) * 4; }
    // muy por detrás de la cámara → desaparecer
    if (this.x < gs.camX - 160) { this.remove(); return; }
    const R = this.rig; R.x = this.x; R.y = this.y; R.f = this.f;
    R.pose(dt, { move: this.vx, grounded: this.grounded, vy: this.vy, crouch: this.crouch, groundAt: this.grounded ? groundFn(this, world) : null });
  }
  aimAt(P, dt) {
    const sx = this.x, sy = this.y - 48;
    const a = Math.atan2(P.y - 32 - sy, Math.abs(P.x - sx));
    this.rig.aim = approach(this.rig.aim, clamp(a, -1.1, 0.9), dt * 6);
  }
  fight(dt, dx, adx, onScreen, pAlive) {
    const gs = this.gs; this.mv = 0;
    this.f = Math.sign(dx) || this.f;
    if (!pAlive) { this.rig.aim = approach(this.rig.aim, 0, dt * 3); return; }
    if (this.kind === 'knife') {
      this.mv = Math.sign(dx);
      if (adx < 36 && Math.abs(gs.player.y - this.y) < 40) { this.set('slash'); this.slashed = false; this.mv = 0; }
      return;
    }
    if (!this.anchor) {
      if (adx > this.pref + 50) this.mv = Math.sign(dx);
      else if (adx < this.pref - 110) this.mv = -Math.sign(dx);
      if (this.mv && Math.random() < dt * 0.3) this.pref = rnd(180, 380);
    }
    this.cd -= dt;
    if (this.cd <= 0 && onScreen && adx < 640) {
      if (this.kind === 'rifle') {
        if (gs.countBusyShooters() >= 3) { this.cd = 0.4; return; }
        this.burst = Math.random() < 0.4 ? 3 : Math.random() < 0.5 ? 2 : 1;
        this.crouch = Math.random() < 0.4 && this.grounded; this.glinted = false; this.set('aim');
      } else { this.thrown = false; this.rig.playAct('throw', 0.42); this.set('throw'); }
    }
  }
  hit(dmg, info) {
    if (!this.alive) return 'flesh';
    this.hp -= dmg; this.rig.flash();
    if (this.hp <= 0) this.die(info);
    return 'flesh';
  }
  die(info) {
    const gs = this.gs;
    this.alive = false; this.set('dead'); this.bubble?.destroy(); this.bubble = null;
    if (this.chute) { const ch = this.chute; this.chute = null; gs.tweens.add({ targets: ch, alpha: 0, y: ch.y - 60, duration: 900, onComplete: () => ch.destroy() }); }
    const dir = info.dir || Math.sign(this.x - (info.x ?? this.x)) || 1;
    let vx = dir * 140, vy = -220, spin = rnd(-2, 2);
    if (info.kind === 'explosion') { vx = dir * rnd(220, 380); vy = -rnd(520, 700); spin = dir * rnd(6, 12); }
    if (info.kind === 'knife') { vx = dir * 70; vy = -140; spin = dir * 3; }
    this.rig.die(vx, vy, spin);
    if (this.rig.gunKey) gs.fx.body(this.x, this.y - 40, this.rig.gunKey, vx * 0.6, -300, { life: 2.2, r: 3, flip: this.f < 0, snd: 'bounce' });
    Sound.play('death');
    gs.onKill(this, info.kind);
  }
  remove() { this.dead = true; this.alive = false; this.rig.destroy(); this.bubble?.destroy(); this.chute?.destroy(); }
}

// ---------------------------------------------------------------------
//  PROPS: caja, barril, prisionero, pickup
// ---------------------------------------------------------------------
class Crate {
  constructor(gs, x, item) {
    this.gs = gs; this.x = x; this.y = gs.world.groundY(x); this.item = item; this.hp = 3; this.alive = true;
    this.im = img(gs, x, this.y + 3, 'crate').setDepth(35);
    this.solid = { x: x - 20, y: this.y - 39, w: 40, h: 40 }; gs.world.solids.push(this.solid);
  }
  box() { return { x: this.x - 20, y: this.y - 40, w: 40, h: 40 }; }
  hitTest(x, y) { return rectHit(this.box(), x, y); }
  hit(dmg) {
    if (!this.alive) return 'wood';
    this.hp -= dmg; this.im.setTintFill(0xffffff); this.gs.time.delayedCall(50, () => this.im.active && this.im.clearTint());
    this.im.x = this.x + rnd(-3, 3);
    if (this.hp <= 0) this.destroy();
    Sound.play('wood');
    return 'wood';
  }
  destroy() {
    const gs = this.gs; this.alive = false; this.solid.dead = true; this.im.destroy();
    for (let i = 0; i < 9; i++) gs.fx.body(this.x + rnd(-14, 14), this.y - rnd(5, 35), 'deb_wood', rnd(-220, 220), rnd(-480, -180), { life: 2, r: 2 });
    gs.fx.dust(this.x, this.y, 8, 1.2);
    if (this.item) gs.spawnPickup(this.item, this.x, this.y - 20);
    gs.addScore(50, this.x, this.y - 50);
  }
  update() { }
}
class Barrel {
  constructor(gs, x) {
    this.gs = gs; this.x = x; this.y = gs.world.groundY(x); this.hp = 3; this.alive = true;
    this.im = img(gs, x, this.y + 3, 'barrel').setDepth(35);
    this.solid = { x: x - 13, y: this.y - 38, w: 26, h: 38 }; gs.world.solids.push(this.solid);
  }
  box() { return { x: this.x - 14, y: this.y - 40, w: 28, h: 40 }; }
  hitTest(x, y) { return rectHit(this.box(), x, y); }
  hit(dmg, info) {
    if (!this.alive) return 'metal';
    this.hp -= info && info.kind === 'explosion' ? 99 : dmg;
    this.im.setTintFill(0xffffff); this.gs.time.delayedCall(50, () => this.im.active && this.im.clearTint());
    if (this.hp <= 0) { this.alive = false; this.gs.time.delayedCall(info && info.kind === 'explosion' ? 120 : 0, () => this.blow()); }
    Sound.play('tink');
    return 'metal';
  }
  blow() {
    const gs = this.gs; this.solid.dead = true; this.im.destroy();
    for (let i = 0; i < 6; i++) gs.fx.body(this.x, this.y - 20, 'deb_red', rnd(-300, 300), rnd(-600, -250), { life: 2, r: 2 });
    gs.explode(this.x, this.y - 22, 95, 10, 'neutral', 1.3);
  }
  update() { }
}

class Pow {
  constructor(gs, x, item) {
    this.gs = gs; this.x = x; this.y = gs.world.groundY(x); this.item = item; this.alive = true; this.freed = false;
    this.post = img(gs, x - 10, this.y + 4, 'post').setDepth(48);
    this.rig = new Humanoid(gs, 'pw', { armMode: 'tied', depth: 49 }); this.f = 1;
    this.state = 'tied'; this.st = 0; this.vx = 0; this.vy = 0; this.hw = 8; this.grounded = true; this.drop = 0;
  }
  box() { return { x: this.x - 12, y: this.y - 44, w: 24, h: 44 }; }
  hitTest(x, y) { return !this.freed && rectHit(this.box(), x, y); }
  hit() { this.free(); return 'none'; }
  free() {
    if (this.freed) return; const gs = this.gs;
    this.freed = true; this.state = 'salute'; this.st = 0; this.alive = false;
    this.rig.armMode = 'swing'; this.rig.playAct('salute', 0.8);
    gs.fx.body(this.x - 10, this.y - 26, 'rope', -60, -200, { life: 1.5 }); gs.fx.body(this.x - 10, this.y - 32, 'rope', 40, -260, { life: 1.5 });
    gs.tweens.add({ targets: this.post, alpha: 0, delay: 1200, duration: 600 });
    Sound.play('rescue'); gs.stats.pows++; gs.addScore(1000, this.x, this.y - 70);
    gs.fx.popup(this.x, this.y - 92, 'THANK YOU!', '#a8f0ff', 18);
  }
  update(dt) {
    const gs = this.gs, P = gs.player; this.st += dt;
    if (this.state === 'tied' && P.alive && Math.abs(P.x - this.x) < 22 && Math.abs(P.y - this.y) < 40) this.free();
    let mv = 0;
    if (this.state === 'salute' && this.st > 0.85) { this.state = 'give'; this.st = 0; this.f = Math.sign(P.x - this.x) || 1; this.rig.playAct('give', 0.4); }
    if (this.state === 'give' && this.st > 0.25 && !this.gave) { this.gave = true; gs.spawnPickup(this.item, this.x + this.f * 20, this.y - 30, clamp((P.x - this.x) * 1.3, -320, 320)); }
    if (this.state === 'give' && this.st > 0.6) { this.state = 'run'; this.st = 0; }
    if (this.state === 'run') { mv = -1; this.f = -1; if (this.x < gs.camX - 60) { this.rig.destroy(); this.post.destroy(); this.dead = true; return; } }
    this.vx = mv * 230;
    stepBody(this, dt, gs.world);
    const R = this.rig; R.x = this.x; R.y = this.y; R.f = this.f;
    R.pose(dt, { move: this.vx, grounded: this.grounded, vy: this.vy, crouch: this.state === 'tied', groundAt: groundFn(this, gs.world) });
    if (this.x < gs.camX - 300) { this.rig.destroy(); this.post.destroy(); this.dead = true; }
  }
}

class Pickup {
  constructor(gs, type, x, y, vx = 0) {
    this.gs = gs; this.type = type; this.x = x; this.y = y; this.vx = vx; this.vy = -280; this.t = 0;
    this.im = img(gs, x, y, 'pk_' + type).setDepth(55);
    this.glow = gs.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(54).setScale(0.45).setTint(0xfff0a0).setAlpha(0.5);
  }
  update(dt) {
    const gs = this.gs, P = gs.player; this.t += dt;
    this.vy += 1100 * dt; const py = this.y; this.x += this.vx * dt; this.y += this.vy * dt;
    const fl = gs.world.floorAt(this.x, py);
    if (this.y >= fl) { this.y = fl; this.vy = 0; this.vx = 0; }
    const bob = this.vy === 0 ? Math.sin(this.t * 5) * 2 - 2 : 0;
    this.im.setPosition(this.x, this.y + bob); this.glow.setPosition(this.x, this.y - 14 + bob).setAlpha(0.35 + Math.sin(this.t * 8) * 0.15);
    if (P.alive && Math.abs(P.x - this.x) < 26 && P.y > this.y - 60 && P.y < this.y + 40 && this.t > 0.25) this.collect();
    if (this.x < gs.camX - 80) this.destroy();
  }
  collect() {
    const gs = this.gs, P = gs.player;
    switch (this.type) {
      case 'H': P.setWeapon('hmg'); Sound.play('pickup'); Sound.say('Heavy machine gun!'); gs.fx.popup(this.x, this.y - 40, 'HEAVY MACHINE GUN!', '#ffd84a', 20); break;
      case 'S': P.setWeapon('shotgun'); Sound.play('pickup'); Sound.say('Shotgun!'); gs.fx.popup(this.x, this.y - 40, 'SHOTGUN!', '#8ac8ff', 20); break;
      case 'B': P.bombs += 10; Sound.play('pickup'); Sound.say('Bombs!'); gs.fx.popup(this.x, this.y - 40, 'BOMB +10', '#a0f080', 18); break;
      case 'medal': Sound.play('medal'); gs.addScore(1000, this.x, this.y - 40); break;
      case 'food': Sound.play('medal'); gs.addScore(500, this.x, this.y - 40); break;
    }
    gs.fx.ring(this.x, this.y - 14, 0.5, 0xfff0a0);
    this.destroy();
  }
  destroy() { this.dead = true; this.im.destroy(); this.glow.destroy(); }
}
