/* ============================================================
   Hand-rolled SVG charts — mirrors the reference clip:
   multi-series smooth area chart, semicircle gauge with needle,
   bar chart with a highlighted bar + tooltip pill, donut, sparkline.
   ============================================================ */

const CH = (function () {
  let uid = 0;
  const nid = p => p + (++uid);

  /* Catmull-Rom -> cubic bezier, for the soft flowing lines */
  function smooth(pts) {
    if (pts.length < 2) return '';
    let d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ',' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
           ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  /* ---------- performance area chart ---------- */
  function area(opts) {
    const W = opts.w || 760, H = opts.h || 260;
    const pad = { l: 40, r: 16, t: 18, b: 30 };
    const series = opts.series;
    const all = series.flatMap(s => s.data);
    const max = Math.ceil(Math.max(...all) / 20) * 20;
    const min = 0;
    const n = opts.labels.length;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const X = i => pad.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const Y = v => pad.t + ih - ((v - min) / (max - min)) * ih;

    let g = '';
    const ticks = 5;
    for (let t = 0; t <= ticks; t++) {
      const v = min + ((max - min) * t) / ticks;
      const y = Y(v);
      g += '<line class="grid-line" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '" ' +
        'stroke-dasharray="' + (t === 0 ? '0' : '3 6') + '"/>';
      g += '<text class="axis-lbl" x="' + (pad.l - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }
    opts.labels.forEach((l, i) => {
      g += '<text class="axis-lbl" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + l + '</text>';
    });

    let body = '';
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => [X(i), Y(v)]);
      const line = smooth(pts);
      const gid = nid('ag');
      const areaD = line + ' L' + X(n - 1) + ' ' + (pad.t + ih) + ' L' + X(0) + ' ' + (pad.t + ih) + ' Z';
      body += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + s.color + '" stop-opacity="' + (si === 0 ? .3 : .18) + '"/>' +
        '<stop offset="100%" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient></defs>';
      body += '<path d="' + areaD + '" fill="url(#' + gid + ')" class="anim-fade" style="animation-delay:' + (si * 120) + 'ms"/>';
      body += '<path d="' + line + '" fill="none" stroke="' + s.color + '" stroke-width="2.6" ' +
        'stroke-linecap="round" class="anim-draw" style="animation-delay:' + (si * 160) + 'ms"/>';
      pts.forEach((p, i) => {
        body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.4" fill="var(--card-solid)" stroke="' + s.color +
          '" stroke-width="2" opacity="' + (i === n - 1 ? 1 : .0) + '"><title>' + s.key + ' · ' + opts.labels[i] + ': ' + s.data[i] + '</title></circle>';
      });
    });

    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opts.alt || 'Line chart') + '">' +
      g + body + '</svg>';
  }

  /* ---------- semicircle gauge with needle ---------- */
  function gauge(opts) {
    const W = opts.w || 260, H = opts.h || 150;
    const cx = W / 2, cy = H - 14, r = Math.min(W / 2 - 12, H - 34);
    const pct = Math.max(0, Math.min(1, opts.value));
    const A = Math.PI, B = Math.PI - Math.PI * pct;
    const p = (a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    const arc = (a0, a1) => {
      const s = p(a0), e = p(a1);
      const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
      return 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1);
    };
    const needle = p(Math.PI - Math.PI * pct);
    const gid = nid('gg');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opts.alt || 'Gauge') + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="1" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#f8c078"/><stop offset="100%" stop-color="#ef7c33"/></linearGradient></defs>' +
      '<path d="' + arc(Math.PI, 0) + '" fill="none" stroke="rgba(127,127,160,.2)" stroke-width="18" stroke-linecap="round"/>' +
      '<path d="' + arc(A, B) + '" fill="none" stroke="url(#' + gid + ')" stroke-width="18" stroke-linecap="round" ' +
      'class="anim-draw" style="animation-duration:1.2s"/>' +
      '<path d="M' + cx + ' ' + cy + ' L' + needle[0].toFixed(1) + ' ' + needle[1].toFixed(1) + '" stroke="var(--ink)" ' +
      'stroke-width="4" stroke-linecap="round" opacity=".85"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="var(--ink)"/>' +
      '</svg>';
  }

  /* ---------- bar chart with one highlighted bar ---------- */
  function bars(opts) {
    const W = opts.w || 700, H = opts.h || 250;
    const pad = { l: 42, r: 12, t: 26, b: 28 };
    const d = opts.data, n = d.length;
    const max = Math.ceil(Math.max(...d) / 50) * 50;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const bw = (iw / n) * 0.44;
    const step = iw / n;

    let g = '';
    for (let t = 0; t <= 3; t++) {
      const v = (max * t) / 3, y = pad.t + ih - (v / max) * ih;
      g += '<line class="grid-line" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '" stroke-dasharray="3 6"/>';
      g += '<text class="axis-lbl" x="' + (pad.l - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }

    let body = '';
    d.forEach((v, i) => {
      const h = (v / max) * ih;
      const x = pad.l + step * i + (step - bw) / 2;
      const y = pad.t + ih - h;
      const hot = i === opts.hot;
      const gid = nid('bg');
      if (hot) {
        body += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#f8b45e"/><stop offset="100%" stop-color="#ee6f2c"/></linearGradient></defs>';
        body += '<rect class="bar-hot anim-rise" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h +
          '" rx="' + (bw / 2) + '" fill="url(#' + gid + ')" style="animation-delay:' + (i * 60) + 'ms"/>';
        body += '<circle cx="' + (x + bw / 2) + '" cy="' + (y + 14) + '" r="5" fill="var(--ink)"/>';
        body += '<circle cx="' + (x + bw / 2) + '" cy="' + (y + 14) + '" r="2" fill="#fff"/>';
        const tw = 52, tx = x + bw / 2 - tw / 2, ty = y - 30;
        body += '<rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="24" rx="12" fill="var(--ink)"/>';
        body += '<text class="chart-tip" x="' + (x + bw / 2) + '" y="' + (ty + 16) + '" text-anchor="middle">' + v + '</text>';
      } else {
        /* the placeholder bars in the clip are diagonal hatching */
        body += '<g class="anim-rise" style="animation-delay:' + (i * 60) + 'ms">';
        for (let k = 0; k < Math.floor(h / 9); k++) {
          const ly = pad.t + ih - 6 - k * 9;
          body += '<line x1="' + x + '" y1="' + ly + '" x2="' + (x + bw * .7) + '" y2="' + (ly - bw * .5) +
            '" stroke="rgba(127,127,160,.35)" stroke-width="2.4" stroke-linecap="round"/>';
        }
        body += '</g>';
      }
      body += '<text class="axis-lbl" x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + opts.labels[i] + '</text>';
    });

    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opts.alt || 'Bar chart') + '">' + g + body + '</svg>';
  }

  /* ---------- donut ---------- */
  function donut(opts) {
    const S = opts.size || 190, r = S / 2 - 14, cx = S / 2, cy = S / 2;
    const total = opts.data.reduce((a, b) => a + b.value, 0);
    let acc = 0, body = '';
    const C = 2 * Math.PI * r;
    opts.data.forEach((d, i) => {
      const frac = d.value / total;
      const dash = frac * C;
      body += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color +
        '" stroke-width="18" stroke-linecap="butt" stroke-dasharray="' + (dash - 3) + ' ' + (C - dash + 3) +
        '" stroke-dashoffset="' + (-acc * C) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')">' +
        '<title>' + d.name + ': ' + d.value + '</title></circle>';
      acc += frac;
    });
    return '<svg class="chart" viewBox="0 0 ' + S + ' ' + S + '" style="max-width:' + S + 'px;margin:auto" role="img" aria-label="' + (opts.alt || 'Donut chart') + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(127,127,160,.13)" stroke-width="18"/>' +
      body +
      '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" style="font-size:26px;font-weight:800;fill:var(--ink)">' + nf.format(total) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" class="axis-lbl">' + (opts.caption || 'members') + '</text>' +
      '</svg>';
  }

  /* ---------- sparkline ---------- */
  function spark(data, color) {
    const W = 120, H = 34, max = Math.max(...data), min = Math.min(...data);
    const pts = data.map((v, i) => [
      (i / (data.length - 1)) * W,
      H - 3 - ((v - min) / (max - min || 1)) * (H - 6)
    ]);
    const d = smooth(pts);
    const gid = nid('sp');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity=".35"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" fill="url(#' + gid + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round"/></svg>';
  }

  /* ---------- horizontal usage bars ---------- */
  function hbars(rows) {
    const max = Math.max(...rows.map(r => r.hrs));
    return rows.map(r =>
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
      '<span style="flex:0 0 132px;font-size:12.5px;font-weight:700;color:var(--ink-2)">' + r.name + '</span>' +
      '<div class="bar" style="flex:1;margin:0"><i style="width:' + ((r.hrs / max) * 100).toFixed(0) + '%"></i></div>' +
      '<span style="flex:0 0 54px;text-align:right;font-size:12.5px;font-weight:800">' + r.hrs + 'h</span></div>'
    ).join('');
  }

  /* ---------- weather line ---------- */
  function weather(opts) {
    const W = 720, H = 170, pad = { l: 28, r: 28, t: 20, b: 26 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, n = opts.labels.length;
    const X = i => pad.l + (iw * i) / (n - 1);
    const max = Math.max(...opts.high), min = Math.min(...opts.low);
    const Y = v => pad.t + ih - ((v - min) / (max - min)) * ih;
    let body = '';
    opts.labels.forEach((l, i) => {
      body += '<text class="axis-lbl" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + l + '</text>';
      body += '<rect x="' + (X(i) - 13) + '" y="' + (pad.t + ih - (opts.rain[i] / 100) * ih * .8) + '" width="26" height="' +
        ((opts.rain[i] / 100) * ih * .8) + '" rx="8" fill="rgba(107,124,255,.16)"><title>' + opts.rain[i] + '% rain</title></rect>';
    });
    const hp = opts.high.map((v, i) => [X(i), Y(v)]);
    const lp = opts.low.map((v, i) => [X(i), Y(v)]);
    body += '<path d="' + smooth(hp) + '" fill="none" stroke="#f4a036" stroke-width="2.6" stroke-linecap="round"/>';
    body += '<path d="' + smooth(lp) + '" fill="none" stroke="#6b7cff" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="5 5"/>';
    hp.forEach((p, i) => {
      body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="#f4a036"/>';
      body += '<text x="' + p[0] + '" y="' + (p[1] - 10) + '" text-anchor="middle" style="font-size:11px;font-weight:800;fill:var(--ink)">' + opts.high[i] + '°</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weekly forecast">' + body + '</svg>';
  }

  return { area, gauge, bars, donut, spark, hbars, weather, smooth };
})();
