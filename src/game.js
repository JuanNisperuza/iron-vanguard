// bullets only test targets within this horizontal distance
const NEAR = 330;

const Save = {
  key: 'iron-vanguard-hi',
  get() {
    try {
      return Number(localStorage.getItem(this.key)) || 0;
    } catch {
      return 0;
    }
  },
  set(v) {
    try {
      localStorage.setItem(this.key, String(v));
    } catch {
      this.get = () => 0;
    }
  },
};

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.camX = 0;
    this.lockX = null;
    this.evIdx = 0;
    this.ts = 1;
    this.stopT = 0;
    this.goT = 0;
    this.missionDone = false;
    this.cutscene = false;
    this.paused = false;
    this.boss = null;
    this.stats = { kills: 0, pows: 0, shots: 0, time: 0, continues: 0 };
    this.score = 0;
    this.lives = 2;
    this.hi = Save.get();
    this.actors = [];
    this.targets = [];
    this.proj = [];

    this.world = new World(this);
    this.world.build();
    this.fx = new Fx(this, this.world);
    this.player = new Player(this, 130);

    LEVEL.crates.forEach(([x, it]) => this.addActor(new Crate(this, x, it), true));
    LEVEL.barrels.forEach(x => this.addActor(new Barrel(this, x), true));
    LEVEL.pows.forEach(([x, it]) => this.addActor(new Pow(this, x, it), true));

    this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(96);
    this.whiteFlash = this.add
      .rectangle(0, 0, GW, GH, 0xffffff)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(97)
      .setAlpha(0);

    this.setupInput();
    this.scene.launch('Hud');
    this.hud = this.scene.get('Hud');
    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
      Save.set(this.hi);
      Sound.pause(false);
      this.scene.stop('Hud');
    });
    Sound.music('main');
    this.time.delayedCall(500, () => {
      this.hud.banner('MISSION 1', 'START!');
      Sound.say('Mission one. Start!');
    });
    this.emberT = 0;
  }

  setupInput() {
    const KB = this.input.keyboard;
    this.keys = KB.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,J,K,L,Z,X,C,SPACE,ENTER');
    KB.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    this.pressQ = { fire: false, jump: false, bomb: false, start: false };
    const map = { J: 'fire', Z: 'fire', K: 'jump', X: 'jump', SPACE: 'jump', L: 'bomb', C: 'bomb', ENTER: 'start' };
    KB.on('keydown', e => {
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key === ' ' ? 'SPACE' : e.key.toUpperCase();
      if (map[k]) this.pressQ[map[k]] = true;
      if (k === 'M') {
        const m = Sound.toggleMute();
        this.hud.toast(m ? 'SOUND OFF' : 'SOUND ON');
      }
      if (k === 'P' || k === 'ESCAPE') this.togglePause();
    });
    this.padPrev = {};
  }
  readInput() {
    const k = this.keys,
      q = this.pressQ;
    const I = {
      left: k.LEFT.isDown || k.A.isDown,
      right: k.RIGHT.isDown || k.D.isDown,
      up: k.UP.isDown || k.W.isDown,
      down: k.DOWN.isDown || k.S.isDown,
      fire: k.J.isDown || k.Z.isDown,
      jump: k.K.isDown || k.X.isDown || k.SPACE.isDown,
      bomb: k.L.isDown || k.C.isDown,
      fireP: q.fire,
      jumpP: q.jump,
      bombP: q.bomb,
      startP: q.start,
    };
    const pad = this.input.gamepad && this.input.gamepad.total ? this.input.gamepad.getPad(0) : null;
    if (pad) {
      const ax = pad.leftStick ? pad.leftStick.x : 0,
        ay = pad.leftStick ? pad.leftStick.y : 0;
      I.left ||= pad.left || ax < -0.4;
      I.right ||= pad.right || ax > 0.4;
      I.up ||= pad.up || ay < -0.5;
      I.down ||= pad.down || ay > 0.5;
      const b = i => pad.buttons[i] && pad.buttons[i].pressed;
      const cur = { fire: b(2) || b(5) || b(7), jump: b(0), bomb: b(1) || b(3) || b(4), start: b(9) };
      for (const n in cur) {
        if (cur[n] && !this.padPrev[n]) I[n + 'P'] = true;
        if (cur[n]) I[n] = true;
      }
      this.padPrev = cur;
    }
    q.fire = q.jump = q.bomb = q.start = false;
    return I;
  }
  togglePause() {
    if (this.missionDone || this.hud.continueOn) return;
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
    if (this.paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = this.paused;
    Sound.pause(this.paused);
  }
  autoPause() {
    if (!this.paused) this.togglePause();
  }

  addActor(a, target = false) {
    this.actors.push(a);
    if (target) this.targets.push(a);
    return a;
  }
  addPBullet(x, y, a, spd, tex, dmg, life) {
    const im = this.add.image(x, y, tex).setRotation(a).setDepth(70);
    this.proj.push({ type: 'pb', x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, life, im, owner: 'player' });
  }
  addEBullet(x, y, a, spd) {
    const im = this.add.image(x, y, 'b_en').setDepth(71).setBlendMode(Phaser.BlendModes.ADD);
    this.proj.push({
      type: 'eb',
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 4,
      im,
      owner: 'enemy',
      t: 0,
    });
  }
  addGrenade(x, y, vx, vy, owner) {
    const im = this.add.image(x, y, 'grenade').setDepth(66);
    this.proj.push({
      type: 'gren',
      x,
      y,
      vx,
      vy,
      grav: 1100,
      life: 2.2,
      im,
      owner,
      bounces: 0,
      vr: Math.sign(vx) * 14,
    });
  }
  addProj(o) {
    o.im = this.add.image(o.x, o.y, o.tex || 'fx_dot').setDepth(70);
    if (o.scale) o.im.setScale(o.scale);
    if (o.type === 'plasma') o.im.setBlendMode(Phaser.BlendModes.ADD);
    if (o.type === 'wave') {
      o.im.setTexture('shockwave').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(47);
      o.life = 2.6;
    }
    o.life = o.life || 5;
    o.t = 0;
    this.proj.push(o);
  }
  countProj(type, owner) {
    let n = 0;
    for (const p of this.proj) if (p.type === type && p.owner === owner) n++;
    return n;
  }
  countBusyShooters() {
    let n = 0;
    for (const a of this.actors) if (a.isEnemy && a.alive && (a.state === 'aim' || a.state === 'fire')) n++;
    return n;
  }
  findKnifeTarget(p) {
    for (const e of this.actors) {
      if (!e.isEnemy || !e.alive) continue;
      const dx = (e.x - p.x) * p.f;
      if (dx > -10 && dx < 42 && Math.abs(e.y - p.y) < 40) return e;
    }
    return null;
  }
  spawnPickup(type, x, y, vx = 0) {
    this.addActor(new Pickup(this, type, x, y, vx));
  }
  addScore(n, x, y) {
    this.score += n;
    if (this.score > this.hi) this.hi = this.score;
    if (x !== undefined) this.fx.popup(x, y, '' + n);
  }
  onKill(e, kind) {
    this.stats.kills++;
    this.addScore(kind === 'knife' ? 200 : 100, e.x, e.y - 70);
  }
  shake(ms, k) {
    this.cameras.main.shake(ms, k, false);
  }
  hitstop(t) {
    this.stopT = Math.max(this.stopT, t);
  }
  flashWhite() {
    this.whiteFlash.setAlpha(1);
    this.tweens.add({ targets: this.whiteFlash, alpha: 0, duration: 900 });
  }
  explode(x, y, r, dmg, owner, size = 1) {
    this.fx.explosion(x, y, size, true);
    Sound.play(size > 1.8 ? 'bigExplosion' : 'explosion', { size });
    this.shake(180 + 100 * size, 0.004 * size);
    if (dmg > 0) {
      for (const t of this.targets.slice()) {
        if (!t.alive || t.dead || t instanceof Pow) continue;
        if (circleRect(x, y, r, t.box())) t.hit(dmg, { kind: 'explosion', x, y, dir: Math.sign(t.x - x) || 1 });
      }
      if (owner === 'enemy' && this.player.alive && circleRect(x, y, r * 0.8, this.player.box())) this.player.kill();
    }
  }

  runEvent(ev) {
    if (ev.spawn)
      ev.spawn.forEach(([kind, x, mode, anchor, delay]) => {
        const go = () => {
          let px = x === 'R' ? this.camX + GW + 40 : x,
            py;
          if (mode === 'para') py = -50;
          else if (anchor) py = this.world.named[anchor].y;
          else py = this.world.groundY(px);
          this.addActor(new Soldier(this, kind, px, py, mode, anchor), true);
        };
        delay ? this.time.delayedCall(delay * 1000, go) : go();
      });
    if (ev.heli) {
      const h = this.addActor(new Heli(this, this.camX + GW + 140), true);
      this.boss = h;
      this.hud.toast('WARNING: GUNSHIP');
      Sound.play('alert');
    }
    if (ev.lock !== undefined) {
      this.lockX = ev.lock;
      if (ev.boss === 'tank') {
        this.boss = this.addActor(new Tank(this, ev.lock + GW + 140), true);
        this.hud.warning();
      }
      if (ev.boss === 'walker') {
        this.boss = this.addActor(new Walker(this, ev.lock + GW + 260), true);
        Sound.music(null);
        this.hud.warning(true);
        this.time.delayedCall(1800, () => Sound.music('boss'));
      }
    }
  }
  onBossDead(kind) {
    if (kind === 'tank') {
      this.lockX = null;
      this.goT = 3.5;
      this.time.delayedCall(1800, () => this.boss && !this.boss.alive && (this.boss = null));
      this.time.delayedCall(800, () => Sound.say('Great!'));
    }
    if (kind === 'heli') {
      this.time.delayedCall(800, () => {
        if (this.boss && !this.boss.alive) this.boss = null;
      });
    }
    if (kind === 'walker') {
      this.missionDone = true;
      this.cutscene = true;
      this.ts = 0.35;
      this.time.delayedCall(700, () => {
        this.ts = 1;
      });
      this.time.delayedCall(2400, () => {
        Sound.music(null);
        Sound.jingle(true);
        Sound.say('Mission complete!', { pitch: 0.6, rate: 0.9 });
        this.player.rig.playAct('cheer', 3);
        this.hud.complete();
      });
    }
  }
  playerDied() {
    this.lives--;
    if (this.lives >= 0) this.respawn();
    else
      this.hud.showContinue(
        () => {
          this.stats.continues++;
          this.lives = 2;
          this.score = 0;
          this.respawn();
        },
        () => this.toTitle()
      );
  }
  respawn() {
    this.player.respawn(this.camX + 200);
    this.proj
      .filter(p => p.owner === 'enemy' && !p.dead)
      .forEach(p => {
        p.dead = true;
        p.im.destroy();
        this.fx.glow(p.x, p.y, 0.3, 0xffffff);
      });
  }
  toTitle() {
    Sound.music(null);
    this.scene.stop('Hud');
    this.scene.start('Title');
  }

  update(time, delta) {
    let dt = Math.min(delta, 50) / 1000;
    const I = this.readInput();
    if (this.hud.continueOn) this.hud.continueInput(I);
    if (this.missionDone && this.hud.completeReady && (I.startP || I.fireP)) {
      this.toTitle();
      return;
    }
    if (this.paused) return;
    if (this.stopT > 0) {
      this.stopT -= dt;
      dt *= 0.06;
    }
    dt *= this.ts;
    this.stats.time += this.missionDone ? 0 : dt;

    this.player.update(dt, I);
    this.updateCamera(dt);
    while (this.evIdx < LEVEL.events.length && this.camX + GW >= LEVEL.events[this.evIdx].at - 1)
      this.runEvent(LEVEL.events[this.evIdx++]);

    for (const a of this.actors) if (!a.dead) a.update(dt);
    this.updateProj(dt);
    this.fx.update(dt);
    this.world.updateParallax(this.cameras.main, time);

    this.actors = this.prune(this.actors);
    this.targets = this.prune(this.targets);
    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = 0.09;
      this.fx.emit({
        x: this.camX + rnd(0, GW),
        y: GH + 10,
        vx: rnd(-20, 30),
        vy: rnd(-50, -90),
        tex: 'fx_dot',
        life: rnd(4, 7),
        s0: rnd(0.07, 0.14),
        s1: 0.02,
        a0: 0.9,
        a1: 0,
        cols: [0xffd080, 0xff5020],
        add: true,
        depth: 92,
      });
    }
    if (this.goT > 0) this.goT -= dt;
    if (!this.lockX && !this.missionDone) {
      const busy = this.actors.some(a => (a.isEnemy || a.isBoss) && a.alive);
      this.idleT = !busy && Math.abs(this.player.vx) < 5 ? (this.idleT || 0) + dt : 0;
      if (this.idleT > 3) {
        this.goT = 2;
        this.idleT = 0;
      }
    }
  }
  prune(list) {
    let j = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[j++] = list[i];
    list.length = j;
    return list;
  }
  updateCamera(dt) {
    let maxX = LEVEL.length - GW;
    for (let i = this.evIdx; i < LEVEL.events.length; i++)
      if (LEVEL.events[i].lock !== undefined) {
        maxX = Math.min(maxX, LEVEL.events[i].lock);
        break;
      }
    if (this.lockX !== null) maxX = this.lockX;
    const target = this.player.x - GW * 0.4;
    if (target > this.camX) this.camX = Math.min(maxX, this.camX + (target - this.camX) * Math.min(1, dt * 6));
    this.cameras.main.scrollX = this.camX;
  }
  updateProj(dt) {
    const P = this.player,
      W = this.world;
    for (const p of this.proj) {
      if (p.dead) continue;
      p.life -= dt;
      p.t = (p.t || 0) + dt;
      if (p.grav) p.vy += p.grav * dt;
      const px = p.x,
        py = p.y;
      p.x += p.vx * dt;
      p.y += (p.vy || 0) * dt;
      p.im.x = p.x;
      p.im.y = p.y;
      const outside = p.x < this.camX - 60 || p.x > this.camX + GW + 60 || p.y > GH + 40 || p.y < -200;
      switch (p.type) {
        case 'pb': {
          if (p.life <= 0 || outside) {
            p.dead = true;
            break;
          }
          if (p.y >= W.groundY(p.x)) {
            p.dead = true;
            this.fx.bulletHit(p.x, W.groundY(p.x), 0, 'ground');
            break;
          }
          const n = Math.max(1, Math.ceil(Math.hypot(p.x - px, p.y - py) / 8));
          let hitT = null,
            hx = p.x,
            hy = p.y;
          for (let k = p.t <= dt ? 0 : 1; k <= n && !hitT; k++) {
            const sx = px + ((p.x - px) * k) / n,
              sy = py + ((p.y - py) * k) / n;
            for (const t of this.targets)
              if (t.alive && !t.dead && Math.abs(t.x - sx) < NEAR && t.hitTest(sx, sy)) {
                hitT = t;
                hx = sx;
                hy = sy;
                break;
              }
          }
          if (hitT) {
            p.x = hx;
            p.y = hy;
          }
          for (const t of hitT ? [hitT] : []) {
            const kind = t.hit(p.dmg, { kind: 'bullet', dir: Math.sign(p.vx) || 1, x: px, y: py });
            if (kind !== 'none')
              this.fx.bulletHit(p.x, p.y, Math.atan2(p.vy, p.vx), kind === 'metal' ? 'metal' : 'flesh');
            if (kind === 'metal') Sound.play('tink');
            else if (kind === 'flesh') Sound.play('hit');
            p.dead = true;
            break;
          }
          break;
        }
        case 'eb': {
          p.im.setScale(1 + Math.sin(p.t * 30) * 0.15);
          if (p.life <= 0 || outside) {
            p.dead = true;
            break;
          }
          if (p.y >= W.groundY(p.x)) {
            p.dead = true;
            this.fx.bulletHit(p.x, p.y, 0, 'ground');
            break;
          }
          if (P.alive && rectHit(P.box(), p.x, p.y)) {
            p.dead = true;
            P.kill();
          }
          break;
        }
        case 'gren': {
          p.im.rotation += p.vr * dt;
          const fl = W.floorAt(p.x, py);
          let boom = p.life <= 0;
          if (p.y >= fl) {
            p.y = fl - 1;
            if (p.bounces++ >= 1 || (p.owner === 'enemy' && p.bounces > 1)) boom = true;
            else {
              p.vy = -Math.abs(p.vy) * 0.42;
              p.vx *= 0.55;
              p.vr *= 0.5;
              Sound.play('bounce');
            }
          }
          if (p.owner === 'player') {
            for (const t of this.targets)
              if (
                t.alive &&
                Math.abs(t.x - p.x) < NEAR &&
                !(t instanceof Pow) &&
                !(t instanceof Crate) &&
                !(t instanceof Barrel) &&
                t.hitTest(p.x, p.y)
              )
                boom = true;
          } else if (P.alive && rectHit(P.box(), p.x, p.y)) boom = true;
          if (boom) {
            p.dead = true;
            this.explode(p.x, p.y - 6, 72, 10, p.owner, 1);
          }
          break;
        }
        case 'tshell':
        case 'bomb': {
          p.im.rotation = Math.atan2(p.vy, p.vx);
          if (p.y >= W.groundY(p.x) || (P.alive && rectHit(P.box(), p.x, p.y)) || p.life <= 0) {
            p.dead = true;
            this.explode(p.x, Math.min(p.y, W.groundY(p.x)) - 6, 68, 0, 'enemy', 1.2);
          }
          if (p.type === 'tshell' && Math.random() < 0.5)
            this.fx.emit({
              x: p.x,
              y: p.y,
              tex: 'fx_soft',
              life: 0.4,
              s0: 0.25,
              s1: 0.5,
              a0: 0.5,
              a1: 0,
              cols: [0xc0b0a0, 0x504848],
              depth: 69,
            });
          break;
        }
        case 'plasma': {
          p.im.setScale(1 + Math.sin(p.t * 25) * 0.2).rotation += dt * 8;
          if (outside || p.life <= 0) {
            p.dead = true;
            break;
          }
          if (p.y >= W.groundY(p.x)) {
            p.dead = true;
            this.fx.explosion(p.x, p.y, 0.5, false);
            this.fx.ring(p.x, p.y, 0.6, 0xff60c0);
            Sound.play('explosion', { size: 0.4 });
            break;
          }
          if (P.alive && circleRect(p.x, p.y, 9, P.box())) {
            p.dead = true;
            P.kill();
          }
          if (Math.random() < 0.6)
            this.fx.emit({
              x: p.x,
              y: p.y,
              tex: 'fx_dot',
              life: 0.25,
              s0: 0.5,
              s1: 0,
              cols: [0xff9ae0, 0xa02080],
              add: true,
              depth: 69,
            });
          break;
        }
        case 'wave': {
          p.y = W.groundY(p.x);
          p.im.y = p.y + 4;
          p.im.setScale(1 + Math.sin(p.t * 30) * 0.12, 0.9 + Math.sin(p.t * 22) * 0.2);
          if (Math.random() < 0.7) this.fx.dust(p.x, p.y, 1, 0.5);
          if (p.life <= 0 || outside) {
            p.dead = true;
            break;
          }
          if (P.alive && Math.abs(P.x - p.x) < 24 && P.y > p.y - 26) P.kill();
          break;
        }
      }
      if (p.dead) p.im.destroy();
    }
    if (this.proj.some(p => p.dead)) this.proj = this.proj.filter(p => !p.dead);
  }
}
