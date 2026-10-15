// Canvas particle renderers behind the orb. Each mode turns (size, time, options)
// into a depth-sorted set of dots (and, for "web", lines) that the caller paints.

export type Opts = Record<string, number | undefined>;
export type Dot = { x: number; y: number; z: number; r: number; white: number; a?: number };
export type Line = { x1: number; y1: number; x2: number; y2: number; white: number; a?: number; w: number };
export type Frame = { dots: Dot[]; lines: Line[] };
type Mode = (size: number, t: number, o: Opts) => Frame;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (x: number) => x - Math.floor(x);

function hash2(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function noise2(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Evenly spread point i of n on a unit sphere (Fibonacci lattice). */
function fibonacci(i: number, n: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const th = i * golden;
  return [r * Math.cos(th), y, r * Math.sin(th)];
}

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Rotate by yaw/pitch and project to canvas coordinates around (cx, cy). */
function projector(yaw: number, pitch: number, cx: number, cy: number, scale: number) {
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const sy = Math.sin(yaw);
  const cyw = Math.cos(yaw);
  return (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * cyw + z * sy;
    const z1 = -x * sy + z * cyw;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [cx + x1 * scale, cy - y2 * scale, z2];
  };
}

function paintDots(ctx: CanvasRenderingContext2D, dots: Dot[], dark: boolean) {
  for (const d of dots) {
    const alpha = d.a ?? 1;
    const w = Math.min(1, Math.max(0, d.white));
    const v = Math.round((dark ? 1 - w : w) * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintLines(ctx: CanvasRenderingContext2D, lines: Line[], dark: boolean) {
  for (const l of lines) {
    const alpha = l.a ?? 1;
    const w = Math.min(1, Math.max(0, l.white));
    const v = Math.round((dark ? 1 - w : w) * 255);
    ctx.strokeStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
}

function finish(dots: Dot[], lines: Line[], rMin = 0.3): Frame {
  const kept: Dot[] = [];
  for (const d of dots) {
    if ((d.a ?? 1) < 0.02) continue;
    d.r = Math.max(rMin, d.r);
    kept.push(d);
  }
  kept.sort((a, b) => a.z - b.z);
  return { dots: kept, lines: lines.filter((l) => (l.a ?? 1) >= 0.02) };
}

function paint(ctx: CanvasRenderingContext2D, frame: Frame, dark: boolean) {
  if (frame.lines.length) paintLines(ctx, frame.lines, dark);
  paintDots(ctx, frame.dots, dark);
}

const sizeScale = (size: number, pow: number) => (size / 300) ** pow;

const braid: Mode = (size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.76;
  const proj = projector(t * 0.4, 0.3, cx, cy, 1);
  const rs = sizeScale(size, o.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const ghosts = o.ghostN ?? 150;
  for (let i = 0; i < ghosts; i++) {
    const p = fibonacci(i, ghosts);
    const [x, y, z] = proj(p[0] * R, p[1] * R, p[2] * R);
    const depth = (z / R + 1) / 2;
    dots.push({ x, y, z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
  }
  const strandN = o.strandN ?? 52;
  const turns = o.turns ?? 3;
  for (let s = 0; s < 3; s++) {
    const phase = (s / 3) * 2 * Math.PI;
    for (let i = 0; i < strandN; i++) {
      const v = (fract(i / strandN + t * 0.045) * 2 - 1) * 0.96;
      const ring = Math.sqrt(Math.max(0, 1 - v * v));
      const fade = Math.min(1, (1 - Math.abs(v)) / 0.1);
      const ang = v * Math.PI * turns + phase;
      const wob = 1 + 0.075 * Math.sin(v * Math.PI * turns * 2 + phase * 2 + t * 0.8);
      const rr = ring * R * wob;
      const [x, y, z] = proj(Math.cos(ang) * rr, v * R * wob, Math.sin(ang) * rr);
      const depth = (z / R + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 1.2) + (o.rDepth ?? 1.8) * depth) * rs,
        white: 0.55 - 0.45 * depth,
        a: fade * (0.45 + 0.55 * depth),
      });
    }
  }
  return finish(dots, [], o.rMin);
};

function rubikMoves(t: number, count: number, dur: number, rest: number) {
  const cyc = t % (2 * count * dur + rest);
  const amount = Array(count).fill(0) as number[];
  let active = -1;
  if (cyc < 2 * count * dur) {
    const step = Math.floor(cyc / dur);
    const k = (cyc - step * dur) / dur;
    const eased = 1 - (1 - Math.min(1, k / 0.7)) ** 3;
    if (step < count) {
      for (let i = 0; i < step; i++) amount[i] = 1;
      amount[step] = eased;
      active = step;
    } else {
      const back = 2 * count - 1 - step;
      for (let i = 0; i < back; i++) amount[i] = 1;
      amount[back] = 1 - eased;
      active = back;
    }
  }
  return { amount, active };
}

type Move = { axis: number; lo: number; hi: number; ang: number };

function applyMoves(p: [number, number, number], moves: Move[], state: { amount: number[]; active: number }) {
  let [x, y, z] = p;
  let hit = false;
  for (let i = 0; i < moves.length; i++) {
    if (state.amount[i] <= 0) continue;
    const m = moves[i];
    const c = m.axis === 0 ? x : m.axis === 1 ? y : z;
    if (c < m.lo || c >= m.hi) continue;
    if (i === state.active) hit = true;
    const a = m.ang * state.amount[i];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    if (m.axis === 0) {
      const ny = y * ca - z * sa;
      z = y * sa + z * ca;
      y = ny;
    } else if (m.axis === 1) {
      const nx = x * ca + z * sa;
      z = -x * sa + z * ca;
      x = nx;
    } else {
      const nx = x * ca - y * sa;
      y = x * sa + y * ca;
      x = nx;
    }
  }
  return [x, y, z, hit] as const;
}

function makeMoves(n: number): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < n; i++) {
    const axis = Math.min(2, Math.floor(hash2(i, 2.3) * 3));
    const lo = -1 + 0.5 * Math.min(3, Math.floor(hash2(i, 5.9) * 4));
    const dir = hash2(i, 7.7) < 0.5 ? 1 : -1;
    out.push({ axis, lo, hi: lo + 0.5, ang: (dir * Math.PI) / 2 });
  }
  return out;
}

const globe: Mode = (size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.82;
  const tilt = 0.4 + 0.06 * Math.sin(t * 0.35);
  const proj = projector(t * 0.5, tilt, cx, cy, R);
  const scan = t * (0.5 + 1.2 * (o.scanMul ?? 1));
  const rs = sizeScale(size, o.rsPow ?? 0.6);
  const dim = o.dimBase ?? 1;
  const dots: Dot[] = [];
  const lat = o.latRings ?? 17;
  const lon = o.lonDensity ?? 44;
  for (let i = 0; i <= lat; i++) {
    const phi = -Math.PI / 2 + (i / lat) * Math.PI;
    const cphi = Math.cos(phi);
    const sphi = Math.sin(phi);
    const n = Math.max(1, Math.round(Math.abs(cphi) * lon));
    for (let j = 0; j < n; j++) {
      const th = (j / n) * 2 * Math.PI;
      const [x, y, z] = proj(cphi * Math.cos(th), sphi, cphi * Math.sin(th));
      const depth = (z + 1) / 2;
      const d = angleDiff(th + t * 0.5, scan);
      const glow = Math.exp(-(d * d) / 0.18) * Math.max(0, z);
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth + (o.rBoost ?? 1) * glow) * rs,
        white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth,
        a: dim + (1 - dim) * Math.min(1, glow),
      });
    }
  }
  return finish(dots, [], o.rMin);
};

const rubik: Mode = (size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.82;
  const proj = projector(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), cx, cy, R);
  const rs = sizeScale(size, o.rsPow ?? 0.6);
  const count = o.moveCount ?? 14;
  const moves = makeMoves(count);
  const state = rubikMoves(t, count, 0.42, 1.2);
  const dots: Dot[] = [];
  const lat = o.latRings ?? 15;
  const lon = o.lonDensity ?? 40;
  for (let i = 0; i <= lat; i++) {
    const phi = -Math.PI / 2 + (i / lat) * Math.PI;
    const cphi = Math.cos(phi);
    const sphi = Math.sin(phi);
    const n = Math.max(1, Math.round(Math.abs(cphi) * lon));
    for (let j = 0; j < n; j++) {
      const th = (j / n) * 2 * Math.PI;
      const [px, py, pz, hit] = applyMoves([cphi * Math.cos(th), sphi, cphi * Math.sin(th)], moves, state);
      const [x, y, z] = proj(px, py, pz);
      const depth = (z + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth + (hit ? (o.rActive ?? 0.3) : 0)) * rs,
        white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth - (hit ? 0.14 : 0),
      });
    }
  }
  return finish(dots, [], o.rMin);
};

const wave: Mode = (size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.874;
  const proj = projector(t * 0.18, 0.38, cx, cy, 1);
  const rs = sizeScale(size, o.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const rings = o.rings ?? 15;
  const lon = o.lonDensity ?? 40;
  for (let i = 0; i <= rings; i++) {
    const phi = -Math.PI / 2 + (i / rings) * Math.PI;
    const cphi = Math.cos(phi);
    const sphi = Math.sin(phi);
    const swell = 0.62 * Math.sin(t * 2.1 - i * 0.52) + 0.38 * Math.sin(t * 1.27 + i * 0.83);
    const rr = R * (0.88 + 0.105 * swell);
    const n = Math.max(1, Math.round(Math.abs(cphi) * lon));
    for (let j = 0; j < n; j++) {
      const th = (j / n) * 2 * Math.PI;
      const [x, y, z] = proj(cphi * Math.cos(th) * rr, sphi * rr, cphi * Math.sin(th) * rr);
      const depth = (z / R + 1) / 2;
      const up = Math.max(0, swell);
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth) * (1 + 0.4 * up) * rs,
        white: 0.66 - 0.56 * depth - 0.1 * up,
      });
    }
  }
  return finish(dots, [], o.rMin);
};

const smooth = (x: number) => x * x * (3 - 2 * x);

function polyline(points: [number, number][]) {
  const n = points.length;
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lens.push(l);
    total += l;
  }
  return (u: number): [number, number] => {
    let d = u * total;
    let k = 0;
    while (d > lens[k] && k < n - 1) {
      d -= lens[k];
      k++;
    }
    const a = points[k];
    const b = points[(k + 1) % n];
    const f = lens[k] ? Math.min(1, d / lens[k]) : 0;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
}

const SHAPES: ((u: number) => [number, number])[] = [
  (u) => {
    const a = -Math.PI / 2 + u * 2 * Math.PI;
    return [Math.cos(a) * 0.24, Math.sin(a) * 0.24];
  },
  polyline([
    [0, -0.26],
    [0.24, 0.16],
    [-0.24, 0.16],
  ]),
  polyline([
    [0, -0.2],
    [0.2, -0.2],
    [0.2, 0.2],
    [-0.2, 0.2],
    [-0.2, -0.2],
  ]),
];

const HOLD = 1.4;
const BLEND = 0.9;
const CYCLE = 2.3;

const morph: Mode = (size, t, o) => {
  const n = SHAPES.length;
  const cyc = t % (CYCLE * n);
  const idx = Math.floor(cyc / CYCLE);
  const local = cyc - idx * CYCLE;
  const mix = local > HOLD ? smooth((local - HOLD) / BLEND) : 0;
  const spread = o.spread ?? 1;
  const from = SHAPES[idx];
  const to = SHAPES[(idx + 1) % n];
  const path: [number, number][] = [];
  for (let i = 0; i < 160; i++) {
    const u = i / 160;
    const a = from(u);
    const b = to(u);
    path.push([(a[0] + (b[0] - a[0]) * mix) * spread, (a[1] + (b[1] - a[1]) * mix) * spread]);
  }
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < 160; i++) {
    const a = path[i];
    const b = path[(i + 1) % 160];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lens.push(l);
    total += l;
  }
  const count = Math.max(6, Math.round(34 * (o.iconD ?? 1)));
  const rDot = (o.rDot ?? 0.021) * 1.35 * spread;
  const pulse = 1 + 0.02 * Math.sin(local * 3.1);
  const dots: Dot[] = [];
  const c = size / 2;
  let seg = 0;
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    while (acc + lens[seg] < target && seg < 159) {
      acc += lens[seg];
      seg++;
    }
    const a = path[seg];
    const b = path[(seg + 1) % 160];
    const f = lens[seg] ? Math.min(1, (target - acc) / lens[seg]) : 0;
    const x = (a[0] + (b[0] - a[0]) * f) * pulse;
    const y = (a[1] + (b[1] - a[1]) * f) * pulse;
    dots.push({ x: c + x * size, y: c + y * size, z: 0, r: Math.max(0.35, rDot * size), white: 0.1 });
  }
  return finish(dots, [], o.rMin);
};

const orbits: Mode = (size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.82;
  const proj = projector(t * 0.12, 0.3, cx, cy, 1);
  const rs = sizeScale(size, o.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const orbitN = o.orbitN ?? 12;
  const ghosts = o.ghostN ?? 40;
  const particles = o.particles ?? 3;
  for (let k = 0; k < orbitN; k++) {
    const h1 = hash2(k, 1.7);
    const h2 = hash2(k, 5.2);
    const h3 = hash2(k, 8.9);
    const radius = R * (0.45 + 0.52 * h1);
    const az = h1 * 2 * Math.PI;
    const pol = Math.acos(2 * h2 - 1);
    const nx = Math.sin(pol) * Math.cos(az);
    const ny = Math.cos(pol);
    const nz = Math.sin(pol) * Math.sin(az);
    let ux = -ny;
    let uy = nx;
    const len = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy));
    ux /= len;
    uy /= len;
    const vx = ny * 0 - nz * uy;
    const vy = nz * ux - nx * 0;
    const vz = nx * uy - ny * ux;
    const spin = (0.25 + 0.55 * h3) * (h3 > 0.5 ? 1 : -1);
    for (let i = 0; i < ghosts; i++) {
      const a = (i / ghosts) * 2 * Math.PI;
      const [x, y, z] = proj(
        (ux * Math.cos(a) + vx * Math.sin(a)) * radius,
        (uy * Math.cos(a) + vy * Math.sin(a)) * radius,
        (0 * Math.cos(a) + vz * Math.sin(a)) * radius,
      );
      const depth = (z / radius + 1) / 2;
      dots.push({ x, y, z, r: (o.ghostR ?? 0.9) * rs, white: 0.72, a: (o.ghostA ?? 0.5) * (0.4 + 0.6 * depth) });
    }
    for (let i = 0; i < particles; i++) {
      const a = t * spin + (i / particles) * 2 * Math.PI + h2 * 6;
      const [x, y, z] = proj(
        (ux * Math.cos(a) + vx * Math.sin(a)) * radius,
        (uy * Math.cos(a) + vy * Math.sin(a)) * radius,
        (0 * Math.cos(a) + vz * Math.sin(a)) * radius,
      );
      const depth = (z / radius + 1) / 2;
      dots.push({ x, y, z, r: ((o.partR ?? 1.2) + (o.partRDepth ?? 1.6) * depth) * rs, white: 0.3 - 0.22 * depth });
    }
  }
  return finish(dots, [], o.rMin);
};

const ribbon: Mode = (size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.78;
  const spinMul = o.spin ?? 1;
  const proj = projector(t * 0.1 * spinMul, 0.3, cx, cy, 1);
  const rs = sizeScale(size, o.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const ghosts = o.ghostN ?? 150;
  for (let i = 0; i < ghosts; i++) {
    const p = fibonacci(i, ghosts);
    const [x, y, z] = proj(p[0] * R, p[1] * R, p[2] * R);
    const depth = (z / R + 1) / 2;
    dots.push({ x, y, z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
  }
  const yaw = t * 0.24 * spinMul;
  const tilt = o.faceOn ? -0.3 : 0.55 + 0.3 * Math.sin(t * 0.18) * spinMul;
  const ax = Math.cos(yaw);
  const az = Math.sin(yaw);
  const bx = -az * Math.sin(tilt);
  const by = Math.cos(tilt);
  const bz = ax * Math.sin(tilt);
  const nx = 0 * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - 0 * bx;
  const amp = 0.23 * (o.wobMul ?? 1);
  const baseR = o.faceOn ? R / (1 + 0.85 * amp) : R;
  const lanes = o.lanes ?? 5;
  const segs = o.segs ?? 88;
  const bands = Math.max(1, Math.round(lanes * (o.bandMul ?? 1)));
  for (let b = 0; b < bands; b++) {
    const offset = (b - (bands - 1) / 2) * 0.075;
    const edge = Math.abs(b - (bands - 1) / 2) / Math.max(1, (bands - 1) / 2);
    for (let s = 0; s < segs; s++) {
      const u = (s / segs) * 2 * Math.PI;
      const wob = (0.16 * Math.sin(u * 3 - t * 1.7 + b * 0.22) + 0.07 * Math.sin(u * 5 + t * 1.1)) * (o.wobMul ?? 1);
      const radial = o.faceOn ? 1 + wob : 1;
      const lift = o.faceOn ? offset : offset + wob;
      const px = ax * Math.cos(u) + bx * Math.sin(u) + nx * lift;
      const py = 0 * Math.cos(u) + by * Math.sin(u) + ny * lift;
      const pz = az * Math.cos(u) + bz * Math.sin(u) + nz * lift;
      const len = Math.sqrt(px * px + py * py + pz * pz);
      const rr = baseR * radial;
      const [x, y, z] = proj((px / len) * rr, (py / len) * rr, (pz / len) * rr);
      const depth = (z / R + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r: ((o.rBase ?? 1.1) + (o.rDepth ?? 1.7) * depth) * (1 - 0.25 * edge) * rs,
        white: 0.52 - 0.44 * depth + 0.18 * edge,
        a: 0.4 + 0.6 * depth,
      });
    }
  }
  return finish(dots, [], o.rMin);
};

const web: Mode = (size, t, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.8 * (o.spread ?? 1);
  const proj = projector(t * 0.12, 0.32, cx, cy, R);
  const rs = sizeScale(size, o.rsPow ?? 0.6);
  const nodeN = o.nodeN ?? 30;
  const thr = o.thr ?? 0.72;
  const nodeR = o.nodeR ?? 1.4;
  const nodeRDepth = o.nodeRDepth ?? 1.8;
  const nodes: [number, number, number][] = [];
  for (let i = 0; i < nodeN; i++) {
    const p = fibonacci(i, nodeN);
    const x = p[0] + 0.3 * (noise2(i * 0.31 + 9, t * 0.24) - 0.5) * 2;
    const y = p[1] + 0.3 * (noise2(i * 0.53 + 27, t * 0.21) - 0.5) * 2;
    const z = p[2] + 0.3 * (noise2(i * 0.77 + 55, t * 0.27) - 0.5) * 2;
    const l = Math.sqrt(x * x + y * y + z * z);
    nodes.push([x / l, y / l, z / l]);
  }
  const lines: Line[] = [];
  const dots: Dot[] = [];
  for (let i = 0; i < nodeN; i++)
    for (let j = i + 1; j < nodeN; j++) {
      const dx = nodes[i][0] - nodes[j][0];
      const dy = nodes[i][1] - nodes[j][1];
      const dz = nodes[i][2] - nodes[j][2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist >= thr) continue;
      const [x1, y1, z1] = proj(nodes[i][0], nodes[i][1], nodes[i][2]);
      const [x2, y2, z2] = proj(nodes[j][0], nodes[j][1], nodes[j][2]);
      const depth = ((z1 + z2) / 2 + 1) / 2;
      lines.push({
        x1,
        y1,
        x2,
        y2,
        white: 0.42,
        a: (1 - dist / thr) * (0.3 + 0.55 * depth),
        w: Math.max(0.6, (o.lineW ?? 0.8) * rs),
      });
    }
  for (let i = 0; i < nodeN; i++) {
    const [x, y, z] = proj(nodes[i][0], nodes[i][1], nodes[i][2]);
    const depth = (z + 1) / 2;
    const beat = 1 + 0.25 * Math.sin(t * 1.4 + i * 2.7);
    dots.push({ x, y, z, r: (nodeR + nodeRDepth * depth) * beat * rs, white: 0.55 - 0.45 * depth });
  }
  const signals = o.signals ?? 5;
  for (let k = 0; k < signals; k++) {
    const epoch = Math.floor(t * 0.55 + k * 7.31);
    const a = Math.floor(hash2(epoch, k * 3.1 + 1.7) * nodeN);
    const b = Math.floor(hash2(epoch, k * 5.7 + 4.2) * nodeN);
    if (a === b) continue;
    const f = fract(t * 0.55 + k * 7.31);
    const x0 = lerp(nodes[a][0], nodes[b][0], f);
    const y0 = lerp(nodes[a][1], nodes[b][1], f);
    const z0 = lerp(nodes[a][2], nodes[b][2], f);
    const l = Math.max(1e-6, Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0));
    const [x, y, z] = proj(x0 / l, y0 / l, z0 / l);
    const depth = (z + 1) / 2;
    dots.push({ x, y, z, r: (nodeR * 1.5 + nodeRDepth * depth) * rs, white: 0.05, a: 0.5 + 0.5 * depth });
  }
  return finish(dots, lines, o.rMin);
};

export const MODES: Record<string, Mode> = {
  orbits,
  globe,
  rubik,
  wave,
  web,
  braid,
  ribbon,
  ring: ribbon,
  morph,
};

export const PAINTERS: Record<string, (ctx: CanvasRenderingContext2D, size: number, t: number, dark: boolean, o: Opts) => void> =
  Object.fromEntries(Object.entries(MODES).map(([k, mode]) => [k, (ctx, size, t, dark, o) => paint(ctx, mode(size, t, o), dark)]));

const PAIRS: [string, string][] = [
  ["latRings", "lonDensity"],
  ["rings", "lonDensity"],
  ["lanes", "segs"],
];
const COUNTS = ["orbitN", "ghostN", "nodeN", "strandN", "signals"];
const ICON_D = ["iconD"];
const SIZES = ["rBase", "rDepth", "rActive", "rDot", "ghostR", "partR", "partRDepth", "nodeR", "nodeRDepth"];

function scaleCount(o: Opts, k: number) {
  const out: Opts = { ...o };
  const done = new Set<string>();
  const root = Math.sqrt(k);
  for (const [a, b] of PAIRS) {
    const va = out[a];
    const vb = out[b];
    if (va != null && vb != null && !done.has(a) && !done.has(b)) {
      out[a] = Math.max(2, Math.round(va * root));
      out[b] = Math.max(2, Math.round(vb * root));
      done.add(a);
      done.add(b);
    }
  }
  for (const key of COUNTS) {
    const v = out[key];
    if (v != null && v !== 0 && !done.has(key)) out[key] = Math.max(1, Math.round(v * k));
  }
  for (const key of ICON_D) {
    const v = out[key];
    if (v != null) out[key] = Math.max(0.02, v * k);
  }
  return out;
}

function scaleSize(o: Opts, k: number) {
  const out: Opts = { ...o };
  for (const key of SIZES) {
    const v = out[key];
    if (v != null) out[key] = v * k;
  }
  out.rSizeMul = (out.rSizeMul ?? 1) * k;
  return out;
}

const BASE: Record<string, Opts> = {
  globe: { latRings: 17, lonDensity: 44, rBase: 0.6, rDepth: 1.7, rBoost: 1, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
  orbits: { orbitN: 12, ghostN: 40, ghostR: 0.9, ghostA: 0.5, particles: 3, partR: 1.2, partRDepth: 1.6, rsPow: 0.6, rMin: 0.3 },
  rubik: {
    latRings: 15,
    lonDensity: 40,
    moveCount: 14,
    rBase: 0.6,
    rDepth: 1.7,
    rActive: 0.3,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3,
  },
  wave: { rings: 15, lonDensity: 40, rBase: 0.6, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
  web: { nodeN: 30, thr: 0.72, signals: 5, nodeR: 1.4, nodeRDepth: 1.8, lineW: 0.8, rsPow: 0.6, rMin: 0.3 },
  braid: { strandN: 52, turns: 3, ghostN: 150, rBase: 1.2, rDepth: 1.8, rsPow: 0.6, rMin: 0.3 },
  ribbon: { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
  ring: { lanes: 5, segs: 88, ghostN: 0, faceOn: 1, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
  morph: { rDot: 0.021, iconD: 1, rMin: 0.25 },
};

export type OrbState =
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "connecting"
  | "weaving"
  | "composing"
  | "breathing"
  | "shaping";

export const STATE_MODE: Record<OrbState, string> = {
  working: "orbits",
  searching: "globe",
  solving: "rubik",
  listening: "wave",
  connecting: "web",
  weaving: "braid",
  composing: "ribbon",
  breathing: "ring",
  shaping: "morph",
};

type Tune = { speed: number; count: number; size: number; extra?: Opts };

const TUNING: Record<string, Record<number, Tune>> = {
  orbits: { 64: { speed: 1.885, count: 1, size: 1 }, 20: { speed: 3.9, count: 0.238, size: 2.4 } },
  globe: {
    64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } },
  },
  rubik: { 64: { speed: 1.82, count: 0.35, size: 1.05 }, 20: { speed: 1.95, count: 0.088, size: 1.9 } },
  wave: { 64: { speed: 4.388, count: 0.341, size: 1 }, 20: { speed: 3.998, count: 0.105, size: 1.6 } },
  web: { 64: { speed: 3.315, count: 1.35, size: 0.95 }, 20: { speed: 6.63, count: 0.25, size: 1.52 } },
  braid: { 64: { speed: 1.625, count: 0.5, size: 1 }, 20: { speed: 2.75, count: 0.1125, size: 1.36 } },
  ribbon: {
    64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } },
  },
  ring: {
    64: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } },
    20: { speed: 3.78, count: 0.028, size: 1.622, extra: { spin: 0, bandMul: 3.968, wobMul: 0.565 } },
  },
  morph: {
    64: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } },
    20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } },
  },
};

const cache = new Map<string, { mode: string; speed: number; opts: Opts }>();

/** Resolve a state at one of the two tuned sizes (64 or 20 px) into a mode, speed and options. */
export function configFor(state: OrbState, size: 64 | 20) {
  const key = `${state}-${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mode = STATE_MODE[state];
  const tune = TUNING[mode][size];
  let opts: Opts = { ...BASE[mode] };
  if (tune.count !== 1) opts = scaleCount(opts, tune.count);
  if (tune.size !== 1) opts = scaleSize(opts, tune.size);
  if (tune.extra) opts = { ...opts, ...tune.extra };
  const cfg = { mode, speed: tune.speed, opts };
  cache.set(key, cfg);
  return cfg;
}
