// =====================================================================
//  ESCENAS: Boot, Título, HUD
// =====================================================================
const FONT = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
const TS = (size, color = '#fff', stroke = 5) => ({ fontFamily: FONT, fontSize: size + 'px', color, stroke: '#1a1220', strokeThickness: stroke });

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    genAllTextures(this);
    mkCanvas(this, 'title', 900, 230, (c, w) => {
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      let fsz = 124; c.font = `italic ${fsz}px ${FONT}`;
      while (c.measureText('IRON VANGUARD').width > w - 60 && fsz > 40) { fsz -= 4; c.font = `italic ${fsz}px ${FONT}`; }
      const y = 150;
      c.lineWidth = 18; c.strokeStyle = '#1a1220'; c.strokeText('IRON VANGUARD', w / 2 + 6, y + 8);
      c.lineWidth = 14; c.strokeText('IRON VANGUARD', w / 2, y);
      c.fillStyle = lg(c, 0, 40, 0, y + 10, [[0, '#ffffff'], [0.38, '#ffe9a0'], [0.5, '#f4a020'], [0.62, '#b8461a'], [1, '#ffd070']]);
      c.fillText('IRON VANGUARD', w / 2, y);
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.strokeText('IRON VANGUARD', w / 2, y - 2);
      c.font = `24px ${FONT}`; c.fillStyle = '#ffe9c0'; c.lineWidth = 5; c.strokeStyle = '#1a1220';
      c.strokeText('MISSION 1 — OPERATION SUNSET', w / 2, 205); c.fillText('MISSION 1 — OPERATION SUNSET', w / 2, 205);
    });
    this.scene.start('Title');
  }
}

class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    this.add.image(0, 0, 'sky').setOrigin(0);
    this.layers = [['clouds', 20, 260, 0.01], ['bg_mount', 200, 300, 0.02], ['bg_hills', 250, 260, 0.05], ['bg_near', 300, 240, 0.1]]
      .map(([k, y, h, s]) => [this.add.tileSprite(0, y, GW, h, k).setOrigin(0), s]);
    const g = this.add.graphics();
    g.fillGradientStyle(0x5a3a24, 0x5a3a24, 0x2a1812, 0x2a1812, 1); g.fillRect(0, 470, GW, 70);
    g.fillStyle(0x3e5a26).fillRect(0, 464, GW, 10); g.fillStyle(0x6e8c34).fillRect(0, 462, GW, 4); g.fillStyle(0xe8b060).fillRect(0, 461, GW, 1.5);
    img(this, 120, 474, 'palm').setDepth(5); img(this, 860, 474, 'palm2').setDepth(5).setFlipX(true);
    img(this, 240, 474, 'sandbags').setDepth(30);
    this.logo = this.add.image(GW / 2, 120, 'title').setDepth(90);
    this.tweens.add({ targets: this.logo, y: 126, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // personaje vivo usando el mismo rig procedural
    this.hero = new Humanoid(this, 'pl', { gun: 'g_hmg', tail: true, depth: 60 });
    this.hero.x = 560; this.hero.y = 470; this.hero.f = 1;
    this.pow = new Humanoid(this, 'pw', { armMode: 'swing', depth: 59 }); this.pow.x = 420; this.pow.y = 470; this.pow.f = 1;
    this.fake = { floorAt: () => 470 };
    this.fx = new Fx(this, this.fake);
    this.shootT = 2; this.burst = 0; this.t = 0;

    this.prompt = this.add.text(GW / 2, 262, 'PRESS  ENTER  OR  J  TO  START', TS(30, '#fff6c8', 6)).setOrigin(0.5).setDepth(90);
    const help = [
      '← → / A D   MOVER          ↑ / W   APUNTAR ARRIBA          ↓ / S   AGACHARSE · APUNTAR ABAJO (EN EL AIRE)',
      'J / Z   DISPARAR (CUCHILLO DE CERCA)        K / X / ESPACIO   SALTAR (↓ + SALTO: BAJAR PLATAFORMA)        L / C   GRANADA',
      'M  SONIDO        P / ESC  PAUSA        GAMEPAD COMPATIBLE',
    ];
    this.add.rectangle(GW / 2, 335, 900, 92, 0x1a1220, 0.55).setDepth(89).setStrokeStyle(2, 0xffd070, 0.5);
    help.forEach((l, i) => this.add.text(GW / 2, 306 + i * 28, l, TS(14, i === 2 ? '#ffd070' : '#ffffff', 4)).setOrigin(0.5).setDepth(90));
    this.add.text(GW / 2, 520, 'Arte, animación y sonido 100% procedurales — sin assets externos', TS(14, '#ffe0c0', 4)).setOrigin(0.5).setDepth(90);

    this.started = false; this.audioOn = !!Sound.ctx;
    if (this.audioOn) Sound.music('title');
    const start = () => {
      if (this.started) return;
      Sound.init();
      if (!this.audioOn) { this.audioOn = true; Sound.music('title'); this.prompt.setText('PRESS  ENTER  OR  J  TO  START'); return; }
      this.started = true; Sound.play('pickup'); Sound.music(null);
      this.cameras.main.fadeOut(450, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    };
    // El primer toque habilita el audio (política del navegador); el segundo arranca.
    this.input.keyboard.on('keydown', e => { if (['Enter', 'j', 'J', 'z', 'Z', ' '].includes(e.key)) { if (!this.audioOn) { Sound.init(); this.audioOn = true; Sound.music('title'); } start(); } else { Sound.init(); if (!this.audioOn) { this.audioOn = true; Sound.music('title'); } } });
    this.input.on('pointerdown', () => { if (!this.audioOn) { Sound.init(); this.audioOn = true; Sound.music('title'); } else start(); });
    this.cameras.main.fadeIn(500);
  }
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000; this.t += dt;
    this.layers.forEach(([ts, s], i) => ts.tilePositionX += s * delta * (i === 0 ? 0.3 : 1));
    this.prompt.setAlpha(0.55 + Math.sin(this.t * 5) * 0.45);
    const H = this.hero;
    this.shootT -= dt;
    H.aim = approach(H.aim, Math.sin(this.t * 0.7) > 0.6 ? -Math.PI / 2 : -0.12, dt * 6);
    if (this.shootT <= 0) {
      this.burst = 8; this.shootT = rnd(2.5, 4);
    }
    if (this.burst > 0 && (this.bt = (this.bt || 0) - dt) <= 0) {
      this.burst--; this.bt = 0.07; H.recoil = 3.5;
      const m = H.muzzle; this.fx.muzzle(m.x, m.y, m.a, 0.9); this.fx.shell(H.eject.x, H.eject.y, 1);
      this.fx.emit({ x: m.x, y: m.y, vx: Math.cos(m.a) * 900, vy: Math.sin(m.a) * 900, tex: 'b_hmg', rot: m.a, life: 0.6, s0: 1, s1: 1, a0: 1, a1: 1, depth: 70 });
      Sound.play('hmg');
    }
    H.pose(dt, { move: 0, grounded: true, vy: 0, crouch: false, groundAt: () => 0 });
    this.pow.pose(dt, { move: 0, grounded: true, vy: 0, crouch: false, groundAt: () => 0 });
    if (Math.sin(this.t * 0.9) > 0.97 && !this.pow.act) this.pow.playAct('salute', 1.0);
    this.fx.update(dt);
  }
}

// ---------------------------------------------------------------------
class HudScene extends Phaser.Scene {
  constructor() { super('Hud'); }
  create() {
    this.gs = this.scene.get('Game');
    this.continueOn = false; this.completeReady = false;
    this.g = this.add.graphics();
    this.add.text(22, 10, '1UP', TS(16, '#8ad0ff', 4));
    this.tScore = this.add.text(62, 4, '0', TS(28, '#ffe680', 5));
    this.heads = [0, 1, 2, 3, 4].map(i => img(this, 34 + i * 22, 66, 'pl_head').setScale(0.62));
    this.tArmsL = this.add.text(30, 82, 'ARMS', TS(13, '#ffd070', 3));
    this.tBombL = this.add.text(112, 82, 'BOMB', TS(13, '#ffd070', 3));
    this.tArms = this.add.text(30, 96, '∞', TS(22, '#ffffff', 4));
    this.tBomb = this.add.text(112, 96, '10', TS(22, '#ffffff', 4));
    this.tWeapon = this.add.text(30, 124, '', TS(12, '#c8e8ff', 3));
    this.tMission = this.add.text(GW - 20, 10, 'MISSION 1', TS(18, '#ffffff', 4)).setOrigin(1, 0);
    this.tTime = this.add.text(GW - 20, 32, '', TS(16, '#ffe0b0', 4)).setOrigin(1, 0);
    this.tBoss = this.add.text(GW / 2, 12, '', TS(16, '#ffb0a0', 4)).setOrigin(0.5, 0);
    this.help = this.add.text(GW / 2, GH - 22, '← →  mover   ·   ↑  apuntar   ·   J  disparar   ·   K  saltar   ·   L  granada   ·   ↓  agacharse', TS(16, '#ffffff', 4)).setOrigin(0.5);
    this.tweens.add({ targets: this.help, alpha: 0, delay: 9000, duration: 1200 });
    this.goArrow = img(this, GW - 70, GH / 2 - 30, 'arrow').setVisible(false);
    this.goText = this.add.text(GW - 70, GH / 2 + 10, 'GO!', TS(34, '#fff27a', 6)).setOrigin(0.5).setVisible(false);
    this.toastT = this.add.text(GW / 2, 150, '', TS(22, '#ffffff', 5)).setOrigin(0.5).setAlpha(0);
    this.pauseT = this.add.text(GW / 2, GH / 2, 'PAUSE', TS(64, '#ffffff', 8)).setOrigin(0.5).setVisible(false);
    this.dim = this.add.rectangle(0, 0, GW, GH, 0x0a0410, 0.6).setOrigin(0).setVisible(false);
    this.dim.setDepth(50); this.pauseT.setDepth(60);
    this.bigA = this.add.text(GW / 2, GH / 2 - 40, '', TS(72, '#ffe680', 10)).setOrigin(0.5).setAlpha(0);
    this.bigB = this.add.text(GW / 2, GH / 2 + 34, '', TS(52, '#ffffff', 9)).setOrigin(0.5).setAlpha(0);
    this.panel = this.add.container(0, 0).setVisible(false);
    this.t = 0;
  }
  banner(a, b) {
    this.bigA.setText(a).setScale(0).setAlpha(1); this.bigB.setText(b).setScale(0).setAlpha(1);
    this.tweens.add({ targets: this.bigA, scale: 1, duration: 450, ease: 'Back.out' });
    this.tweens.add({ targets: this.bigB, scale: 1, duration: 450, delay: 250, ease: 'Back.out' });
    this.tweens.add({ targets: [this.bigA, this.bigB], alpha: 0, delay: 2200, duration: 500 });
  }
  toast(msg) {
    this.toastT.setText(msg).setAlpha(1).setScale(1.3);
    this.tweens.killTweensOf(this.toastT);
    this.tweens.add({ targets: this.toastT, scale: 1, duration: 200 });
    this.tweens.add({ targets: this.toastT, alpha: 0, delay: 1400, duration: 400 });
  }
  warning(big) {
    const bars = [80, GH - 80].map(y => this.add.rectangle(GW / 2, y, GW, 34, 0xd02020, 0.75));
    const tx = this.add.text(GW / 2, GH / 2 - 20, 'WARNING!!', TS(80, '#ff4a3a', 10)).setOrigin(0.5);
    const sub = this.add.text(GW / 2, GH / 2 + 46, big ? 'GIANT ENEMY APPROACHING' : 'HEAVY ARMOR DETECTED', TS(26, '#ffffff', 5)).setOrigin(0.5);
    let n = 0;
    const ev = this.time.addEvent({
      delay: 280, repeat: 9, callback: () => {
        n++; const v = n % 2 === 0; [tx, sub, ...bars].forEach(o => o.setVisible(v));
        if (v) Sound.play('beep', { f: 520 });
        if (n >= 10) [tx, sub, ...bars].forEach(o => o.destroy());
      },
    });
  }
  setPaused(p) { this.pauseT.setVisible(p); this.dim.setVisible(p); }
  showContinue(onYes, onNo) {
    this.continueOn = true; this.onYes = onYes; this.onNo = onNo; this.cnt = 9.99;
    this.dim.setVisible(true);
    this.cTitle = this.add.text(GW / 2, GH / 2 - 70, 'CONTINUE?', TS(64, '#ffe680', 9)).setOrigin(0.5).setDepth(60);
    this.cNum = this.add.text(GW / 2, GH / 2 + 20, '9', TS(96, '#ffffff', 10)).setOrigin(0.5).setDepth(60);
    this.cHint = this.add.text(GW / 2, GH / 2 + 100, 'PRESS FIRE', TS(24, '#ffffff', 5)).setOrigin(0.5).setDepth(60);
    Sound.music(null); Sound.jingle(false);
  }
  continueInput(I) {
    if (!this.continueOn || this.gameOver) return;
    if (I.fireP || I.startP) {
      this.continueOn = false; this.dim.setVisible(false); [this.cTitle, this.cNum, this.cHint].forEach(o => o.destroy());
      Sound.play('pickup'); Sound.music('main'); this.onYes();
    } else if (I.jumpP) this.cnt = Math.floor(this.cnt) - 0.001; // acelera la cuenta
  }
  complete() {
    this.dim.setVisible(true);
    const gs = this.gs, s = gs.stats;
    const title = this.add.text(GW / 2, 130, '', TS(64, '#ffe680', 9)).setOrigin(0.5).setDepth(60);
    const full = 'MISSION COMPLETE!';
    let i = 0;
    this.time.addEvent({ delay: 70, repeat: full.length - 1, callback: () => { title.setText(full.slice(0, ++i)); Sound.play('beep', { f: 600 + i * 30 }); } });
    const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60).toString().padStart(2, '0');
    const rows = [['ENEMIES DEFEATED', s.kills], ['PRISONERS RESCUED', s.pows + ' / ' + LEVEL.pows.length], ['MISSION TIME', mm + ':' + ss], ['CONTINUES', s.continues], ['FINAL SCORE', gs.score]];
    rows.forEach((r, k) => this.time.delayedCall(1500 + k * 450, () => {
      this.add.text(GW / 2 - 230, 210 + k * 46, r[0], TS(28, '#ffffff', 5)).setDepth(60);
      this.add.text(GW / 2 + 230, 210 + k * 46, '' + r[1], TS(28, k === 4 ? '#ffe680' : '#a8f0ff', 5)).setOrigin(1, 0).setDepth(60);
      Sound.play('beep', { f: 880 });
    }));
    this.time.delayedCall(1500 + rows.length * 450 + 400, () => {
      const p = this.add.text(GW / 2, 470, 'THANKS FOR PLAYING  —  PRESS ENTER', TS(26, '#fff6c8', 5)).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: p, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 });
      this.completeReady = true;
    });
  }
  update(time, delta) {
    const gs = this.gs; if (!gs || !gs.player) return;
    const dt = delta / 1000; this.t += dt;
    const P = gs.player;
    this.tScore.setText(gs.score.toLocaleString('en-US'));
    this.heads.forEach((h, i) => h.setVisible(i < Math.max(0, gs.lives + (P.dead ? 0 : 1))));
    this.tArms.setText(P.ammo === Infinity ? '∞' : '' + P.ammo);
    this.tBomb.setText('' + P.bombs);
    this.tWeapon.setText(WEAPONS[P.weapon].name);
    const s = gs.stats.time; this.tTime.setText(Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0'));
    const g = this.g; g.clear();
    g.fillStyle(0x1a1220, 0.55).fillRoundedRect(20, 80, 170, 60, 8);
    g.lineStyle(2, 0xffd070, 0.6).strokeRoundedRect(20, 80, 170, 60, 8);
    g.lineStyle(1, 0xffd070, 0.4).lineBetween(104, 86, 104, 132);
    // barra del jefe
    const B = gs.boss;
    if (B && B.hp > 0) {
      const w = 420, x = GW / 2 - w / 2, y = 36, k = Math.max(0, B.hp / B.max);
      this.tBoss.setText(B.name).setVisible(true);
      g.fillStyle(0x1a1220, 0.8).fillRect(x - 4, y - 4, w + 8, 20);
      g.fillStyle(0x5a1010, 1).fillRect(x, y, w, 12);
      g.fillStyle(k < 0.3 ? 0xff5030 : 0xffb020, 1).fillRect(x, y, w * k, 12);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, w * k, 4);
      g.lineStyle(2, 0xffe6a0, 0.9).strokeRect(x - 4, y - 4, w + 8, 20);
    } else this.tBoss.setVisible(false);
    // GO!
    const go = gs.goT > 0 && Math.floor(this.t * 4) % 2 === 0;
    this.goArrow.setVisible(go).x = GW - 80 + Math.sin(this.t * 12) * 8; this.goText.setVisible(go);
    // cuenta atrás de continuar
    if (this.continueOn && !this.gameOver) {
      this.cnt -= dt;
      const n = Math.max(0, Math.floor(this.cnt));
      if (this.cNum.text !== '' + n) { this.cNum.setText('' + n).setScale(1.4); this.tweens.add({ targets: this.cNum, scale: 1, duration: 200 }); Sound.play('beep', { f: 300 + n * 40 }); }
      if (this.cnt <= 0) {
        this.gameOver = true; this.cTitle.setText('GAME OVER').setColor('#ff6a5a'); this.cNum.setVisible(false); this.cHint.setVisible(false);
        Sound.say('Game over'); this.time.delayedCall(2600, () => this.onNo());
      }
    }
  }
}
