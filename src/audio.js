const Sound = {
  ctx: null,
  master: null,
  sfx: null,
  mus: null,
  noiseBuf: null,
  muted: false,
  last: {},
  voice: true,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);
    this.mus = ctx.createGain();
    this.mus.gain.value = 0.32;
    this.mus.connect(this.master);
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this._pendingMusic) {
      const p = this._pendingMusic;
      this._pendingMusic = null;
      this.music(p);
    }
  },

  pause(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend();
    else this.ctx.resume();
    if (window.speechSynthesis) {
      if (on) speechSynthesis.pause();
      else speechSynthesis.resume();
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    if (this.muted && window.speechSynthesis) speechSynthesis.cancel();
    return this.muted;
  },

  _env(g, t, vol, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  },

  osc(type, f0, f1, dur, vol, opt = {}) {
    const ctx = this.ctx,
      t = (opt.t || ctx.currentTime) + (opt.delay || 0);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    this._env(g, t, vol, opt.a || 0.003, dur);
    let node = o;
    if (opt.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opt.filter;
      f.frequency.value = opt.ff || 1000;
      f.Q.value = opt.q || 1;
      o.connect(f);
      node = f;
    }
    if (opt.vib) {
      const l = ctx.createOscillator(),
        lg = ctx.createGain();
      l.frequency.value = opt.vib;
      lg.gain.value = opt.vibAmt || 20;
      l.connect(lg);
      lg.connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    node.connect(g);
    g.connect(opt.dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.08);
  },

  noise(dur, vol, ftype, f0, f1, opt = {}) {
    const ctx = this.ctx,
      t = (opt.t || ctx.currentTime) + (opt.delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype;
    f.Q.value = opt.q || 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this._env(g, t, vol, opt.a || 0.002, dur);
    s.connect(f);
    f.connect(g);
    g.connect(opt.dest || this.sfx);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.08);
  },

  play(name, p = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap =
      { hmg: 0.045, pistol: 0.04, enemyShot: 0.05, hit: 0.03, tink: 0.04, step: 0.06, explosion: 0.06, death: 0.08 }[
        name
      ] || 0.02;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.12;
    switch (name) {
      case 'pistol':
        this.noise(0.09, 0.55, 'bandpass', 2600 * r, 500, { q: 0.7 });
        this.osc('square', 520 * r, 90, 0.07, 0.18);
        break;
      case 'hmg':
        this.noise(0.07, 0.5, 'bandpass', 1800 * r, 400, { q: 0.6 });
        this.osc('sawtooth', 240 * r, 55, 0.06, 0.22, { filter: 'lowpass', ff: 1800 });
        break;
      case 'shotgun':
        this.noise(0.35, 0.9, 'lowpass', 4000, 200);
        this.osc('sine', 140, 35, 0.3, 0.7);
        this.noise(0.08, 0.3, 'highpass', 3000, 3000, { delay: 0.32 });
        this.osc('square', 300, 200, 0.04, 0.08, { delay: 0.34 });
        break;
      case 'enemyShot':
        this.osc('square', 700 * r, 180, 0.09, 0.1);
        this.noise(0.06, 0.25, 'bandpass', 1500, 600);
        break;
      case 'explosion': {
        const s = p.size || 1;
        this.noise(0.5 + s * 0.5, 0.9, 'lowpass', 1800, 60, { a: 0.004 });
        this.osc('sine', 110 * r, 28, 0.4 + 0.4 * s, 0.9);
        this.noise(0.25, 0.4, 'bandpass', 600, 150, { delay: 0.05 });
        break;
      }
      case 'bigExplosion':
        this.noise(1.6, 1, 'lowpass', 1400, 40, { a: 0.004 });
        this.osc('sine', 80, 20, 1.3, 1);
        this.osc('sawtooth', 60, 25, 1, 0.3, { filter: 'lowpass', ff: 300 });
        break;
      case 'hit':
        this.noise(0.06, 0.35, 'lowpass', 1200, 300);
        this.osc('sine', 220 * r, 70, 0.08, 0.3);
        break;
      case 'tink':
        this.osc('triangle', 2100 * r, 1500, 0.09, 0.12);
        this.osc('square', 3200 * r, 2600, 0.03, 0.04);
        break;
      case 'clang':
        this.osc('triangle', 380 * r, 140, 0.25, 0.3);
        this.noise(0.18, 0.45, 'bandpass', 700, 300, { q: 2 });
        break;
      case 'wood':
        this.noise(0.2, 0.6, 'bandpass', 500, 200, { q: 1.5 });
        this.osc('triangle', 180, 80, 0.15, 0.3);
        break;
      case 'jump':
        this.osc('square', 180, 420, 0.1, 0.06, { filter: 'lowpass', ff: 1500 });
        break;
      case 'land':
        this.noise(0.07, 0.25, 'lowpass', 500, 120);
        break;
      case 'step':
        this.noise(0.04, 0.06, 'lowpass', 700, 200);
        break;
      case 'throw':
        this.noise(0.15, 0.25, 'bandpass', 700, 2400, { q: 2 });
        break;
      case 'knife':
        this.noise(0.12, 0.4, 'highpass', 2500, 7000);
        this.osc('sawtooth', 900, 1800, 0.08, 0.05);
        break;
      case 'bounce':
        this.osc('triangle', 600 * r, 300, 0.06, 0.1);
        break;
      case 'pickup':
        [0, 0.06, 0.12].forEach((d, i) =>
          this.osc('square', [660, 880, 1320][i], 0, 0.08, 0.12, { delay: d, filter: 'lowpass', ff: 3000 })
        );
        break;
      case 'medal':
        [0, 0.05, 0.1, 0.15].forEach((d, i) =>
          this.osc('triangle', [1046, 1318, 1568, 2093][i], 0, 0.1, 0.15, { delay: d })
        );
        break;
      case 'rescue':
        [0, 0.08, 0.16, 0.24].forEach((d, i) =>
          this.osc('square', [523, 659, 784, 1046][i], 0, 0.12, 0.1, { delay: d, filter: 'lowpass', ff: 2500 })
        );
        break;
      case 'scream':
        this.osc('sawtooth', 820 * r, 380, 0.7, 0.18, { filter: 'bandpass', ff: 1100, q: 3, vib: 14, vibAmt: 45 });
        break;
      case 'death':
        this.osc('sawtooth', 360 * r, 110, 0.28, 0.2, { filter: 'bandpass', ff: 900, q: 2.5 });
        break;
      case 'playerDie':
        this.osc('sawtooth', 500, 70, 0.8, 0.28, { filter: 'bandpass', ff: 1000, q: 2, vib: 8, vibAmt: 30 });
        break;
      case 'alert':
        this.osc('square', 1200, 1600, 0.07, 0.07);
        break;
      case 'beep':
        this.osc('square', p.f || 880, 0, 0.06, 0.08);
        break;
      case 'charge':
        this.osc('sine', 180, 1400, p.dur || 0.8, 0.2, { a: 0.2 });
        break;
      case 'laser':
        this.osc('sawtooth', 110, 90, 1.1, 0.35, { filter: 'lowpass', ff: 1400 });
        this.osc('square', 880, 860, 1.1, 0.06);
        break;
      case 'plasma':
        this.osc('sine', 900, 120, 0.3, 0.3);
        this.noise(0.2, 0.2, 'bandpass', 1200, 400);
        break;
      case 'missile':
        this.noise(0.6, 0.35, 'bandpass', 900, 2200, { q: 1.5 });
        break;
      case 'cannon':
        this.noise(0.6, 1, 'lowpass', 2200, 80);
        this.osc('sine', 90, 30, 0.5, 0.9);
        break;
      case 'roar':
        this.osc('sawtooth', 90, 45, 1.4, 0.4, { filter: 'lowpass', ff: 600, vib: 6, vibAmt: 8 });
        this.noise(1.2, 0.4, 'lowpass', 500, 120);
        break;
      case 'stomp':
        this.osc('sine', 70, 30, 0.3, 0.7);
        this.noise(0.2, 0.4, 'lowpass', 400, 80);
        break;
      case 'rotor':
        this.noise(0.09, 0.12, 'lowpass', 300, 200);
        break;
      case 'engine':
        this.osc('sawtooth', 50 * r, 45, 0.12, 0.08, { filter: 'lowpass', ff: 300 });
        break;
    }
  },

  say(text, opts = {}) {
    if (this.muted || !this.voice || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.pitch = opts.pitch ?? 0.55;
      u.rate = opts.rate ?? 0.95;
      u.volume = 1;
      speechSynthesis.speak(u);
    } catch {
      this.voice = false;
    }
  },

  tracks: {
    main: { tempo: 136, roots: [45, 41, 43, 40], minor: true, lead: [0, 7, 12, 7, 3, 7, 10, 7] },
    boss: { tempo: 158, roots: [45, 46, 45, 43], minor: true, lead: [0, 3, 6, 3, 12, 6, 3, 1] },
    title: { tempo: 110, roots: [45, 41, 36, 43], minor: true, lead: [12, 7, 3, 7, 10, 7, 3, 0] },
  },
  music(name) {
    if (!this.ctx) {
      this._pendingMusic = name;
      return;
    }
    this.stopMusic();
    if (!name) return;
    const tr = this.tracks[name];
    this.cur = { tr, step: 0, next: this.ctx.currentTime + 0.08, name };
    this.timer = setInterval(() => this._sched(), 25);
  },
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.cur = null;
  },
  _mf(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  },
  _sched() {
    const c = this.cur;
    if (!c) return;
    const sp = 60 / c.tr.tempo / 4;
    if (c.next < this.ctx.currentTime - 0.25) c.next = this.ctx.currentTime + 0.05;
    while (c.next < this.ctx.currentTime + 0.12) {
      this._step(c, c.step, c.next);
      c.next += sp;
      c.step++;
    }
  },
  _step(c, s, t) {
    const tr = c.tr,
      D = this.mus,
      sp = 60 / tr.tempo / 4,
      bar = Math.floor(s / 16) % 4,
      i = s % 16;
    const root = tr.roots[bar];
    const boss = c.name === 'boss',
      title = c.name === 'title';
    const kick = boss ? [0, 4, 8, 10, 12] : title ? [0, 8] : [0, 6, 8, 11];
    if (kick.includes(i)) this.osc('sine', 150, 38, 0.16, 0.9, { t, dest: D });
    if ((i === 4 || i === 12) && !title) {
      this.noise(0.13, 0.45, 'highpass', 1200, 900, { t, dest: D });
      this.osc('triangle', 220, 120, 0.08, 0.25, { t, dest: D });
    }
    if (title && i === 12) this.noise(0.3, 0.2, 'highpass', 900, 700, { t, dest: D });
    if (i % 2 === 0 || boss) this.noise(0.03, i % 4 === 2 ? 0.14 : 0.07, 'highpass', 7500, 7000, { t, dest: D });
    const bp = title ? [0, 8] : [0, 3, 6, 8, 10, 12, 14];
    if (bp.includes(i)) {
      const n = root + (i === 6 || i === 14 ? 12 : 0) - 12;
      this.osc('sawtooth', this._mf(n + 12), 0, title ? 0.5 : 0.12, 0.32, {
        t,
        dest: D,
        filter: 'lowpass',
        ff: boss ? 900 : 700,
        q: 4,
      });
    }
    if (i % 2 === 0) {
      const off = tr.lead[(i / 2 + bar * 2) % tr.lead.length];
      const third = tr.minor ? 3 : 4;
      let n = root + 24 + off;
      if (!tr.lead.includes(off)) n += third;
      this.osc('square', this._mf(n), 0, title ? 0.22 : 0.1, title ? 0.07 : 0.06, {
        t,
        dest: D,
        filter: 'lowpass',
        ff: 2600,
      });
    }
    if (i === 0) {
      [0, tr.minor ? 3 : 4, 7].forEach(o =>
        this.osc('triangle', this._mf(root + 24 + o), 0, sp * 14, 0.035, { t, dest: D, a: 0.08 })
      );
    }
  },
  jingle(win = true) {
    if (!this.ctx || this.muted) return;
    const notes = win ? [60, 64, 67, 72, 67, 72, 76, 79] : [64, 63, 62, 61, 60];
    notes.forEach((n, k) =>
      this.osc('square', this._mf(n + 12), 0, win ? 0.16 : 0.3, 0.12, {
        delay: k * (win ? 0.12 : 0.25),
        filter: 'lowpass',
        ff: 3000,
      })
    );
  },
};
