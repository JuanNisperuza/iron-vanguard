const OUT = '#1a1220';
const Tex = { O: {}, M: {} };

function rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
}
function shade(h, k) {
  const c = rgb(h).map(v => (k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return (
    '#' +
    c
      .map(v =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
function mulberry(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mkCanvas(scene, key, w, h, fn) {
  w = Math.ceil(w);
  h = Math.ceil(h);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const ct = scene.textures.createCanvas(key, w, h);
  const c = ct.context;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  fn(c, w, h);
  ct.refresh();
  return ct;
}
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function lg(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  return g;
}
function rg(c, x, y, r0, r1, stops) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  return g;
}
function fs(c, fill, lw = 2.2, stroke = OUT) {
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (lw) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function line(c, x0, y0, x1, y1, w, col) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.lineWidth = w;
  c.strokeStyle = col;
  c.stroke();
}

function limbTex(scene, key, len, t, col, extra, opt = {}) {
  const p = 3,
    w = len + t + p * 2,
    h = t + p * 2,
    cy = h / 2,
    j0 = p + t / 2;
  mkCanvas(scene, key, w, h, c => {
    const path = () => {
      c.beginPath();
      rr(c, p, cy - t / 2, len + t, t, t / 2);
    };
    path();
    c.fillStyle = lg(c, 0, cy - t / 2, 0, cy + t / 2, [
      [0, shade(col, 0.22)],
      [0.45, col],
      [1, shade(col, -0.32)],
    ]);
    c.fill();
    if (extra) {
      c.save();
      path();
      c.clip();
      extra(c, j0, cy, len, t);
      c.restore();
    }
    path();
    c.lineWidth = opt.lw || 2.2;
    c.strokeStyle = OUT;
    c.stroke();
  });
  Tex.O[key] = [j0 / w, 0.5];
}

const PALS = {
  pl: {
    skin: '#f2c08c',
    hair: '#3a2212',
    band: '#dd3b24',
    sleeve: '#cdb68a',
    vest: '#2d5c92',
    shirt: '#cdb68a',
    pants: '#7e7149',
    pad: '#3a3a36',
    boot: '#3e2c1e',
    glove: '#2a2a30',
    head: 'player',
    bareArm: true,
  },
  en: {
    skin: '#e3ad7a',
    hair: '#2a1a10',
    helmet: '#56633a',
    shirt: '#6e7c45',
    vest: '#6e7c45',
    pants: '#5d6a3a',
    pad: '#4a5530',
    boot: '#2c241c',
    glove: '#3d3426',
    head: 'helmet',
  },
  eg: {
    skin: '#dba174',
    hair: '#2a1a10',
    cap: '#b03a2c',
    shirt: '#8c7c50',
    vest: '#8c7c50',
    pants: '#6c613e',
    pad: '#5a5034',
    boot: '#2c241c',
    glove: '#3d3426',
    head: 'beret',
    grenades: true,
  },
  ek: {
    skin: '#e0a878',
    hair: '#111',
    shirt: '#4a5040',
    vest: '#3d4335',
    pants: '#3e4436',
    pad: '#2c3026',
    boot: '#1e1a16',
    glove: '#222',
    head: 'mask',
  },
  pw: {
    skin: '#eab585',
    hair: '#5a3418',
    shirt: '#ebe6da',
    vest: '#ebe6da',
    pants: '#77736a',
    pad: '#5a564e',
    boot: '#3a3028',
    glove: '#eab585',
    head: 'pow',
    bareArm: true,
    tank: true,
  },
};

function humanSet(scene, k, P) {
  limbTex(scene, k + '_thigh', 19, 12.5, P.pants, (c, j, cy, len, t) => {
    c.beginPath();
    rr(c, j + 4, cy - 1, 9, 6, 2);
    fs(c, shade(P.pants, -0.25), 1.2);
    c.beginPath();
    c.ellipse(j + len - 1, cy - t / 2 + 2, 5.5, 3.6, 0, 0, 7);
    fs(c, P.pad, 1.4);
  });
  limbTex(scene, k + '_shin', 19, 10.5, P.pants, (c, j, cy, len, t) => {
    c.fillStyle = shade(P.boot, 0.05);
    c.fillRect(j + len - 5, 0, 20, 40);
    line(c, j + len - 5, cy - t, j + len - 5, cy + t, 1.4, OUT);
  });
  limbTex(scene, k + '_uarm', 13, 9.5, P.bareArm && P.tank ? P.skin : P.shirt, (c, j, cy, len) => {
    if (P.bareArm && !P.tank) {
      c.fillStyle = shade(P.shirt, -0.15);
      c.fillRect(j + len - 3, 0, 4, 40);
    }
  });
  limbTex(scene, k + '_farm', 12, 8.5, P.bareArm ? P.skin : P.shirt, (c, j, cy, len) => {
    if (!P.bareArm) {
      c.fillStyle = shade(P.shirt, -0.25);
      c.fillRect(j + len - 3, 0, 3, 40);
    }
  });
  mkCanvas(scene, k + '_hand', 14, 14, c => {
    c.beginPath();
    c.arc(7, 7, 4.6, 0, 7);
    fs(
      c,
      lg(c, 0, 2, 0, 12, [
        [0, shade(P.glove, 0.25)],
        [1, shade(P.glove, -0.2)],
      ]),
      2
    );
  });
  Tex.O[k + '_hand'] = [0.5, 0.5];
  mkCanvas(scene, k + '_boot', 30, 18, c => {
    c.beginPath();
    c.moveTo(4, 2);
    c.lineTo(14, 2);
    c.lineTo(15, 7);
    c.quadraticCurveTo(26, 7, 27, 12);
    c.lineTo(27, 14);
    c.lineTo(3, 14);
    c.lineTo(3, 8);
    c.closePath();
    fs(
      c,
      lg(c, 0, 2, 0, 14, [
        [0, shade(P.boot, 0.25)],
        [1, shade(P.boot, -0.2)],
      ]),
      2
    );
    c.fillStyle = '#16100c';
    c.fillRect(3, 12, 24, 2.5);
    line(c, 6, 5, 12, 5, 1, shade(P.boot, 0.4));
  });
  Tex.O[k + '_boot'] = [9 / 30, 5 / 18];
  const L = 27,
    T = 23,
    p = 3,
    w = L + T + p * 2,
    h = T + p * 2,
    cy = h / 2,
    j = p + T / 2;
  mkCanvas(scene, k + '_torso', w, h, c => {
    const path = () => {
      c.beginPath();
      rr(c, p, cy - T / 2, L + T, T, T / 2);
    };
    path();
    c.fillStyle = lg(c, 0, p, 0, h - p, [
      [0, shade(P.shirt, -0.2)],
      [0.5, P.shirt],
      [1, shade(P.shirt, 0.1)],
    ]);
    c.fill();
    c.save();
    path();
    c.clip();
    c.fillStyle = P.pants;
    c.fillRect(0, 0, j - 2, h);
    if (P.tank) {
      c.fillStyle = P.skin;
      c.fillRect(j + L - 6, 0, 30, h);
      c.beginPath();
      c.moveTo(j + L - 6, cy - 6);
      c.quadraticCurveTo(j + L - 2, cy, j + L - 6, cy + 9);
      c.lineTo(j + L - 6, cy - 6);
      fs(c, P.shirt, 0);
    } else if (k === 'pl') {
      c.beginPath();
      c.rect(j + 3, 0, L - 5, h);
      fs(
        c,
        lg(c, 0, 0, 0, h, [
          [0, shade(P.vest, -0.3)],
          [0.55, P.vest],
          [1, shade(P.vest, 0.15)],
        ]),
        1.6
      );
      c.beginPath();
      rr(c, j + 6, cy + 3, 7, 8, 2);
      fs(c, shade(P.vest, -0.2), 1.3);
      c.beginPath();
      rr(c, j + 14, cy + 3, 7, 8, 2);
      fs(c, shade(P.vest, -0.2), 1.3);
      line(c, j + 4, p, j + L - 2, h - p, 3, '#5a3a22');
      c.fillStyle = P.skin;
      c.fillRect(j + L + 2, 0, 20, h);
    } else {
      line(c, j + L, 0, j + L, h, 1.3, OUT);
      c.beginPath();
      rr(c, j + 9, cy + 3, 8, 7, 2);
      fs(c, shade(P.shirt, -0.15), 1.2);
      c.beginPath();
      rr(c, j + 9, cy - 10, 10, 8, 2);
      fs(c, shade(P.shirt, -0.12), 1.2);
      c.fillStyle = P.skin;
      c.fillRect(j + L + 3, 0, 20, h);
    }
    c.fillStyle = '#3a2a1a';
    c.fillRect(j - 3, 0, 6, h);
    c.fillStyle = '#d0aa50';
    c.fillRect(j - 2, cy + 5, 4, 5);
    if (P.grenades) {
      [cy - 7, cy + 1].forEach(y => {
        c.beginPath();
        c.arc(j + 1, y, 3, 0, 7);
        fs(c, '#4c6a2c', 1.2);
      });
    }
    c.restore();
    path();
    c.lineWidth = 2.2;
    c.strokeStyle = OUT;
    c.stroke();
  });
  Tex.O[k + '_torso'] = [j / w, 0.5];
  mkCanvas(scene, k + '_head', 38, 40, c => drawHead(c, P));
  Tex.O[k + '_head'] = [15 / 38, 35 / 40];
}

function drawHead(c, P) {
  c.beginPath();
  rr(c, 11, 25, 9, 12, 3);
  fs(c, shade(P.skin, -0.15), 2);
  const head = () => {
    c.beginPath();
    c.moveTo(10, 27);
    c.bezierCurveTo(3.5, 22, 4, 10, 12, 7);
    c.bezierCurveTo(18, 3.5, 26.5, 6, 27.8, 13);
    c.lineTo(28, 16);
    c.quadraticCurveTo(31, 19, 28.6, 20.6);
    c.lineTo(28.2, 23);
    c.quadraticCurveTo(27.6, 28.5, 21, 28.6);
    c.quadraticCurveTo(15.5, 29, 10, 27);
    c.closePath();
  };
  head();
  c.fillStyle = lg(c, 6, 6, 26, 30, [
    [0, shade(P.skin, 0.18)],
    [0.55, P.skin],
    [1, shade(P.skin, -0.22)],
  ]);
  c.fill();
  c.save();
  head();
  c.clip();
  if (P.head === 'mask') {
    c.fillStyle = '#26262a';
    c.fillRect(0, 0, 40, 40);
    c.fillStyle = P.skin;
    c.fillRect(18, 13, 14, 6.5);
  }
  if (P.head === 'player') {
    c.fillStyle = P.hair;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(17, 0);
    c.lineTo(15, 12);
    c.quadraticCurveTo(11, 17, 10, 26);
    c.lineTo(0, 30);
    c.fill();
  }
  if (P.head === 'pow') {
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(15, 9, 6, 2.5, -0.3, 0, 7);
    c.fill();
    c.fillStyle = P.hair;
    c.beginPath();
    c.moveTo(9, 18);
    c.quadraticCurveTo(12, 33, 22, 31);
    c.quadraticCurveTo(30, 29, 29, 21);
    c.quadraticCurveTo(24, 24, 20, 22);
    c.quadraticCurveTo(15, 20, 9, 18);
    c.fill();
  }
  c.restore();
  head();
  c.lineWidth = 2.2;
  c.strokeStyle = OUT;
  c.stroke();
  c.beginPath();
  c.ellipse(13, 19, 2.6, 3.6, 0, 0, 7);
  fs(c, shade(P.skin, -0.12), 1.4);
  c.beginPath();
  c.ellipse(24.6, 16.6, 2.1, 2.5, 0, 0, 7);
  fs(c, '#fff', 0);
  c.beginPath();
  c.ellipse(25.4, 16.8, 1.25, 2, 0, 0, 7);
  fs(c, '#141018', 0);
  line(c, 21.5, 13.1, 27.3, 13.7, 1.9, P.head === 'pow' ? '#5a3418' : '#2a1810');
  if (P.head !== 'pow') line(c, 24.2, 24.6, 27.2, 24.1, 1.2, '#7a3a2a');
  else {
    c.beginPath();
    c.moveTo(22, 23);
    c.quadraticCurveTo(26, 21, 29, 23);
    c.lineWidth = 2.4;
    c.strokeStyle = P.hair;
    c.stroke();
  }
  if (P.head === 'player') {
    c.fillStyle = P.hair;
    [
      [10, 9, 13, 2, 16, 8],
      [15, 7, 19, 0.5, 21, 7],
      [20, 7, 25, 2, 26, 9],
    ].forEach(a => {
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(a[2], a[3]);
      c.lineTo(a[4], a[5]);
      c.closePath();
      fs(c, P.hair, 1.4);
    });
    c.beginPath();
    c.moveTo(5, 13.5);
    c.quadraticCurveTo(16, 7, 28.3, 11);
    c.lineTo(28.4, 15);
    c.quadraticCurveTo(16, 11.5, 5.5, 18);
    c.closePath();
    fs(
      c,
      lg(c, 0, 8, 0, 18, [
        [0, shade(P.band, 0.25)],
        [1, shade(P.band, -0.2)],
      ]),
      1.8
    );
    c.beginPath();
    c.arc(6, 15.5, 3.2, 0, 7);
    fs(c, P.band, 1.6);
  }
  if (P.head === 'helmet') {
    c.beginPath();
    c.moveTo(2, 18);
    c.bezierCurveTo(1, 4, 14, -1, 22, 2);
    c.bezierCurveTo(29, 4, 31, 10, 31, 13.5);
    c.lineTo(33, 14.5);
    c.lineTo(32, 16.5);
    c.lineTo(3, 19.5);
    c.closePath();
    fs(
      c,
      lg(c, 0, 0, 0, 20, [
        [0, shade(P.helmet, 0.3)],
        [0.6, P.helmet],
        [1, shade(P.helmet, -0.3)],
      ]),
      2
    );
    line(c, 8, 8, 16, 4, 1.6, shade(P.helmet, 0.45));
    line(c, 12, 19, 20, 28, 1.4, '#2a2418');
  }
  if (P.head === 'beret') {
    c.beginPath();
    c.ellipse(15, 8.5, 13, 5.5, -0.18, 0, 7);
    fs(
      c,
      lg(c, 0, 3, 0, 14, [
        [0, shade(P.cap, 0.25)],
        [1, shade(P.cap, -0.2)],
      ]),
      2
    );
    c.beginPath();
    c.arc(22, 9, 2, 0, 7);
    fs(c, '#e8c24a', 1);
  }
  if (P.head === 'mask') {
    line(c, 5, 11, 15, 9, 1.4, '#3c3c44');
  }
}

function gunTexs(scene) {
  mkCanvas(scene, 'g_pistol', 32, 20, c => {
    c.beginPath();
    c.moveTo(8, 10);
    c.lineTo(5, 18);
    c.lineTo(11, 18);
    c.lineTo(13, 10);
    c.closePath();
    fs(c, '#3a3a40', 1.8);
    c.beginPath();
    rr(c, 4, 4, 24, 7, 2);
    fs(
      c,
      lg(c, 0, 4, 0, 11, [
        [0, '#9aa0aa'],
        [1, '#4a4e58'],
      ]),
      1.8
    );
    c.beginPath();
    c.arc(14, 12, 3, 0, Math.PI);
    c.lineWidth = 1.5;
    c.strokeStyle = OUT;
    c.stroke();
    line(c, 15, 6, 24, 6, 1, '#d8dde6');
  });
  Tex.O.g_pistol = [9 / 32, 12 / 20];
  Tex.M.g_pistol = { muzzle: [18, -4.5], eject: [6, -7], fore: 2, reach: 17 };

  mkCanvas(scene, 'g_hmg', 70, 28, c => {
    c.beginPath();
    rr(c, 2, 8, 14, 8, 2);
    fs(c, '#5a3a24', 1.8);
    c.beginPath();
    c.moveTo(16, 15);
    c.lineTo(14, 24);
    c.lineTo(20, 24);
    c.lineTo(22, 15);
    fs(c, '#2e2e34', 1.8);
    c.beginPath();
    c.arc(32, 19, 7, 0, 7);
    fs(
      c,
      lg(c, 0, 12, 0, 26, [
        [0, '#7a8030'],
        [1, '#3e4218'],
      ]),
      1.8
    );
    c.beginPath();
    rr(c, 13, 6, 32, 11, 3);
    fs(
      c,
      lg(c, 0, 6, 0, 17, [
        [0, '#8a909a'],
        [1, '#3a3e46'],
      ]),
      2
    );
    c.beginPath();
    rr(c, 43, 7.5, 18, 7, 2);
    fs(c, '#454a52', 1.8);
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(47 + i * 4, 11, 1.2, 0, 7);
      c.fillStyle = '#111';
      c.fill();
    }
    c.beginPath();
    rr(c, 60, 9, 8, 4, 1);
    fs(c, '#2a2a30', 1.4);
    c.beginPath();
    rr(c, 22, 2, 14, 5, 2);
    fs(c, '#3a3e46', 1.6);
    line(c, 16, 9, 42, 9, 1, '#c8ccd6');
  });
  Tex.O.g_hmg = [18 / 70, 16 / 28];
  Tex.M.g_hmg = { muzzle: [50, -5], eject: [14, -9], fore: 15, reach: 9 };

  mkCanvas(scene, 'g_shot', 64, 24, c => {
    c.beginPath();
    c.moveTo(2, 9);
    c.lineTo(16, 8);
    c.lineTo(18, 15);
    c.lineTo(4, 18);
    c.closePath();
    fs(c, '#7a4a28', 1.8);
    c.beginPath();
    c.moveTo(16, 13);
    c.lineTo(14, 21);
    c.lineTo(20, 21);
    c.lineTo(21, 13);
    fs(c, '#6a3e22', 1.6);
    c.beginPath();
    rr(c, 15, 7, 16, 8, 2);
    fs(c, '#3a3e46', 1.8);
    c.beginPath();
    rr(c, 29, 7, 32, 4, 1.5);
    fs(c, '#5a5f68', 1.6);
    c.beginPath();
    rr(c, 34, 11, 14, 5, 2);
    fs(c, '#8a5a30', 1.6);
    line(c, 30, 8, 58, 8, 0.8, '#c8ccd6');
  });
  Tex.O.g_shot = [18 / 64, 14 / 24];
  Tex.M.g_shot = { muzzle: [43, -5], eject: [8, -7], fore: 19, reach: 9 };

  mkCanvas(scene, 'g_rifle', 62, 24, c => {
    c.beginPath();
    c.moveTo(1, 9);
    c.lineTo(17, 9);
    c.lineTo(19, 15);
    c.lineTo(3, 19);
    c.closePath();
    fs(c, '#8a5430', 1.8);
    c.beginPath();
    c.moveTo(18, 14);
    c.lineTo(16, 21);
    c.lineTo(21, 21);
    c.lineTo(23, 14);
    fs(c, '#6a4024', 1.6);
    c.beginPath();
    c.moveTo(27, 14);
    c.quadraticCurveTo(28, 22, 33, 23);
    c.lineTo(36, 21);
    c.quadraticCurveTo(32, 19, 32, 14);
    fs(c, '#2e2e30', 1.6);
    c.beginPath();
    rr(c, 17, 8, 22, 7, 2);
    fs(c, '#4a4c52', 1.8);
    c.beginPath();
    rr(c, 37, 9, 14, 6, 2);
    fs(c, '#8a5430', 1.6);
    c.beginPath();
    rr(c, 50, 10, 11, 3, 1);
    fs(c, '#2e2e30', 1.2);
  });
  Tex.O.g_rifle = [20 / 62, 15 / 24];
  Tex.M.g_rifle = { muzzle: [41, -3.5], eject: [8, -6], fore: 15, reach: 10 };

  mkCanvas(scene, 'g_knife', 26, 10, c => {
    c.beginPath();
    rr(c, 1, 3, 8, 4.5, 1.5);
    fs(c, '#2a2020', 1.4);
    c.beginPath();
    c.moveTo(9, 3);
    c.lineTo(22, 3.5);
    c.lineTo(25, 5);
    c.lineTo(9, 7.5);
    c.closePath();
    fs(
      c,
      lg(c, 0, 3, 0, 8, [
        [0, '#f2f4f8'],
        [1, '#8a909a'],
      ]),
      1.4
    );
  });
  Tex.O.g_knife = [4 / 26, 0.5];
}

function miscTexs(scene) {
  const glowDot = (key, size, inner, outer) =>
    mkCanvas(scene, key, size, size, c => {
      c.fillStyle = rg(c, size / 2, size / 2, 0, size / 2, [
        [0, inner],
        [0.35, inner],
        [1, outer],
      ]);
      c.fillRect(0, 0, size, size);
    });
  glowDot('fx_dot', 32, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  mkCanvas(scene, 'fx_soft', 64, 64, c => {
    c.fillStyle = rg(c, 32, 32, 0, 32, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.5, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.fillRect(0, 0, 64, 64);
  });
  mkCanvas(scene, 'fx_glow', 128, 128, c => {
    c.fillStyle = rg(c, 64, 64, 0, 64, [
      [0, 'rgba(255,255,255,1)'],
      [0.2, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.fillRect(0, 0, 128, 128);
  });
  mkCanvas(scene, 'fx_smoke', 64, 64, c => {
    const R = mulberry(7);
    for (let i = 0; i < 7; i++) {
      const x = 22 + R() * 20,
        y = 22 + R() * 20,
        r = 12 + R() * 10;
      c.fillStyle = rg(c, x, y, 0, r, [
        [0, 'rgba(255,255,255,0.55)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.beginPath();
      c.arc(x, y, r, 0, 7);
      c.fill();
    }
  });
  mkCanvas(scene, 'fx_spark', 24, 6, c => {
    c.fillStyle = lg(c, 0, 0, 24, 0, [
      [0, 'rgba(255,255,255,0)'],
      [0.7, 'rgba(255,255,255,1)'],
      [1, 'rgba(255,255,255,1)'],
    ]);
    c.beginPath();
    rr(c, 0, 1, 24, 4, 2);
    c.fill();
  });
  mkCanvas(scene, 'fx_ring', 128, 128, c => {
    c.beginPath();
    c.arc(64, 64, 58, 0, 7);
    c.lineWidth = 6;
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.stroke();
    c.beginPath();
    c.arc(64, 64, 52, 0, 7);
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.stroke();
  });
  mkCanvas(scene, 'fx_px', 4, 4, c => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 4, 4);
  });
  mkCanvas(scene, 'fx_muzzle', 48, 32, c => {
    c.fillStyle = rg(c, 10, 16, 0, 16, [
      [0, 'rgba(255,255,230,1)'],
      [1, 'rgba(255,200,60,0)'],
    ]);
    c.fillRect(0, 0, 48, 32);
    c.beginPath();
    c.moveTo(2, 16);
    c.lineTo(14, 6);
    c.lineTo(20, 13);
    c.lineTo(46, 16);
    c.lineTo(20, 19);
    c.lineTo(14, 26);
    c.closePath();
    c.fillStyle = 'rgba(255,220,90,0.95)';
    c.fill();
    c.beginPath();
    c.moveTo(4, 16);
    c.lineTo(15, 11);
    c.lineTo(32, 16);
    c.lineTo(15, 21);
    c.closePath();
    c.fillStyle = '#fffbe8';
    c.fill();
  });
  Tex.O.fx_muzzle = [2 / 48, 0.5];
  mkCanvas(scene, 'fx_blast', 96, 64, c => {
    c.beginPath();
    c.moveTo(2, 32);
    c.lineTo(60, 2);
    c.lineTo(94, 20);
    c.lineTo(80, 32);
    c.lineTo(94, 44);
    c.lineTo(60, 62);
    c.closePath();
    c.fillStyle = lg(c, 0, 0, 96, 0, [
      [0, 'rgba(255,255,230,1)'],
      [0.5, 'rgba(255,200,70,0.9)'],
      [1, 'rgba(255,120,30,0)'],
    ]);
    c.fill();
  });
  Tex.O.fx_blast = [2 / 96, 0.5];

  mkCanvas(scene, 'b_pl', 22, 10, c => {
    c.shadowColor = '#ffd84a';
    c.shadowBlur = 5;
    c.beginPath();
    rr(c, 3, 3, 16, 4, 2);
    c.fillStyle = '#fff6c8';
    c.fill();
  });
  mkCanvas(scene, 'b_hmg', 26, 10, c => {
    c.shadowColor = '#ff9a2a';
    c.shadowBlur = 5;
    c.beginPath();
    rr(c, 3, 3, 20, 4, 2);
    c.fillStyle = '#ffe9a8';
    c.fill();
  });
  mkCanvas(scene, 'b_en', 20, 20, c => {
    c.fillStyle = rg(c, 10, 10, 0, 10, [
      [0, '#fff'],
      [0.3, '#ffb040'],
      [0.6, 'rgba(255,90,20,0.6)'],
      [1, 'rgba(255,60,0,0)'],
    ]);
    c.fillRect(0, 0, 20, 20);
  });
  mkCanvas(scene, 'plasma', 36, 36, c => {
    c.fillStyle = rg(c, 18, 18, 0, 18, [
      [0, '#ffffff'],
      [0.25, '#ff9ae0'],
      [0.55, 'rgba(230,40,160,0.7)'],
      [1, 'rgba(160,0,120,0)'],
    ]);
    c.fillRect(0, 0, 36, 36);
  });
  mkCanvas(scene, 'tshell', 20, 10, c => {
    c.beginPath();
    c.moveTo(2, 2);
    c.lineTo(13, 2);
    c.quadraticCurveTo(19, 5, 13, 8);
    c.lineTo(2, 8);
    c.closePath();
    fs(
      c,
      lg(c, 0, 2, 0, 8, [
        [0, '#d0c080'],
        [1, '#6a5a30'],
      ]),
      1.6
    );
  });
  mkCanvas(scene, 'missile', 34, 14, c => {
    c.beginPath();
    c.moveTo(6, 4);
    c.lineTo(24, 4);
    c.quadraticCurveTo(32, 7, 24, 10);
    c.lineTo(6, 10);
    c.closePath();
    fs(
      c,
      lg(c, 0, 4, 0, 10, [
        [0, '#e8e8ea'],
        [1, '#8a8a90'],
      ]),
      1.6
    );
    c.beginPath();
    c.moveTo(24, 4);
    c.quadraticCurveTo(32, 7, 24, 10);
    c.closePath();
    fs(c, '#d8382a', 0);
    c.beginPath();
    c.moveTo(4, 1);
    c.lineTo(10, 4);
    c.lineTo(10, 10);
    c.lineTo(4, 13);
    c.closePath();
    fs(c, '#555a60', 1.4);
  });
  mkCanvas(scene, 'shell', 8, 4, c => {
    c.fillStyle = '#e8c050';
    c.fillRect(0, 0, 8, 4);
    c.fillStyle = '#8a6a20';
    c.fillRect(0, 0, 2, 4);
  });
  mkCanvas(scene, 'grenade', 14, 16, c => {
    c.beginPath();
    c.ellipse(7, 9.5, 5.5, 6, 0, 0, 7);
    fs(
      c,
      lg(c, 0, 4, 0, 16, [
        [0, '#7a9a40'],
        [1, '#2e4214'],
      ]),
      1.8
    );
    line(c, 3, 9, 11, 9, 1, '#24320e');
    line(c, 7, 4, 7, 15, 1, '#24320e');
    c.beginPath();
    rr(c, 5, 1, 4, 3.5, 1);
    fs(c, '#888', 1.2);
  });

  mkCanvas(scene, 'deb_wood', 18, 6, c => {
    c.beginPath();
    rr(c, 1, 1, 16, 4, 1);
    fs(c, '#a06a3a', 1.2);
  });
  mkCanvas(scene, 'deb_metal', 12, 10, c => {
    c.beginPath();
    c.moveTo(1, 2);
    c.lineTo(11, 1);
    c.lineTo(9, 9);
    c.lineTo(2, 8);
    c.closePath();
    fs(c, '#5a5f50', 1.2);
  });
  mkCanvas(scene, 'deb_rock', 10, 9, c => {
    c.beginPath();
    c.moveTo(1, 4);
    c.lineTo(5, 1);
    c.lineTo(9, 3);
    c.lineTo(8, 8);
    c.lineTo(2, 8);
    c.closePath();
    fs(c, '#7a6048', 1.2);
  });
  mkCanvas(scene, 'deb_red', 12, 10, c => {
    c.beginPath();
    c.moveTo(1, 2);
    c.lineTo(11, 1);
    c.lineTo(9, 9);
    c.lineTo(2, 8);
    c.closePath();
    fs(c, '#b0302a', 1.2);
  });

  mkCanvas(scene, 'crate', 44, 44, c => {
    c.beginPath();
    rr(c, 2, 2, 40, 40, 2);
    fs(
      c,
      lg(c, 0, 0, 0, 44, [
        [0, '#c08a50'],
        [1, '#7a5028'],
      ]),
      2.4
    );
    for (let y = 10; y < 40; y += 8) line(c, 5, y, 39, y, 1, 'rgba(60,30,10,0.5)');
    c.beginPath();
    c.moveTo(7, 7);
    c.lineTo(37, 37);
    c.moveTo(37, 7);
    c.lineTo(7, 37);
    c.lineWidth = 5;
    c.strokeStyle = '#6a4220';
    c.stroke();
    c.beginPath();
    rr(c, 5, 5, 34, 34, 1);
    c.lineWidth = 4;
    c.strokeStyle = '#8a5a2c';
    c.stroke();
    [
      [6, 6],
      [38, 6],
      [6, 38],
      [38, 38],
    ].forEach(p => {
      c.beginPath();
      c.arc(p[0], p[1], 1.6, 0, 7);
      c.fillStyle = '#2a2a2a';
      c.fill();
    });
  });
  Tex.O.crate = [0.5, 1];
  mkCanvas(scene, 'barrel', 32, 42, c => {
    c.beginPath();
    rr(c, 3, 2, 26, 38, 5);
    fs(
      c,
      lg(c, 3, 0, 29, 0, [
        [0, '#7a1a14'],
        [0.35, '#e0483a'],
        [0.6, '#c0302a'],
        [1, '#5a1210'],
      ]),
      2.2
    );
    [9, 21, 33].forEach(y => line(c, 4, y, 28, y, 2, '#5a1210'));
    c.beginPath();
    c.moveTo(16, 12);
    c.lineTo(22, 26);
    c.lineTo(10, 26);
    c.closePath();
    fs(c, '#f2d040', 1.4);
    c.fillStyle = '#222';
    c.fillRect(15, 16, 2, 5);
    c.fillRect(15, 22.5, 2, 2);
  });
  Tex.O.barrel = [0.5, 1];
  mkCanvas(scene, 'sandbags', 84, 40, c => {
    const bag = (x, y) => {
      c.beginPath();
      c.ellipse(x, y, 13, 7.5, 0, 0, 7);
      fs(
        c,
        lg(c, 0, y - 8, 0, y + 8, [
          [0, '#d8c08a'],
          [1, '#8a744a'],
        ]),
        2
      );
      line(c, x - 9, y, x + 9, y + 1, 1, 'rgba(90,70,40,0.6)');
    };
    [14, 34, 54, 72].forEach(x => bag(x, 31));
    [24, 44, 62].forEach(x => bag(x, 20));
    bag(40, 10);
  });
  Tex.O.sandbags = [0.5, 1];
  mkCanvas(scene, 'post', 16, 70, c => {
    c.beginPath();
    rr(c, 4, 2, 8, 68, 2);
    fs(
      c,
      lg(c, 4, 0, 12, 0, [
        [0, '#8a5a30'],
        [1, '#4a2a14'],
      ]),
      2
    );
    for (const y of [24, 30]) {
      c.beginPath();
      c.ellipse(8, y, 7, 2.6, 0, 0, 7);
      fs(c, '#c8a868', 1.4);
    }
  });
  Tex.O.post = [0.5, 1];
  mkCanvas(scene, 'chute', 84, 50, c => {
    c.beginPath();
    c.moveTo(2, 30);
    c.bezierCurveTo(4, -6, 80, -6, 82, 30);
    for (let i = 4; i >= 0; i--) c.quadraticCurveTo(2 + (i + 0.5) * 16, 24, 2 + i * 16, 30);
    c.closePath();
    c.save();
    c.clip();
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#e8e2d0' : '#c84a32';
      c.fillRect(2 + i * 14, 0, 14, 40);
    }
    c.restore();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    c.strokeStyle = 'rgba(30,20,30,0.7)';
    c.lineWidth = 1;
    [6, 26, 58, 78].forEach(x => {
      c.beginPath();
      c.moveTo(x, 29);
      c.lineTo(42, 49);
      c.stroke();
    });
  });
  Tex.O.chute = [0.5, 1];
  mkCanvas(scene, 'bubble', 22, 26, c => {
    c.beginPath();
    rr(c, 2, 2, 18, 18, 6);
    c.moveTo(8, 19);
    c.lineTo(11, 25);
    c.lineTo(14, 19);
    fs(c, '#fff', 2);
    c.fillStyle = '#d02020';
    c.fillRect(9.5, 5, 3, 8);
    c.fillRect(9.5, 15, 3, 3);
  });
  Tex.O.bubble = [0.5, 1];
  mkCanvas(scene, 'rope', 26, 8, c => {
    line(c, 2, 4, 24, 4, 3, '#c8a868');
  });

  const box = (key, letter, col) =>
    mkCanvas(scene, key, 32, 32, c => {
      c.beginPath();
      rr(c, 2, 4, 28, 26, 4);
      fs(
        c,
        lg(c, 0, 4, 0, 30, [
          [0, shade(col, 0.25)],
          [1, shade(col, -0.3)],
        ]),
        2.2
      );
      c.font = 'bold 20px Impact, "Arial Black", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 4;
      c.strokeStyle = OUT;
      c.strokeText(letter, 16, 18);
      c.fillStyle = '#ffe680';
      c.fillText(letter, 16, 18);
    });
  box('pk_H', 'H', '#c83a2a');
  box('pk_S', 'S', '#2a6ac8');
  box('pk_B', 'B', '#4a8a2a');
  ['pk_H', 'pk_S', 'pk_B'].forEach(k => (Tex.O[k] = [0.5, 1]));
  mkCanvas(scene, 'pk_medal', 26, 32, c => {
    c.beginPath();
    c.moveTo(7, 2);
    c.lineTo(19, 2);
    c.lineTo(16, 13);
    c.lineTo(10, 13);
    c.closePath();
    fs(c, '#2a5ac8', 1.6);
    c.beginPath();
    c.arc(13, 20, 9, 0, 7);
    fs(
      c,
      rg(c, 10, 17, 1, 10, [
        [0, '#fff6b0'],
        [0.5, '#f2c030'],
        [1, '#a06a10'],
      ]),
      2
    );
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 2.4 : 5.6;
      c.lineTo(13 + Math.cos(a) * r, 20 + Math.sin(a) * r);
    }
    c.closePath();
    fs(c, '#fff3a0', 1);
  });
  Tex.O.pk_medal = [0.5, 1];
  mkCanvas(scene, 'pk_food', 28, 24, c => {
    c.beginPath();
    c.ellipse(12, 13, 10, 8, -0.3, 0, 7);
    fs(
      c,
      lg(c, 0, 4, 0, 22, [
        [0, '#d0703a'],
        [1, '#7a3012'],
      ]),
      2
    );
    line(c, 19, 9, 26, 3, 4, '#f2eadc');
    c.beginPath();
    c.arc(26, 3, 2.2, 0, 7);
    fs(c, '#f2eadc', 1);
  });
  Tex.O.pk_food = [0.5, 1];
}

function vehicleTexs(scene) {
  const OL = '#6a7040',
    OLD = '#3e4224',
    OLL = '#9aa060';
  mkCanvas(scene, 'tank_hull', 210, 64, c => {
    c.beginPath();
    c.moveTo(8, 42);
    c.lineTo(34, 16);
    c.lineTo(176, 16);
    c.lineTo(202, 30);
    c.lineTo(202, 46);
    c.lineTo(8, 46);
    c.closePath();
    fs(
      c,
      lg(c, 0, 16, 0, 46, [
        [0, OLL],
        [0.4, OL],
        [1, OLD],
      ]),
      2.6
    );
    line(c, 36, 22, 174, 22, 1.4, 'rgba(255,255,220,0.35)');
    c.beginPath();
    rr(c, 14, 36, 186, 16, 3);
    fs(
      c,
      lg(c, 0, 36, 0, 52, [
        [0, '#5a6034'],
        [1, '#2e3218'],
      ]),
      2.2
    );
    for (let x = 22; x < 196; x += 16) {
      c.beginPath();
      c.arc(x, 44, 1.8, 0, 7);
      c.fillStyle = '#1e2010';
      c.fill();
    }
    c.font = 'bold 13px Impact, sans-serif';
    c.fillStyle = '#e8e0b8';
    c.fillText('R-07', 120, 33);
    c.beginPath();
    rr(c, 150, 20, 22, 8, 2);
    fs(c, '#4a4e2c', 1.4);
  });
  Tex.O.tank_hull = [0.5, 1];
  mkCanvas(scene, 'tank_track', 206, 40, c => {
    c.beginPath();
    rr(c, 3, 3, 200, 34, 17);
    fs(c, '#26261e', 2.4);
    c.beginPath();
    rr(c, 9, 9, 188, 22, 11);
    fs(c, '#3a3a30', 0);
  });
  Tex.O.tank_track = [0.5, 0.5];
  mkCanvas(scene, 'tank_wheel', 28, 28, c => {
    c.beginPath();
    c.arc(14, 14, 12, 0, 7);
    fs(
      c,
      rg(c, 11, 11, 1, 13, [
        [0, '#8a8a7a'],
        [1, '#3a3a30'],
      ]),
      2
    );
    c.beginPath();
    c.arc(14, 14, 5, 0, 7);
    fs(c, '#5a5a4a', 1.4);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.2566;
      c.beginPath();
      c.arc(14 + Math.cos(a) * 8.5, 14 + Math.sin(a) * 8.5, 1.4, 0, 7);
      c.fillStyle = '#222';
      c.fill();
    }
  });
  mkCanvas(scene, 'tank_link', 12, 7, c => {
    c.beginPath();
    rr(c, 1, 1, 10, 5, 1);
    fs(c, '#55554a', 1.2);
  });
  mkCanvas(scene, 'tank_turret', 110, 50, c => {
    c.beginPath();
    c.moveTo(10, 44);
    c.lineTo(22, 12);
    c.quadraticCurveTo(60, 2, 94, 14);
    c.lineTo(104, 44);
    c.closePath();
    fs(
      c,
      lg(c, 0, 4, 0, 44, [
        [0, OLL],
        [0.5, OL],
        [1, OLD],
      ]),
      2.6
    );
    c.beginPath();
    rr(c, 56, 4, 22, 7, 3);
    fs(c, '#4e5430', 1.8);
    c.beginPath();
    c.arc(84, 28, 6, 0, 7);
    fs(c, '#30341c', 1.6);
    line(c, 26, 16, 86, 14, 1.4, 'rgba(255,255,220,0.35)');
    c.beginPath();
    c.moveTo(30, 26);
    c.lineTo(56, 26);
    c.lineTo(56, 34);
    c.lineTo(30, 34);
    fs(c, '#d8d0a8', 1.4);
  });
  Tex.O.tank_turret = [60 / 110, 44 / 50];
  mkCanvas(scene, 'tank_barrel', 92, 16, c => {
    c.beginPath();
    rr(c, 2, 4, 76, 8, 3);
    fs(
      c,
      lg(c, 0, 4, 0, 12, [
        [0, '#8a9060'],
        [1, '#3e4224'],
      ]),
      2
    );
    c.beginPath();
    rr(c, 74, 2, 16, 12, 3);
    fs(c, '#4a4e30', 2);
  });
  Tex.O.tank_barrel = [4 / 92, 0.5];

  mkCanvas(scene, 'heli_body', 200, 80, c => {
    c.beginPath();
    c.moveTo(14, 44);
    c.quadraticCurveTo(12, 18, 46, 16);
    c.lineTo(110, 18);
    c.quadraticCurveTo(128, 22, 132, 34);
    c.lineTo(190, 30);
    c.lineTo(194, 22);
    c.lineTo(198, 22);
    c.lineTo(196, 42);
    c.lineTo(130, 46);
    c.quadraticCurveTo(110, 60, 60, 60);
    c.quadraticCurveTo(20, 58, 14, 44);
    c.closePath();
    fs(
      c,
      lg(c, 0, 16, 0, 60, [
        [0, '#7a8656'],
        [0.5, '#5a6440'],
        [1, '#2e3420'],
      ]),
      2.6
    );
    c.beginPath();
    c.moveTo(18, 40);
    c.quadraticCurveTo(18, 22, 46, 21);
    c.lineTo(56, 21);
    c.lineTo(56, 40);
    c.closePath();
    fs(
      c,
      lg(c, 18, 20, 56, 40, [
        [0, '#cfe8ff'],
        [0.4, '#6aa0c8'],
        [1, '#1a3048'],
      ]),
      2
    );
    line(c, 26, 26, 38, 23, 2, 'rgba(255,255,255,0.7)');
    c.beginPath();
    rr(c, 70, 24, 22, 14, 2);
    fs(c, '#3a4228', 1.6);
    c.beginPath();
    rr(c, 76, 8, 28, 10, 3);
    fs(c, '#4a5232', 2);
    line(c, 40, 68, 120, 68, 3.5, '#2a2a26');
    line(c, 56, 60, 52, 68, 3, '#2a2a26');
    line(c, 104, 58, 108, 68, 3, '#2a2a26');
    c.beginPath();
    rr(c, 2, 46, 26, 7, 2);
    fs(c, '#333', 1.6);
    c.font = 'bold 12px Impact, sans-serif';
    c.fillStyle = '#e8e0b8';
    c.fillText('H-3', 140, 40);
  });
  Tex.O.heli_body = [0.45, 0.5];
  mkCanvas(scene, 'heli_rotor', 240, 10, c => {
    c.fillStyle = lg(c, 0, 0, 240, 0, [
      [0, 'rgba(30,30,30,0)'],
      [0.15, 'rgba(30,30,30,0.55)'],
      [0.5, 'rgba(20,20,20,0.85)'],
      [0.85, 'rgba(30,30,30,0.55)'],
      [1, 'rgba(30,30,30,0)'],
    ]);
    c.beginPath();
    rr(c, 0, 2, 240, 6, 3);
    c.fill();
  });
  mkCanvas(scene, 'heli_trotor', 32, 32, c => {
    c.fillStyle = rg(c, 16, 16, 0, 16, [
      [0, 'rgba(40,40,40,0.8)'],
      [0.8, 'rgba(40,40,40,0.4)'],
      [1, 'rgba(40,40,40,0)'],
    ]);
    c.beginPath();
    c.arc(16, 16, 15, 0, 7);
    c.fill();
  });

  const BM = '#5c5a6a',
    BMD = '#2e2c38',
    BML = '#9a98a8';
  mkCanvas(scene, 'boss_body', 300, 140, c => {
    c.beginPath();
    c.moveTo(20, 80);
    c.lineTo(46, 40);
    c.lineTo(130, 26);
    c.lineTo(250, 34);
    c.lineTo(290, 64);
    c.lineTo(280, 104);
    c.lineTo(200, 126);
    c.lineTo(70, 124);
    c.lineTo(28, 104);
    c.closePath();
    fs(
      c,
      lg(c, 0, 26, 0, 126, [
        [0, BML],
        [0.45, BM],
        [1, BMD],
      ]),
      3
    );
    c.beginPath();
    c.moveTo(120, 70);
    c.lineTo(180, 66);
    c.lineTo(200, 96);
    c.lineTo(110, 100);
    c.closePath();
    fs(c, '#1a1820', 2);
    for (let x = 60; x < 270; x += 22) {
      c.beginPath();
      c.arc(x, 112, 2.2, 0, 7);
      c.fillStyle = '#18161e';
      c.fill();
    }
    line(c, 50, 44, 128, 31, 2, 'rgba(255,255,255,0.35)');
    c.beginPath();
    rr(c, 222, 46, 50, 12, 3);
    fs(c, '#3a3846', 1.8);
    for (let i = 0; i < 4; i++) line(c, 228 + i * 11, 48, 228 + i * 11, 56, 2, '#e0a020');
  });
  Tex.O.boss_body = [0.5, 0.5];
  mkCanvas(scene, 'boss_armor', 210, 70, c => {
    c.beginPath();
    c.moveTo(4, 60);
    c.lineTo(30, 18);
    c.lineTo(110, 4);
    c.lineTo(200, 14);
    c.lineTo(206, 44);
    c.lineTo(160, 52);
    c.lineTo(120, 50);
    c.lineTo(60, 62);
    c.closePath();
    fs(
      c,
      lg(c, 0, 4, 0, 62, [
        [0, '#c8a040'],
        [0.5, '#8a6a20'],
        [1, '#4a3a10'],
      ]),
      3
    );
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(40 + i * 26, 24 - i * 1.5);
      c.lineTo(56 + i * 26, 40 - i * 1.5);
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(30,20,10,0.55)';
      c.stroke();
    }
    line(c, 36, 20, 108, 8, 2, 'rgba(255,240,180,0.6)');
  });
  Tex.O.boss_armor = [0.5, 0.5];
  mkCanvas(scene, 'boss_core', 60, 60, c => {
    c.fillStyle = rg(c, 30, 30, 0, 30, [
      [0, '#ffffff'],
      [0.25, '#ffd0a0'],
      [0.5, '#ff5a20'],
      [1, 'rgba(200,20,0,0)'],
    ]);
    c.fillRect(0, 0, 60, 60);
  });
  mkCanvas(scene, 'boss_eye', 50, 26, c => {
    c.beginPath();
    c.moveTo(2, 13);
    c.lineTo(16, 3);
    c.lineTo(48, 5);
    c.lineTo(48, 21);
    c.lineTo(16, 23);
    c.closePath();
    fs(c, '#2a2834', 2.4);
    c.beginPath();
    c.moveTo(8, 13);
    c.lineTo(18, 8);
    c.lineTo(40, 9);
    c.lineTo(40, 17);
    c.lineTo(18, 18);
    c.closePath();
    fs(
      c,
      lg(c, 0, 8, 0, 18, [
        [0, '#ffe0e0'],
        [0.5, '#ff3030'],
        [1, '#801010'],
      ]),
      0
    );
  });
  Tex.O.boss_eye = [0.5, 0.5];
  mkCanvas(scene, 'boss_cannon', 100, 30, c => {
    c.beginPath();
    c.arc(16, 15, 13, 0, 7);
    fs(
      c,
      rg(c, 12, 11, 2, 14, [
        [0, BML],
        [1, BMD],
      ]),
      2.4
    );
    c.beginPath();
    rr(c, 22, 8, 64, 14, 4);
    fs(
      c,
      lg(c, 0, 8, 0, 22, [
        [0, BML],
        [1, BMD],
      ]),
      2.4
    );
    c.beginPath();
    rr(c, 80, 5, 18, 20, 4);
    fs(c, '#3a3846', 2.4);
    for (let i = 0; i < 3; i++) line(c, 36 + i * 14, 10, 36 + i * 14, 20, 2, '#2a2834');
  });
  Tex.O.boss_cannon = [16 / 100, 0.5];
  mkCanvas(scene, 'boss_pod', 70, 40, c => {
    c.beginPath();
    rr(c, 4, 6, 62, 30, 6);
    fs(
      c,
      lg(c, 0, 6, 0, 36, [
        [0, BML],
        [1, BMD],
      ]),
      2.4
    );
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(18 + i * 17, 14, 5, 0, 7);
      fs(c, '#141218', 1.6);
      c.beginPath();
      c.arc(18 + i * 17, 14, 2.2, 0, 7);
      c.fillStyle = '#d8382a';
      c.fill();
    }
  });
  Tex.O.boss_pod = [0.5, 1];
  limbTex(
    scene,
    'boss_leg1',
    88,
    24,
    BM,
    (c, j, cy, len, t) => {
      c.beginPath();
      rr(c, j + 14, cy - 5, len - 28, 10, 4);
      fs(c, BMD, 1.6);
      line(c, j + 16, cy - t / 2 + 3, j + len - 16, cy - t / 2 + 3, 2, BML);
    },
    { lw: 2.8 }
  );
  limbTex(
    scene,
    'boss_leg2',
    96,
    18,
    BM,
    (c, j, cy, len) => {
      c.beginPath();
      rr(c, j + 10, cy - 3, len - 30, 6, 3);
      fs(c, '#c8c8d0', 1.4);
      c.fillStyle = '#e0a020';
      for (let x = j + len - 20; x < j + len; x += 8) c.fillRect(x, 0, 4, 40);
    },
    { lw: 2.8 }
  );
  mkCanvas(scene, 'boss_joint', 34, 34, c => {
    c.beginPath();
    c.arc(17, 17, 13, 0, 7);
    fs(
      c,
      rg(c, 13, 13, 2, 15, [
        [0, BML],
        [1, BMD],
      ]),
      2.6
    );
    c.beginPath();
    c.arc(17, 17, 5, 0, 7);
    fs(c, '#e0a020', 1.6);
  });
  mkCanvas(scene, 'boss_foot', 52, 24, c => {
    c.beginPath();
    c.moveTo(4, 22);
    c.lineTo(14, 4);
    c.lineTo(38, 4);
    c.lineTo(48, 22);
    c.closePath();
    fs(
      c,
      lg(c, 0, 4, 0, 22, [
        [0, BML],
        [1, BMD],
      ]),
      2.6
    );
  });
  Tex.O.boss_foot = [0.5, 4 / 24];
  mkCanvas(scene, 'beam', 64, 32, c => {
    c.fillStyle = lg(c, 0, 0, 0, 32, [
      [0, 'rgba(255,40,80,0)'],
      [0.3, 'rgba(255,60,120,0.8)'],
      [0.5, '#ffffff'],
      [0.7, 'rgba(255,60,120,0.8)'],
      [1, 'rgba(255,40,80,0)'],
    ]);
    c.fillRect(0, 0, 64, 32);
  });
  Tex.O.beam = [0, 0.5];
  mkCanvas(scene, 'shockwave', 60, 40, c => {
    c.beginPath();
    c.moveTo(0, 40);
    c.quadraticCurveTo(30, -10, 60, 40);
    c.closePath();
    c.fillStyle = lg(c, 0, 0, 0, 40, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.4, 'rgba(255,200,120,0.8)'],
      [1, 'rgba(255,120,40,0)'],
    ]);
    c.fill();
  });
  Tex.O.shockwave = [0.5, 1];
}

function sceneryTexs(scene) {
  mkCanvas(scene, 'sky', 960, 540, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [
      [0, '#1d1438'],
      [0.3, '#4a2458'],
      [0.55, '#a8455e'],
      [0.72, '#ef8a5a'],
      [0.85, '#f8c27a'],
      [1, '#f8d898'],
    ]);
    c.fillRect(0, 0, w, h);
    c.fillStyle = rg(c, 640, 330, 0, 260, [
      [0, 'rgba(255,240,200,0.9)'],
      [0.12, 'rgba(255,220,150,0.6)'],
      [1, 'rgba(255,160,90,0)'],
    ]);
    c.fillRect(0, 0, w, h);
    c.beginPath();
    c.arc(640, 335, 58, 0, 7);
    c.fillStyle = lg(c, 0, 280, 0, 390, [
      [0, '#fff6d8'],
      [1, '#ffb060'],
    ]);
    c.fill();
    c.fillStyle = 'rgba(200,90,90,0.35)';
    [300, 318, 334].forEach((y, i) => c.fillRect(560, y, 160, 3 - i * 0.6));
    const R = mulberry(3);
    c.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      c.globalAlpha = R() * 0.7;
      c.fillRect(R() * w, R() * 180, 1.5, 1.5);
    }
    c.globalAlpha = 1;
  });
  mkCanvas(scene, 'clouds', 1024, 260, (c, w) => {
    const R = mulberry(11);
    for (let i = 0; i < 9; i++) {
      const x = R() * w,
        y = 40 + R() * 160,
        s = 0.6 + R() * 1.2;
      for (const ox of [-w, 0, w]) {
        for (let k = 0; k < 6; k++) {
          const cx = x + ox + (k - 3) * 22 * s,
            cy = y + Math.sin(k * 1.7) * 5 * s,
            r = (16 + R() * 14) * s;
          c.fillStyle = rg(c, cx, cy - r * 0.3, 0, r, [
            [0, 'rgba(255,190,170,0.5)'],
            [0.6, 'rgba(210,110,140,0.25)'],
            [1, 'rgba(140,60,110,0)'],
          ]);
          c.beginPath();
          c.ellipse(cx, cy, r * 1.6, r * 0.55, 0, 0, 7);
          c.fill();
        }
      }
    }
  });
  const ridge = (key, w, h, base, amps, col, colTop, seed, extra) =>
    mkCanvas(scene, key, w, h, c => {
      const R = mulberry(seed),
        ph = amps.map(() => R() * 6.28);
      const y = x => base + amps.reduce((s, a, i) => s + a[1] * Math.sin((x / w) * 6.2832 * a[0] + ph[i]), 0);
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) c.lineTo(x, y(x));
      c.lineTo(w, h);
      c.closePath();
      c.fillStyle = lg(c, 0, base - 60, 0, h, [
        [0, colTop],
        [1, col],
      ]);
      c.fill();
      if (extra) extra(c, y, R);
    });
  ridge(
    'bg_mount',
    1024,
    300,
    150,
    [
      [2, 30],
      [3, 22],
      [7, 9],
      [13, 4],
    ],
    '#6a3a64',
    '#8a4a6a',
    5,
    (c, y) => {
      c.fillStyle = 'rgba(255,200,170,0.18)';
      for (let x = 0; x < 1024; x += 4) {
        const yy = y(x),
          d = y(x + 4) - yy;
        if (d < 0) c.fillRect(x, yy, 4, 10);
      }
    }
  );
  ridge(
    'bg_hills',
    1024,
    260,
    120,
    [
      [3, 18],
      [5, 10],
      [11, 5],
    ],
    '#3a2448',
    '#4e2c56',
    9,
    (c, y, R) => {
      for (let i = 0; i < 26; i++) {
        const x = R() * 1024,
          by = y(x) + 4,
          hgt = 50 + R() * 50;
        for (const ox of [-1024, 0, 1024]) silhouettePalm(c, x + ox, by, hgt, '#3a2448', R);
      }
    }
  );
  ridge(
    'bg_near',
    1024,
    240,
    110,
    [
      [2, 14],
      [6, 8],
    ],
    '#2a1a34',
    '#2e1d3a',
    13,
    (c, y, R) => {
      for (let i = 0; i < 7; i++) {
        const x = 40 + i * 150 + R() * 60,
          bw = 50 + R() * 70,
          bh = 50 + R() * 80,
          by = y(x) + 10;
        c.fillStyle = '#2a1a34';
        c.beginPath();
        c.moveTo(x, by);
        c.lineTo(x, by - bh);
        for (let k = 0; k <= 5; k++) c.lineTo(x + (bw * k) / 5, by - bh + (k % 2 ? R() * 18 : -R() * 6));
        c.lineTo(x + bw, by);
        c.fill();
        c.fillStyle = 'rgba(255,170,90,0.25)';
        for (let wy = by - bh + 18; wy < by - 12; wy += 18)
          for (let wx = x + 8; wx < x + bw - 10; wx += 16) if (R() > 0.55) c.fillRect(wx, wy, 6, 8);
      }
      for (let i = 0; i < 14; i++) {
        const x = R() * 1024;
        silhouettePalm(c, x, y(x) + 6, 70 + R() * 40, '#2a1a34', R);
      }
    }
  );
  mkCanvas(scene, 'palm', 170, 280, c => drawPalm(c, 85, 278, 230, mulberry(21)));
  Tex.O.palm = [0.5, 1];
  mkCanvas(scene, 'palm2', 170, 240, c => drawPalm(c, 85, 238, 190, mulberry(33)));
  Tex.O.palm2 = [0.5, 1];
  mkCanvas(scene, 'bush', 120, 60, c => {
    const R = mulberry(4);
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.ellipse(15 + i * 11 + R() * 4, 40 - R() * 18, 14, 18, R() - 0.5, 0, 7);
      fs(
        c,
        lg(c, 0, 10, 0, 60, [
          [0, '#5e7a34'],
          [1, '#22301a'],
        ]),
        1.6
      );
    }
  });
  Tex.O.bush = [0.5, 1];
  mkCanvas(scene, 'fg_leaves', 260, 160, c => {
    const R = mulberry(8);
    for (let i = 0; i < 14; i++) {
      const bx = 20 + R() * 220,
        a = -Math.PI / 2 + (R() - 0.5) * 2.2,
        L = 60 + R() * 80;
      leaf(c, bx, 160, a, L, '#120c18');
    }
  });
  Tex.O.fg_leaves = [0.5, 1];
  mkCanvas(scene, 'vignette', 960, 540, (c, w, h) => {
    c.fillStyle = rg(c, w / 2, h / 2, h * 0.45, w * 0.62, [
      [0, 'rgba(10,0,20,0)'],
      [1, 'rgba(10,0,20,0.55)'],
    ]);
    c.fillRect(0, 0, w, h);
  });
  mkCanvas(scene, 'arrow', 90, 50, c => {
    c.beginPath();
    c.moveTo(4, 14);
    c.lineTo(50, 14);
    c.lineTo(50, 4);
    c.lineTo(86, 25);
    c.lineTo(50, 46);
    c.lineTo(50, 36);
    c.lineTo(4, 36);
    c.closePath();
    fs(
      c,
      lg(c, 0, 4, 0, 46, [
        [0, '#fff27a'],
        [1, '#f08a1a'],
      ]),
      3.5
    );
  });
}
function leaf(c, x, y, a, L, col) {
  const ex = x + Math.cos(a) * L,
    ey = y + Math.sin(a) * L,
    nx = -Math.sin(a),
    ny = Math.cos(a);
  const mx = (x + ex) / 2,
    my = (y + ey) / 2 + L * 0.15;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(mx + nx * L * 0.18, my + ny * L * 0.18, ex, ey + L * 0.1);
  c.quadraticCurveTo(mx - nx * L * 0.18, my - ny * L * 0.18, x, y);
  c.fillStyle = col;
  c.fill();
}
function silhouettePalm(c, x, y, h, col, R) {
  const lean = (R() - 0.5) * 0.5;
  c.strokeStyle = col;
  c.lineWidth = 3.5;
  c.beginPath();
  c.moveTo(x, y);
  const tx = x + lean * h,
    ty = y - h;
  c.quadraticCurveTo(x + lean * h * 0.2, y - h * 0.6, tx, ty);
  c.stroke();
  c.fillStyle = col;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i * Math.PI) / 6 + (R() - 0.5) * 0.3,
      L = h * (0.35 + R() * 0.15);
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(
      tx + Math.cos(a) * L * 0.6,
      ty + Math.sin(a) * L * 0.6 - L * 0.25,
      tx + Math.cos(a) * L,
      ty + Math.sin(a) * L * 0.4 + L * 0.25
    );
    c.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.5 - L * 0.1, tx, ty);
    c.fill();
  }
}
function drawPalm(c, x, y, h, R) {
  const lean = 0.18,
    tx = x + lean * h,
    ty = y - h;
  for (let i = 0; i < 16; i++) {
    const t0 = i / 16,
      t1 = (i + 1) / 16;
    const p = t => [x + lean * h * t * t, y - h * t];
    const [x0, y0] = p(t0),
      [x1, y1] = p(t1),
      w = 10 - 4 * t0;
    c.beginPath();
    c.moveTo(x0 - w, y0);
    c.lineTo(x1 - w + 1, y1);
    c.lineTo(x1 + w - 1, y1);
    c.lineTo(x0 + w, y0);
    c.closePath();
    fs(
      c,
      lg(c, x0 - w, 0, x0 + w, 0, [
        [0, '#4a3020'],
        [0.5, '#7a5434'],
        [1, '#e0905a'],
      ]),
      1.8
    );
  }
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i * Math.PI) / 8 + (R() - 0.5) * 0.25,
      L = 60 + R() * 30;
    const ex = tx + Math.cos(a) * L,
      ey = ty + Math.sin(a) * L * 0.5 + L * 0.35;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty - 30 + Math.sin(a) * 10, ex, ey);
    c.quadraticCurveTo(tx + Math.cos(a) * L * 0.45, ty - 14 + Math.sin(a) * 10, tx, ty + 4);
    fs(
      c,
      lg(c, tx, ty - 30, ex, ey, [
        [0, '#4a6a2a'],
        [0.6, '#2e4a1e'],
        [1, '#e08a4a'],
      ]),
      1.8
    );
  }
  c.beginPath();
  c.arc(tx - 4, ty + 6, 5, 0, 7);
  fs(c, '#5a3a1a', 1.4);
  c.beginPath();
  c.arc(tx + 5, ty + 7, 5, 0, 7);
  fs(c, '#5a3a1a', 1.4);
}

function genAllTextures(scene) {
  for (const k in PALS) humanSet(scene, k, PALS[k]);
  limbTex(scene, 'pl_tail', 9, 5, PALS.pl.band);
  gunTexs(scene);
  miscTexs(scene);
  vehicleTexs(scene);
  sceneryTexs(scene);
}

function img(scene, x, y, key) {
  const im = scene.add.image(x, y, key);
  const o = Tex.O[key];
  if (o) im.setOrigin(o[0], o[1]);
  return im;
}
