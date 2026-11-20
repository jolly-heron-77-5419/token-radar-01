// Token Radar dashboard: board, detail view, filters and a live model sandbox.
// Reads window.RADAR (written by main.ts into data.js beside this page). No network, no fetch.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.getElementById('meta').textContent = 'No radar data: data.js is missing.'; return; }

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) { return n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function ageText(d) { return d == null ? '—' : d >= 365 ? (d / 365).toFixed(1) + 'y' : d + 'd'; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  var watchSet = {};
  (R.watchlist_slugs || []).forEach(function (s) { watchSet[s] = true; });
  // The board's own watchlist flag comes from the data: rows on the snapshot watchlist.
  function isWatch(r) { return !!watchSet[r.slug]; }

  // ---- header and stats -------------------------------------------------
  $('meta').textContent = 'Snapshot ' + R.as_of + ' · ' + R.source + ' · model ' + R.model_version +
    ' · watchlist floor $' + (R.floor_usd / 1e6).toFixed(0) + 'M TVL';
  $('asof').textContent = R.as_of;
  var top = R.rows[0];
  $('stats').innerHTML =
    stat(money(top ? top.implied_value_usd : 0), 'Top implied value' + (top ? ' — ' + esc(top.name) : '')) +
    stat(String(R.board_size), 'Protocols on the board') +
    stat(String(R.watchlist_size), 'On the watchlist (floor)') +
    stat(String(R.early_size), 'Early finds below the floor') +
    stat(String(R.live_size), 'Live-token protocols set aside');
  function stat(b, s) { return '<div class="stat"><b>' + b + '</b><span>' + s + '</span></div>'; }

  // ---- filter controls ---------------------------------------------------
  var cats = [], chains = [];
  R.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  fillSelect($('category'), cats); fillSelect($('chain'), chains);
  function fillSelect(sel, items) { items.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); }); }

  var params = new URLSearchParams(location.search);
  if (params.get('category')) $('category').value = params.get('category');
  if (params.get('chain')) $('chain').value = params.get('chain');
  if (params.get('q')) $('q').value = params.get('q');
  if (params.get('sort')) $('sort').value = params.get('sort');
  if (params.get('watchlist') === '1') $('watchlist-only').checked = true;

  // ---- sandbox state -----------------------------------------------------
  var sandbox = { gw: 0.6, mr: 0.5, ms: 1.0 };
  function sandboxImplied(r) {
    var growthPct = (r.growth_multiplier - 1) / 0.6 * 100;
    var g = clamp(growthPct, -60, 120);
    var growth = 1 + (g / 100) * sandbox.gw;
    var age = r.age_days == null ? 365 : r.age_days;
    var maturity = 0.7 + (Math.min(Math.max(age, 0), 1095) / 1095) * sandbox.mr;
    return Math.max(1, Math.round(r.tvl_usd * r.category_multiple * sandbox.ms * growth * maturity * r.breadth_multiplier));
  }
  function bindSlider(id, out, key) {
    $(id).addEventListener('input', function () {
      sandbox[key] = parseFloat($(id).value);
      $(out).textContent = sandbox[key].toFixed(2);
      renderBoard();
    });
  }
  bindSlider('s-gw', 'o-gw', 'gw'); bindSlider('s-mr', 'o-mr', 'mr'); bindSlider('s-ms', 'o-ms', 'ms');
  $('sandbox-reset').addEventListener('click', function () {
    sandbox = { gw: 0.6, mr: 0.5, ms: 1.0 };
    $('s-gw').value = '0.6'; $('s-mr').value = '0.5'; $('s-ms').value = '1';
    $('o-gw').textContent = '0.60'; $('o-mr').textContent = '0.50'; $('o-ms').textContent = '1.00';
    renderBoard();
  });

  // ---- board -------------------------------------------------------------
  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('category').value, ch = $('chain').value, wl = $('watchlist-only').checked;
    var rows = R.rows.filter(function (r) {
      if (wl && !isWatch(r)) return false;
      if (cat && r.category !== cat) return false;
      if (ch && (r.chains || []).indexOf(ch) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var sort = $('sort').value;
    var key = sort === 'tvl' ? function (r) { return r.tvl_usd; }
      : sort === 'growth' ? function (r) { return r.change_7d == null ? -Infinity : r.change_7d; }
      : sort === 'age' ? function (r) { return r.age_days == null ? -1 : r.age_days; }
      : function (r) { return sandboxImplied(r); };
    rows.sort(function (a, b) { return key(b) - key(a) || (a.slug < b.slug ? -1 : 1); });
    return rows;
  }
  function renderBoard() {
    var rows = filtered();
    var sandboxOn = sandbox.gw !== 0.6 || sandbox.mr !== 0.5 || sandbox.ms !== 1.0;
    $('count').textContent = rows.length + ' of ' + R.rows.length + ' protocols shown' +
      (sandboxOn ? ' · sandbox model active (growth ' + sandbox.gw.toFixed(2) + ', maturity ' + sandbox.mr.toFixed(2) + ', multiple ×' + sandbox.ms.toFixed(2) + ')' : '');
    $('rows').innerHTML = rows.map(function (r) {
      var imp = sandboxOn ? sandboxImplied(r) : r.implied_value_usd;
      var g = r.change_7d == null ? '<span>—</span>' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</span>';
      return '<tr data-slug="' + esc(r.slug) + '"><td class="rank">' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + (isWatch(r) ? '<span class="badge">WATCHLIST</span>' : '') + '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td><td>' + esc((r.chains || []).slice(0, 3).join(', ')) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + g + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td><td class="num"><b>' + money(imp) + '</b></td></tr>';
    }).join('');
  }
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) location.hash = '#/protocol/' + tr.getAttribute('data-slug');
  });
  ['q', 'category', 'chain', 'sort', 'watchlist-only'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
    $(id).addEventListener('change', renderBoard);
  });

  // ---- live view ---------------------------------------------------------
  $('live-rows').innerHTML = R.live.map(function (p) {
    var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '×' : '—';
    return '<tr><td><b>' + esc(p.name) + '</b><br><span class="slug">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td><td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + ratio + '</td></tr>';
  }).join('');

  // ---- calibration table -------------------------------------------------
  $('calib-rows').innerHTML = R.calibration.by_category.map(function (c) {
    return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.multiple.toFixed(3) + '×</td>' +
      '<td class="num">' + c.live_samples + '</td><td class="num">' +
      (c.median_ratio == null ? 'fallback ' + R.calibration.overall_median.toFixed(3) + '×' : c.median_ratio.toFixed(3) + '×') + '</td></tr>';
  }).join('');

  // ---- detail view -------------------------------------------------------
  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) { r = R.rows[i]; break; }
    if (!r) { location.hash = '#/'; return; }
    $('board-view').hidden = true; $('detail-view').hidden = false;
    var base = r.tvl_usd * r.category_multiple;
    var comps = R.live.filter(function (p) { return p.category === r.category; }).slice(0, 5);
    var compHtml = comps.length ? '<h3>Live comparables in ' + esc(r.category || 'this category') + '</h3><table class="board"><thead><tr><th>Protocol</th><th class="num">Market cap</th><th class="num">MCap / TVL</th></tr></thead><tbody>' +
      comps.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + (p.mcap_usd / p.tvl_usd).toFixed(2) + '×</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="note">No live-token protocol in this category sits in the snapshot, so the category multiple falls back to the snapshot-wide median.</p>';
    $('detail').innerHTML =
      '<div class="detail-head"><h2>#' + r.rank + ' ' + esc(r.name) + '</h2><span class="slug">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorized') + ' · ' + esc((r.chains || []).join(', ')) + '</span></div>' +
      '<div class="factors">' +
      '<div class="factor"><b>' + money(r.tvl_usd) + '</b><span>TVL</span><div class="formula">7d ' + pct(r.change_7d) + ' · age ' + ageText(r.age_days) + '</div></div>' +
      '<div class="factor"><b>' + r.category_multiple.toFixed(3) + '×</b><span>Category multiple</span><div class="formula">median MCap/TVL of live ' + esc(r.category || 'protocols') + '</div></div>' +
      '<div class="factor"><b>' + r.growth_multiplier.toFixed(2) + '×</b><span>Growth</span><div class="formula">1 + clamp(7d, −60, 120)% × 0.6</div></div>' +
      '<div class="factor"><b>' + r.maturity_multiplier.toFixed(2) + '×</b><span>Maturity</span><div class="formula">0.7 + min(age, 3y) / 3y × 0.5</div></div>' +
      '<div class="factor"><b>' + r.breadth_multiplier.toFixed(2) + '×</b><span>Breadth</span><div class="formula">' + (r.chains || []).length + ' chains × 0.02</div></div>' +
      '<div class="factor"><b>' + money(r.implied_value_usd) + '</b><span>Implied value</span><div class="formula">TVL × multiple × growth × maturity × breadth</div></div>' +
      '</div>' +
      '<p class="note">This protocol records no token in the snapshot — the value above is what a token would be worth if its record stayed as it is. It is not a prediction that a token is issued, or when.</p>' +
      '<h3>How to farm it</h3><ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      compHtml;
    window.scrollTo(0, 0);
  }
  function route() {
    var m = location.hash.match(/^#\/protocol\/(.+)$/);
    if (m) { showDetail(decodeURIComponent(m[1])); return; }
    $('board-view').hidden = false; $('detail-view').hidden = true;
  }
  window.addEventListener('hashchange', route);

  renderBoard();
  route();
})();
