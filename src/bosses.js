function flashParts(gs, parts, ms = 45) {
  parts.forEach(p => p.active && p.setTint(0xff8a7a));
  gs.time.delayedCall(ms, () =>
    parts.forEach(p => {
      if (!p.active) return;
      p.clearTint();
      if (p.baseTint) p.setTint(p.baseTint);
    })
  );
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    l = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
class Tank {
  constructor(gs, x) {
    this.gs = gs;
    this.x = x;
    this.y = gs.world.groundY(x);
    this.max = this.hp = 55;
    this.alive = true;
    this.isBoss = true;
    this.name = 'R-07 ASSAULT TANK';
    this.state = 'enter';
    this.st = 0;
    this.t = 0;
    this.vx = 0;
    this.turretA = Math.PI;
    this.cd = 1.2;
    this.trk = 0;
    this.mode = 0;
    this.recoil = 0;
    this.tx = x;
    this.retarget = 0;
    this.track = img(gs, 0, 0, 'tank_track').setDepth(40);
    this.wheels = [-78, -47, -16, 16, 47, 78].map(o => {
      const w = gs.add.image(0, 0, 'tank_wheel').setDepth(41);
      w.ox = o;
      return w;
    });
    this.links = [];
    for (let i = 0; i < 30; i++) this.links.push(gs.add.image(0, 0, 'tank_link').setDepth(41.5));
    this.barrel = img(gs, 0, 0, 'tank_barrel').setDepth(42.5);
    this.hull = img(gs, 0, 0, 'tank_hull').setDepth(43);
    this.turret = img(gs, 0, 0, 'tank_turret').setDepth(44);
    this.chargeGlow = gs.add
      .image(0, 0, 'fx_glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(45)
      .setTint(0xffa040)
      .setScale(0);
    this.parts = [this.track, ...this.wheels, ...this.links, this.barrel, this.hull, this.turret];
    this.solid = { x: 0, y: 0, w: 190, h: 70 };
    gs.world.solids.push(this.solid);
    this.layout();
  }
  box() {
    return { x: this.x - 100, y: this.y - 104, w: 200, h: 104 };
  }
  hitTest(x, y) {
    return this.alive && rectHit(this.box(), x, y);
  }
  hit(dmg) {
    if (!this.alive) return 'metal';
    this.hp -= dmg;
    flashParts(this.gs, [this.hull, this.turret, this.barrel]);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = 'dying';
      this.st = 0;
      this.gs.stats.kills++;
      this.chargeGlow.setScale(0);
    }
    return 'metal';
  }
  pivot() {
    return V(this.x - 22, this.y - 90 + this.vib);
  }
  layout() {
    const cy = this.y - 20,
      a = 84,
      r = 16,
      L = 2 * a,
      P = 2 * L + 2 * Math.PI * r;
    this.vib = Math.abs(this.vx) > 5 ? Math.sin(this.t * 40) * 0.8 : 0;
    this.track.setPosition(this.x, cy);
    this.wheels.forEach(w => {
      w.setPosition(this.x + w.ox, cy + 2);
      w.rotation = -this.trk / 12;
    });
    this.links.forEach((l, i) => {
      let s = ((((i * P) / this.links.length - this.trk) % P) + P) % P,
        px,
        py,
        ro;
      if (s < L) {
        px = this.x - a + s;
        py = cy + r;
        ro = 0;
      } else if ((s -= L) < Math.PI * r) {
        const th = Math.PI / 2 - s / r;
        px = this.x + a + r * Math.cos(th);
        py = cy + r * Math.sin(th);
        ro = th + Math.PI / 2;
      } else if ((s -= Math.PI * r) < L) {
        px = this.x + a - s;
        py = cy - r;
        ro = Math.PI;
      } else {
        s -= L;
        const th = -Math.PI / 2 - s / r;
        px = this.x - a + r * Math.cos(th);
        py = cy + r * Math.sin(th);
        ro = th + Math.PI / 2;
      }
      l.setPosition(px, py);
      l.rotation = ro;
    });
    this.hull.setPosition(this.x, this.y - 22 + this.vib);
    this.turret.setPosition(this.x + 8, this.y - 68 + this.vib);
    const pv = this.pivot(),
      d = dirv(this.turretA);
    this.barrel.setPosition(pv.x - d.x * this.recoil, pv.y - d.y * this.recoil).setRotation(this.turretA);
    Object.assign(this.solid, { x: this.x - 95, y: this.y - 70, w: 190, h: 70 });
  }
  update(dt) {
    const gs = this.gs,
      P = gs.player;
    this.t += dt;
    this.st += dt;
    this.recoil = lerp(this.recoil, 0, 1 - Math.exp(-dt * 6));
    if (this.state === 'enter') {
      this.vx = -95;
      if (this.x <= gs.lockX + 760) {
        this.state = 'fight';
        this.st = 0;
        this.vx = 0;
      }
    } else if (this.state === 'fight') {
      this.retarget -= dt;
      if (this.retarget <= 0) {
        this.retarget = rnd(2, 3.5);
        this.tx = rnd(gs.lockX + 540, gs.lockX + 880);
      }
      const minX = P.x + 220;
      const tx = Math.min(gs.lockX + 880, Math.max(this.tx, minX));
      const sp = this.hp < this.max / 2 ? 110 : 75;
      this.vx = approach(this.vx, Math.abs(tx - this.x) > 8 ? Math.sign(tx - this.x) * sp : 0, dt * 200);
      const pv = this.pivot();
      let des = Math.atan2(P.y - 45 - pv.y, P.x - pv.x);
      if (des < 0) des += TAU;
      des = clamp(des, Math.PI - 0.15, Math.PI + 0.95);
      this.turretA = approach(this.turretA, des, dt * 0.9);
      this.cd -= dt;
      if (this.cd <= 0 && P.alive) {
        this.mode = (this.mode + 1) % 3;
        if (this.mode === 1) {
          this.state = 'mg';
          this.st = 0;
          this.shots = 6;
          this.shotT = 0.35;
          Sound.play('beep', { f: 660 });
        } else {
          this.state = 'charge';
          this.st = 0;
        }
      }
    } else if (this.state === 'charge') {
      this.vx = approach(this.vx, 0, dt * 300);
      const pv = this.pivot(),
        m = add(pv, dirv(this.turretA, 86));
      this.chargeGlow
        .setPosition(m.x, m.y)
        .setScale(this.st * 0.9)
        .setAlpha(0.6 + Math.sin(this.t * 40) * 0.3);
      if (this.st > 0.6) {
        this.chargeGlow.setScale(0);
        const d = dirv(this.turretA);
        gs.addProj({
          type: 'tshell',
          x: m.x,
          y: m.y,
          vx: d.x * 470,
          vy: d.y * 470,
          grav: 360,
          tex: 'tshell',
          owner: 'enemy',
        });
        gs.fx.muzzle(m.x, m.y, this.turretA, 2.2, true);
        gs.fx.smoke(m.x, m.y, 5, 0.9);
        this.recoil = 14;
        Sound.play('cannon');
        gs.shake(160, 0.006);
        this.state = 'fight';
        this.cd = this.hp < this.max / 2 ? 1.3 : 2.1;
      }
    } else if (this.state === 'mg') {
      this.shotT -= dt;
      if (this.shotT <= 0 && this.shots > 0) {
        this.shots--;
        this.shotT = 0.11;
        const mx = this.x - 104,
          my = this.y - 40;
        gs.addEBullet(mx, my, Math.PI, 340);
        gs.fx.muzzle(mx, my, Math.PI, 0.7);
        Sound.play('enemyShot');
      }
      if (this.shots <= 0) {
        this.state = 'fight';
        this.cd = this.hp < this.max / 2 ? 1.1 : 1.8;
      }
    } else if (this.state === 'dying') {
      this.vx = approach(this.vx, 0, dt * 300);
      if (Math.random() < dt * 9) {
        const b = this.box();
        gs.fx.explosion(b.x + rnd(10, 190), b.y + rnd(10, 90), rnd(0.5, 0.9), false);
        Sound.play('explosion', { size: 0.6 });
      }
      if (this.st > 1.7 && !this.blown) {
        this.blown = true;
        gs.explode(this.x, this.y - 50, 140, 0, 'neutral', 2.4);
        Sound.play('bigExplosion');
        gs.shake(600, 0.016);
        gs.hitstop(0.15);
        gs.fx.body(this.turret.x, this.turret.y, 'tank_turret', 140, -720, { life: 4, r: 18, vr: 6, depth: 44 });
        gs.fx.body(this.barrel.x, this.barrel.y, 'tank_barrel', -220, -600, { life: 4, r: 6, vr: -9, depth: 44 });
        this.turret.setVisible(false);
        this.barrel.setVisible(false);
        [this.hull, this.track, ...this.wheels, ...this.links].forEach(p => {
          p.baseTint = 0x4a3c3c;
          p.setTint(0x4a3c3c);
        });
        for (let i = 0; i < 10; i++)
          gs.fx.body(this.x + rnd(-80, 80), this.y - 50, 'deb_metal', rnd(-400, 400), rnd(-800, -300), {
            life: 3,
            r: 3,
            scale: rnd(1, 2),
          });
        this.solid.dead = true;
        gs.addScore(5000, this.x, this.y - 120);
        gs.onBossDead('tank');
      }
      if (this.blown && Math.random() < dt * 6 && this.x > gs.camX - 200)
        gs.fx.smoke(this.x + rnd(-40, 40), this.y - 60, 1, 1.2, 39);
      if (this.blown && this.x < gs.camX - 300) {
        this.parts.forEach(p => p.destroy());
        this.chargeGlow.destroy();
        this.dead = true;
        return;
      }
    }
    if (this.state !== 'dying') {
      if (this.hp < this.max / 2 && Math.random() < dt * 8) gs.fx.smoke(this.x + 30, this.y - 75, 1, 0.8, 39);
      if (Math.abs(this.vx) > 5 && Math.random() < dt * 10)
        gs.fx.dust(this.x + 90 * Math.sign(this.vx), this.y, 1, 0.5);
      if (Math.abs(this.vx) > 5 && Math.random() < dt * 8) Sound.play('engine');
    }
    this.x += this.vx * dt;
    this.trk += this.vx * dt;
    this.y = gs.world.groundY(this.x);
    this.layout();
  }
}

class Heli {
  constructor(gs, x) {
    this.gs = gs;
    this.x = x;
    this.y = -80;
    this.vx = -120;
    this.vy = 60;
    this.max = this.hp = 40;
    this.alive = true;
    this.isBoss = true;
    this.name = 'H-3 GUNSHIP';
    this.t = 0;
    this.st = 0;
    this.state = 'fly';
    this.side = 1;
    this.sideT = 3;
    this.cd = 2;
    this.bcd = 1.5;
    this.f = -1;
    this.rotT = 0;
    this.body = img(gs, x, this.y, 'heli_body').setDepth(44);
    this.rotor = gs.add.image(x, this.y, 'heli_rotor').setDepth(45);
    this.trotor = gs.add.image(x, this.y, 'heli_trotor').setDepth(43.9);
    this.parts = [this.body, this.rotor, this.trotor];
  }
  box() {
    return { x: this.x - 78, y: this.y - 30, w: 156, h: 58 };
  }
  hitTest(x, y) {
    return this.alive && rectHit(this.box(), x, y);
  }
  hit(dmg) {
    if (!this.alive) return 'metal';
    this.hp -= dmg;
    flashParts(this.gs, [this.body]);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = 'fall';
      this.st = 0;
      this.spin = this.vx > 0 ? 1 : -1;
      Sound.play('explosion');
      this.gs.fx.explosion(this.x, this.y, 1, false);
      this.gs.stats.kills++;
      this.gs.addScore(3000, this.x, this.y - 40);
    }
    return 'metal';
  }
  off(ox, oy) {
    const r = rot(ox * -this.f, oy, this.body.rotation);
    return V(this.x + r.x, this.y + r.y);
  }
  update(dt) {
    const gs = this.gs,
      P = gs.player;
    this.t += dt;
    this.st += dt;
    this.rotT -= dt;
    if (this.rotT <= 0 && this.x > gs.camX - 100 && this.x < gs.camX + GW + 100) {
      this.rotT = 0.1;
      Sound.play('rotor');
    }
    if (this.state === 'fly') {
      this.sideT -= dt;
      if (this.sideT <= 0) {
        this.sideT = rnd(2.5, 4);
        this.side = -this.side;
      }
      const tx = clamp(P.x + this.side * 200, gs.camX + 90, gs.camX + GW - 90),
        ty = 135 + Math.sin(this.t * 1.3) * 20;
      this.vx += ((tx - this.x) * 2.0 - this.vx * 1.7) * dt;
      this.vy += ((ty - this.y) * 2.4 - this.vy * 2.2) * dt;
      this.f = P.x < this.x ? -1 : 1;
      this.cd -= dt;
      this.bcd -= dt;
      if (this.cd <= 0 && P.alive && Math.abs(P.x - this.x) < 520) {
        this.state = 'burst';
        this.shots = 5;
        this.shotT = 0.3;
        Sound.play('beep', { f: 990 });
      }
      if (this.bcd <= 0 && P.alive && Math.abs(P.x - this.x) < 80) {
        this.bcd = 2.2;
        gs.addProj({
          type: 'bomb',
          x: this.x,
          y: this.y + 24,
          vx: this.vx * 0.5,
          vy: 60,
          grav: 900,
          tex: 'grenade',
          owner: 'enemy',
          scale: 1.5,
        });
        Sound.play('throw');
      }
    } else if (this.state === 'burst') {
      this.vx *= 1 - dt * 2;
      this.vy *= 1 - dt * 2;
      this.shotT -= dt;
      if (this.shotT <= 0 && this.shots > 0) {
        this.shots--;
        this.shotT = 0.1;
        const g = this.off(-86, 12);
        const a = Math.atan2(P.y - 30 - g.y, P.x - g.x) + rnd(-0.05, 0.05);
        gs.addEBullet(g.x, g.y, a, 300);
        gs.fx.muzzle(g.x, g.y, a, 0.7);
        Sound.play('enemyShot');
      }
      if (this.shots <= 0) {
        this.state = 'fly';
        this.cd = this.hp < this.max * 0.4 ? 1.6 : 2.5;
      }
    } else if (this.state === 'fall') {
      this.vy += 420 * dt;
      this.vx *= 1 - dt * 0.5;
      this.body.rotation += this.spin * dt * 5;
      if (Math.random() < dt * 30) gs.fx.smoke(this.x, this.y, 1, 0.9);
      if (Math.random() < dt * 6) gs.fx.explosion(this.x + rnd(-40, 40), this.y + rnd(-15, 15), 0.5, false);
      if (this.y > gs.world.groundY(this.x) - 26) {
        gs.explode(this.x, this.y, 120, 0, 'neutral', 2.2);
        Sound.play('bigExplosion');
        gs.shake(500, 0.014);
        for (let i = 0; i < 10; i++)
          gs.fx.body(this.x + rnd(-60, 60), this.y - 20, 'deb_metal', rnd(-420, 420), rnd(-800, -300), {
            life: 3,
            r: 3,
            scale: rnd(1, 2),
          });
        gs.fx.body(this.x, this.y - 20, 'heli_rotor', rnd(-200, 200), -700, { life: 3, r: 4, vr: 14, scale: 0.6 });
        this.parts.forEach(p => p.destroy());
        this.dead = true;
        gs.onBossDead('heli');
        return;
      }
    }
    if (this.alive && this.hp < this.max * 0.4 && Math.random() < dt * 10) {
      const s = this.off(20, -20);
      gs.fx.smoke(s.x, s.y, 1, 0.7);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.state !== 'fall') this.body.rotation = clamp(this.vx * 0.0016, -0.35, 0.35);
    this.body.setPosition(this.x, this.y).setScale(this.f < 0 ? 1 : -1, 1);
    const rp = this.off(0, -32);
    this.rotor
      .setPosition(rp.x, rp.y)
      .setRotation(this.body.rotation)
      .setScale(0.2 + 0.8 * Math.abs(Math.cos(this.t * 26)), 1);
    const tp = this.off(104, -14);
    this.trotor.setPosition(tp.x, tp.y);
    this.trotor.rotation += dt * 40;
  }
}

class Missile {
  constructor(gs, x, y, vx, vy) {
    this.gs = gs;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.hp = 2;
    this.alive = true;
    this.t = 0;
    this.im = img(gs, x, y, 'missile').setDepth(70);
  }
  box() {
    return { x: this.x - 12, y: this.y - 8, w: 24, h: 16 };
  }
  hitTest(x, y) {
    return this.alive && rectHit(this.box(), x, y);
  }
  hit(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0 && this.alive) {
      this.boom('neutral');
      this.gs.addScore(100, this.x, this.y - 20);
    }
    return 'metal';
  }
  boom(owner) {
    this.alive = false;
    this.dead = true;
    this.im.destroy();
    this.gs.explode(this.x, this.y, 55, 3, owner, 0.8);
  }
  update(dt) {
    const gs = this.gs,
      P = gs.player;
    this.t += dt;
    if (this.t > 0.45) {
      let a = Math.atan2(this.vy, this.vx);
      const want = Math.atan2(P.y - 30 - this.y, P.x - this.x);
      a += clamp(Phaser.Math.Angle.Wrap(want - a), -2.3 * dt, 2.3 * dt);
      const sp = Math.min(290, Math.hypot(this.vx, this.vy) + 300 * dt);
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
    } else {
      this.vy += 300 * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.im.setPosition(this.x, this.y).setRotation(Math.atan2(this.vy, this.vx));
    const d = dirv(this.im.rotation, -14);
    gs.fx.emit({
      x: this.x + d.x,
      y: this.y + d.y,
      tex: 'fx_soft',
      life: 0.5,
      s0: 0.25,
      s1: 0.6,
      a0: 0.8,
      a1: 0,
      cols: [0xffe0a0, 0xff7020, 0x504040],
      add: true,
      depth: 69,
    });
    if (P.alive && rectHit(P.box(), this.x, this.y)) return this.boom('enemy');
    if (this.y > gs.world.groundY(this.x) || this.t > 5.5) this.boom('enemy');
  }
}

class Walker {
  constructor(gs, x) {
    this.gs = gs;
    this.bx = x;
    this.max = this.hp = 230;
    this.alive = true;
    this.isBoss = true;
    this.name = 'ARACNE-9 SIEGE WALKER';
    this.state = 'enter';
    this.st = 0;
    this.t = 0;
    this.bvx = 0;
    this.phase = 1;
    this.off = 0;
    this.offT = 0;
    this.cannonA = Math.PI * 0.85;
    this.recoil = 0;
    this.actionN = 0;
    this.tx = x;
    const gy = gs.world.groundY(x);
    this.by = gy - 170;
    const defs = [
      { hx: -95, hy: 30, far: false },
      { hx: -55, hy: 36, far: true },
      { hx: 55, hy: 36, far: false },
      { hx: 100, hy: 30, far: true },
    ];
    this.legs = defs.map((d, i) => {
      const L = { ...d, i, group: i === 0 || i === 3 ? 0 : 1, foot: V(x + d.hx * 1.5, gy), step: null };
      const dep = d.far ? 37 : 42,
        tint = d.far ? 0x8a86a2 : null;
      L.upper = img(gs, 0, 0, 'boss_leg1').setDepth(dep);
      L.lower = img(gs, 0, 0, 'boss_leg2').setDepth(dep + 0.1);
      L.knee = gs.add.image(0, 0, 'boss_joint').setDepth(dep + 0.2);
      L.hip = gs.add.image(0, 0, 'boss_joint').setDepth(dep + 0.2);
      L.footIm = img(gs, 0, 0, 'boss_foot').setDepth(dep + 0.15);
      L.ims = [L.upper, L.lower, L.knee, L.hip, L.footIm];
      if (tint)
        L.ims.forEach(m => {
          m.baseTint = tint;
          m.setTint(tint);
        });
      return L;
    });
    this.pod = img(gs, 0, 0, 'boss_pod').setDepth(39.5);
    this.cannon = img(gs, 0, 0, 'boss_cannon').setDepth(39.6);
    this.body = img(gs, 0, 0, 'boss_body').setDepth(40);
    this.core = gs.add.image(0, 0, 'boss_core').setDepth(40.4).setBlendMode(Phaser.BlendModes.ADD);
    this.armor = img(gs, 0, 0, 'boss_armor').setDepth(41);
    this.eye = img(gs, 0, 0, 'boss_eye').setDepth(41.2);
    this.glow = gs.add
      .image(0, 0, 'fx_glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(46)
      .setScale(0)
      .setTint(0xff60c0);
    this.beam = img(gs, 0, 0, 'beam').setDepth(46).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.parts = [this.pod, this.cannon, this.body, this.armor, this.eye, ...this.legs.flatMap(l => l.ims)];
    this.layout();
  }
  get x() {
    return this.bx;
  }
  box() {
    return { x: this.bx - 140, y: this.by - 55, w: 280, h: 112 };
  }
  hitTest(x, y) {
    if (!this.alive) return false;
    if (rectHit(this.box(), x, y)) return true;
    for (const L of this.legs) {
      if (segDist(x, y, L.hip.x, L.hip.y, L.knee.x, L.knee.y) < 13) return true;
      if (segDist(x, y, L.knee.x, L.knee.y, L.footIm.x, L.footIm.y) < 11) return true;
    }
    return false;
  }
  hit(dmg) {
    if (!this.alive || this.state === 'enter') return 'metal';
    const k = this.phase === 2 ? 1.25 : 1;
    this.hp -= dmg * k;
    flashParts(this.gs, [this.body, this.armor, this.eye, this.pod, this.cannon], 40);
    if (this.phase === 1 && this.hp <= this.max / 2) {
      this.phase = 2;
      this.setState('break');
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.setState('dying');
      this.gs.stats.kills++;
      this.beam.setVisible(false);
      this.glow.setScale(0);
    }
    return 'metal';
  }
  setState(s) {
    this.state = s;
    this.st = 0;
    this.fired = 0;
    if (s === 'walk') {
      const gs = this.gs;
      this.tx = clamp(rnd(gs.lockX + 480, gs.lockX + 740), gs.player.x + 270, gs.lockX + 760);
    }
  }
  groundY() {
    return this.gs.world.groundY(this.bx);
  }
  cannonPivot() {
    return V(this.bx - 100, this.by + 48);
  }
  layout() {
    const bx = this.bx,
      by = this.by;
    this.body.setPosition(bx, by);
    this.armor.setPosition(bx + 10, by - 36);
    this.eye.setPosition(bx - 126, by - 6);
    this.core
      .setPosition(bx + 5, by + 14)
      .setScale((this.phase === 2 ? 1.3 : 0.8) + Math.sin(this.t * 9) * 0.12)
      .setAlpha(this.phase === 2 ? 1 : 0.6);
    this.pod.setPosition(bx + 60, by - (this.armor.visible ? 58 : 34));
    const cp = this.cannonPivot(),
      d = dirv(this.cannonA);
    this.cannon.setPosition(cp.x - d.x * this.recoil, cp.y - d.y * this.recoil).setRotation(this.cannonA);
    for (const L of this.legs) {
      const hx = bx + L.hx,
        hy = by + L.hy;
      const bend = L.hx < 0 ? -1 : 1;
      const r = ik2(hx, hy, L.foot.x, L.foot.y - 8, 88, 96, bend);
      L.knee.setPosition(r.jx, r.jy);
      L.hip.setPosition(hx, hy);
      L.upper.setPosition(hx, hy).setRotation(Math.atan2(r.jy - hy, r.jx - hx));
      L.lower.setPosition(r.jx, r.jy).setRotation(Math.atan2(r.ey - r.jy, r.ex - r.jx));
      L.footIm.setPosition(r.ex, r.ey - 4);
    }
  }
  updateLegs(dt) {
    const gs = this.gs,
      P = gs.player;
    const dur = this.phase === 2 ? 0.26 : 0.34;
    for (const L of this.legs) {
      if (L.step) {
        L.step.t += dt / dur;
        const u = smooth(Math.min(1, L.step.t));
        L.foot.x = lerp(L.step.fx, L.step.tx, u);
        L.foot.y = lerp(L.step.fy, L.step.ty, u) - Math.sin(u * Math.PI) * 38;
        if (L.step.t >= 1) {
          L.step = null;
          L.foot.y = gs.world.groundY(L.foot.x);
          gs.fx.dust(L.foot.x, L.foot.y, 4, 0.8);
          Sound.play('stomp');
          gs.shake(70, 0.003);
          if (P.alive && Math.abs(P.x - L.foot.x) < 26 && P.y > L.foot.y - 30) P.kill();
        }
        continue;
      }
      if (this.state === 'dying') continue;
      const rest = this.bx + L.hx * 1.5 + this.bvx * 0.3;
      const other = this.legs.some(o => o.step && o.group !== L.group);
      if (!other && Math.abs(L.foot.x - rest) > 34) {
        const tx = rest + Math.sign(rest - L.foot.x) * 16;
        L.step = { t: 0, fx: L.foot.x, fy: L.foot.y, tx, ty: gs.world.groundY(tx) };
      }
    }
  }
  update(dt) {
    const gs = this.gs,
      P = gs.player;
    this.t += dt;
    this.st += dt;
    this.recoil = lerp(this.recoil, 0, 1 - Math.exp(-dt * 5));
    const gy = this.groundY();
    let wantV = 0,
      offT = 0;
    const aimCannon = rate => {
      const cp = this.cannonPivot();
      let a = Math.atan2(P.y - 30 - cp.y, P.x - cp.x);
      if (a < 0) a += TAU;
      this.cannonA = approach(this.cannonA, clamp(a, Math.PI * 0.55, Math.PI * 1.15), dt * rate);
    };
    switch (this.state) {
      case 'enter':
        wantV = -70;
        if (this.bx <= gs.lockX + 660) {
          this.setState('roar');
          Sound.play('roar');
          gs.shake(900, 0.008);
        }
        break;
      case 'roar':
        offT = Math.sin(this.st * 20) * 4;
        if (this.st > 1.1) this.setState('walk');
        break;
      case 'walk': {
        const sp = this.phase === 2 ? 95 : 60;
        if (Math.abs(this.tx - this.bx) > 10) wantV = Math.sign(this.tx - this.bx) * sp;
        aimCannon(1.2);
        if ((this.st > (this.phase === 2 ? 1.4 : 2.2) && Math.abs(this.tx - this.bx) < 30) || this.st > 3.5) {
          const opts =
            this.phase === 1
              ? ['cannon', 'missile', 'cannon']
              : ['cannon', 'missile', 'slam', 'laser', 'laser', 'slam'];
          this.setState(opts[this.actionN++ % opts.length]);
          if (this.state === 'laser') this.beamLow = Math.random() < 0.5;
        }
        break;
      }
      case 'cannon': {
        aimCannon(1.6);
        const cp = this.cannonPivot(),
          m = add(cp, dirv(this.cannonA, 92));
        if (this.st < 0.8) {
          if (this.st < dt * 1.5) Sound.play('charge', { dur: 0.8 });
          this.glow
            .setPosition(m.x, m.y)
            .setScale(this.st * 1.1)
            .setAlpha(0.7 + Math.sin(this.t * 50) * 0.3);
          if (Math.random() < 0.5) {
            const a = rnd(0, TAU);
            gs.fx.emit({
              x: m.x + Math.cos(a) * 45,
              y: m.y + Math.sin(a) * 45,
              vx: -Math.cos(a) * 220,
              vy: -Math.sin(a) * 220,
              tex: 'fx_dot',
              life: 0.2,
              s0: 0.25,
              s1: 0,
              cols: [0xff9ae0],
              add: true,
            });
          }
        } else if (!this.fired) {
          this.fired = 1;
          this.glow.setScale(0);
          const n = this.phase === 2 ? 5 : 3,
            spread = 0.17;
          for (let i = 0; i < n; i++) {
            const a = this.cannonA + (i - (n - 1) / 2) * spread;
            gs.addProj({
              type: 'plasma',
              x: m.x,
              y: m.y,
              vx: Math.cos(a) * 250,
              vy: Math.sin(a) * 250,
              tex: 'plasma',
              owner: 'enemy',
            });
          }
          this.recoil = 16;
          gs.fx.muzzle(m.x, m.y, this.cannonA, 2, true);
          Sound.play('plasma');
          gs.shake(150, 0.006);
        }
        if (this.st > 1.4) this.setState('walk');
        break;
      }
      case 'missile': {
        const times = this.phase === 2 ? [0.3, 0.5, 0.7, 0.9] : [0.35, 0.65];
        offT = -4;
        if (this.fired < times.length && this.st > times[this.fired]) {
          const k = this.fired++;
          const x = this.pod.x - 18 + (k % 3) * 17,
            y = this.pod.y - 26;
          gs.addActor(new Missile(gs, x, y, rnd(-140, -40), -380), true);
          gs.fx.smoke(x, y, 3, 0.6);
          Sound.play('missile');
        }
        if (this.st > 1.5) this.setState('walk');
        break;
      }
      case 'slam': {
        const s = this.st;
        if (s < 0.6) offT = smooth(s / 0.6) * 38;
        else if (s < 0.78) offT = lerp(38, -30, smooth((s - 0.6) / 0.18));
        else if (s < 0.9) offT = lerp(-30, 12, (s - 0.78) / 0.12);
        else offT = lerp(12, 0, Math.min(1, (s - 0.9) / 0.5));
        if (s >= 0.9 && !this.fired) {
          this.fired = 1;
          gs.shake(400, 0.014);
          Sound.play('stomp');
          Sound.play('explosion', { size: 1 });
          for (const d of [-1, 1])
            gs.addProj({ type: 'wave', x: this.bx + d * 70, y: gy, vx: d * 340, owner: 'enemy' });
          gs.fx.dust(this.bx - 80, gy, 10, 2);
          gs.fx.dust(this.bx + 80, gy, 10, 2);
        }
        if (s > 1.6) this.setState('walk');
        break;
      }
      case 'laser': {
        const s = this.st,
          beamY = gy - (this.beamLow ? 16 : 44);
        const target = beamY - 48 - (gy - 170);
        this.cannonA = approach(this.cannonA, Math.PI, dt * 3);
        if (s < 0.6) offT = smooth(s / 0.6) * target;
        else if (s < 1.85) offT = target;
        else offT = lerp(target, 0, Math.min(1, (s - 1.85) / 0.6));
        const cp = this.cannonPivot(),
          m = add(cp, dirv(this.cannonA, 92)),
          len = m.x - gs.lockX + 20;
        if (s > 0.6 && s < 1.4) {
          if (!this.fired) {
            this.fired = 1;
            Sound.play('charge', { dur: 0.8 });
          }
          this.beam
            .setVisible(Math.floor(s * 20) % 2 === 0)
            .setPosition(m.x, m.y)
            .setRotation(Math.PI)
            .setScale(len / 64, 0.12)
            .setAlpha(0.7);
          this.glow.setPosition(m.x, m.y).setScale(0.3 + (s - 0.6) * 0.6);
        } else if (s >= 1.4 && s < 1.85) {
          if (this.fired === 1) {
            this.fired = 2;
            Sound.play('laser');
            gs.shake(450, 0.006);
          }
          this.beam
            .setVisible(true)
            .setPosition(m.x, m.y)
            .setScale(len / 64, 0.9 + Math.sin(this.t * 60) * 0.15)
            .setAlpha(1);
          this.glow.setScale(0.9 + Math.sin(this.t * 50) * 0.2);
          if (Math.random() < 0.6) gs.fx.sparks(gs.lockX + 20, beamY, 0, 1.2, 1, 200, [0xffffff, 0xff60c0]);
          const r = P.box();
          if (P.alive && beamY + 7 > r.y && beamY - 7 < r.y + r.h && P.x < m.x) P.kill();
        } else {
          this.beam.setVisible(false);
          if (s > 1.85) this.glow.setScale(0);
        }
        if (s > 2.5) this.setState('walk');
        break;
      }
      case 'break': {
        offT = Math.sin(this.st * 30) * 3;
        if (Math.random() < dt * 12)
          gs.fx.explosion(this.bx + rnd(-110, 110), this.by + rnd(-50, 10), rnd(0.4, 0.8), false);
        if (this.st > 0.6 && this.armor.visible) {
          this.armor.setVisible(false);
          gs.fx.body(this.armor.x, this.armor.y, 'boss_armor', 160, -650, { life: 3.5, r: 20, vr: 3, depth: 41 });
          gs.explode(this.bx, this.by - 30, 10, 0, 'neutral', 1.6);
          Sound.play('roar');
          gs.fx.popup(this.bx, this.by - 100, 'CORE EXPOSED!', '#ff9a6a', 22);
        }
        if (this.st > 1.5) this.setState('walk');
        break;
      }
      case 'dying': {
        offT = Math.min(1, this.st / 2.6) * 100;
        if (Math.random() < dt * 12) {
          gs.fx.explosion(this.bx + rnd(-130, 130), this.by + rnd(-50, 50), rnd(0.5, 1.1), false);
          Sound.play('explosion', { size: 0.7 });
        }
        for (const L of this.legs) if (!L.step) L.foot.x += Math.sign(L.hx) * dt * 20;
        if (this.st > 2.9 && !this.fired) {
          this.fired = 1;
          gs.explode(this.bx, this.by, 200, 0, 'neutral', 3.2);
          Sound.play('bigExplosion');
          gs.shake(1200, 0.02);
          gs.flashWhite();
          const bits = [
            ['boss_cannon', this.cannon],
            ['boss_pod', this.pod],
            ['boss_eye', this.eye],
          ];
          bits.forEach(([k, im]) =>
            gs.fx.body(im.x, im.y, k, rnd(-300, 300), rnd(-800, -500), { life: 4, r: 10, vr: rnd(-8, 8), depth: 44 })
          );
          this.legs.forEach(L => {
            gs.fx.body(L.knee.x, L.knee.y, 'boss_leg1', rnd(-300, 300), rnd(-700, -300), {
              life: 4,
              r: 10,
              vr: rnd(-6, 6),
              depth: 44,
            });
          });
          for (let i = 0; i < 16; i++)
            gs.fx.body(this.bx + rnd(-100, 100), this.by, 'deb_metal', rnd(-500, 500), rnd(-900, -300), {
              life: 4,
              r: 3,
              scale: rnd(1, 2.5),
            });
          [...this.parts, this.core, this.glow, this.beam].forEach(p => p.destroy());
          this.dead = true;
          gs.addScore(20000, this.bx, this.by);
          gs.onBossDead('walker');
          return;
        }
        break;
      }
    }
    this.bvx = approach(this.bvx, wantV, dt * 160);
    this.bx += this.bvx * dt;
    this.off = lerp(this.off, offT, 1 - Math.exp(-dt * (this.state === 'slam' || this.state === 'laser' ? 30 : 8)));
    this.updateLegs(dt);
    const avg = this.legs.reduce((s, L) => s + L.foot.y, 0) / 4;
    this.by = avg - 170 + Math.sin(this.t * 3.5) * 3 + this.off;
    if (this.alive) {
      const r = P.box();
      if (P.alive && rectsOverlap(r, { x: this.bx - 130, y: this.by - 50, w: 250, h: 100 })) P.kill();
      if (this.phase === 2 && Math.random() < dt * 6) gs.fx.smoke(this.bx + rnd(-60, 60), this.by - 40, 1, 0.8, 39);
      if (Math.random() < dt * 3)
        gs.fx.sparks(this.bx + 5, this.by + 14, rnd(0, TAU), 0.5, 1, 120, [0xffffff, 0xff8040]);
    }
    this.layout();
  }
}
