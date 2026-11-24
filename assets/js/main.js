/* Bajan Concepts — interactions */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  $('#yr').textContent = new Date().getFullYear();

  /* header */
  var header = $('.site-header');
  var onScroll = function () { header.classList.toggle('stuck', window.scrollY > 24); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  var burger = $('#burger'), nav = $('#nav');
  function closeNav() { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', function () {
    var o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o);
  });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', closeNav); });

  /* theme */
  $$('.theme button').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-set');
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('bc-theme', t); } catch (e) {}
    });
  });

  /* reveal + counters */
  var counted = new WeakSet();
  function count(el) {
    if (counted.has(el)) return; counted.add(el);
    var end = +el.dataset.count, suf = el.dataset.suffix || '', pre = el.dataset.prefix || '';
    if (reduce) { el.textContent = pre + end + suf; return; }
    var t0 = performance.now(), dur = 1400;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + Math.round(end * e) + suf;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in'); io.unobserve(e.target);
        $$('[data-count]', e.target).forEach(count);
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
    $$('[data-count]').forEach(count);
  }

  /* tilt */
  if (!reduce && window.matchMedia('(hover:hover)').matches) {
    $$('.tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.transform = 'perspective(900px) rotateY(' + ((x - .5) * 8) + 'deg) rotateX(' + ((.5 - y) * 8) + 'deg) translateZ(0)';
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* gallery filter */
  var items = $$('.g-item');
  $$('.filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.filters button').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-selected', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-selected', 'true');
      var f = b.dataset.f;
      items.forEach(function (it) { it.classList.toggle('hide', f !== 'all' && it.dataset.cat !== f); });
    });
  });

  /* lightbox */
  var lb = $('#lb'), lbImg = $('img', lb), lbCap = $('figcaption', lb), idx = 0, lastFocus;
  function vis() { return items.filter(function (i) { return !i.classList.contains('hide'); }); }
  function show(i) {
    var v = vis(); if (!v.length) return;
    idx = (i + v.length) % v.length;
    lbImg.src = v[idx].dataset.full; lbImg.alt = $('img', v[idx]).alt; lbCap.textContent = v[idx].dataset.title;
  }
  function openLb(it) { lastFocus = document.activeElement; lb.hidden = false; document.body.style.overflow = 'hidden'; show(vis().indexOf(it)); $('.lb-x', lb).focus(); }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  items.forEach(function (it) { $('.g-btn', it).addEventListener('click', function () { openLb(it); }); });
  $('.lb-x', lb).addEventListener('click', closeLb);
  $('.lb-p', lb).addEventListener('click', function () { show(idx - 1); });
  $('.lb-n', lb).addEventListener('click', function () { show(idx + 1); });
  $('a', lb).addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
  var tx = 0;
  lb.addEventListener('touchstart', function (e) { tx = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    var d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) show(idx + (d < 0 ? 1 : -1));
  });

  /* video click-to-load (privacy friendly) */
  $$('.vid').forEach(function (v) {
    v.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + v.dataset.yt + '?autoplay=1&rel=0';
      f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.title = 'Bajan Concepts video';
      v.innerHTML = ''; v.appendChild(f);
    }, { once: true });
  });

  /* mobile bar hides at quote section */
  var mbar = $('#mbar'), quote = $('#quote');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { mbar.classList.toggle('off', es[0].isIntersecting); }, { threshold: .15 }).observe(quote);
  }

  /* ---------- quote wizard ---------- */
  var form = $('#qform'), steps = $$('.step', form), crumbs = $$('.crumbs li', form), bar = $('.progress i', form), cur = 0;
  $('#ts').value = Math.floor(Date.now() / 1000);
  function go(n) {
    cur = n;
    steps.forEach(function (s, i) { s.classList.toggle('on', i === n); });
    crumbs.forEach(function (c, i) { c.classList.toggle('on', i <= n); });
    bar.style.width = ((n + 1) / steps.length * 100) + '%';
    var top = form.getBoundingClientRect().top + window.scrollY - 100;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  }
  function valid(step) {
    var ok = true;
    $$('[required]', step).forEach(function (f) {
      var bad = !f.value.trim() || (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value));
      f.classList.toggle('bad', bad); if (bad && ok) { f.focus(); } if (bad) ok = false;
    });
    return ok;
  }
  $$('.next', form).forEach(function (b) { b.addEventListener('click', function () { if (valid(steps[cur])) go(cur + 1); }); });
  $$('.back', form).forEach(function (b) { b.addEventListener('click', function () { go(cur - 1); }); });
  $$('input,textarea', form).forEach(function (f) { f.addEventListener('input', function () { f.classList.remove('bad'); }); });

  /* service cards pre-select parts */
  $$('[data-pick]').forEach(function (a) {
    a.addEventListener('click', function () {
      $$('#pick input').forEach(function (c) { c.checked = (c.value === a.dataset.pick); });
    });
  });

  /* photos */
  var photos = $('input[type=file]', form), drop = $('#drop');
  photos.addEventListener('change', function () {
    var fs = Array.prototype.slice.call(photos.files);
    if (fs.length > 4) { fs = fs.slice(0, 4); }
    var big = fs.some(function (f) { return f.size > 6 * 1024 * 1024; });
    if (big) { photos.value = ''; drop.textContent = 'One of those photos is over 6 MB — please choose smaller images.'; return; }
    drop.textContent = fs.length ? fs.length + ' photo' + (fs.length > 1 ? 's' : '') + ' selected: ' + fs.map(function (f) { return f.name; }).join(', ') : 'Tap to add photos of your bike or inspiration';
  });

  var status = $('#status'), send = $('#send');
  function say(html, err) { status.hidden = false; status.className = 'status' + (err ? ' err' : ''); status.innerHTML = html; status.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!valid(steps[cur])) return;
    if (!valid(steps[0])) { go(0); return; }
    if (!valid(steps[1])) { go(1); return; }
    send.disabled = true; var label = send.textContent; send.textContent = 'Sending…';
    var fd = new FormData(form);
    fetch(form.action, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) {
          form.reset(); drop.textContent = 'Tap to add photos of your bike or inspiration';
          say('<b>Request received.</b>Thanks — we\'ll review your build and get back to you soon. A confirmation is on its way to your inbox.');
          form.querySelectorAll('.step').forEach(function (s) { s.style.display = 'none'; });
          $('.progress', form).style.display = 'none'; $('.crumbs', form).style.display = 'none';
        } else {
          throw new Error(res.j && res.j.error || 'fail');
        }
      })
      .catch(function (err) {
        say('<b>That didn\'t go through.</b>' + (err.message && err.message !== 'fail' ? err.message + ' ' : '') + 'Please try again, or call <a href="tel:+12104600972">210-460-0972</a> / email <a href="mailto:bajaninc@yahoo.com">bajaninc@yahoo.com</a>.', true);
        send.disabled = false; send.textContent = label;
      });
  });

  /* ---------- hero: light-cycle grid ---------- */
  var cv = $('#grid'); if (!cv) return;
  var ctx = cv.getContext('2d'), W, H, dpr, cell = 56, cycles = [], rgb = '255,199,38', brgb = '42,91,255', visible = true, last = 0;
  function readRGB() { var v = getComputedStyle(document.documentElement).getPropertyValue('--a-rgb').trim(); if (v) rgb = v; var b = getComputedStyle(document.documentElement).getPropertyValue('--b-rgb').trim(); if (b) brgb = b; }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = W < 700 ? 44 : 56;
    drawGrid();
  }
  function drawGrid() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(' + brgb + ',.16)'; ctx.lineWidth = 1; ctx.beginPath();
    for (var x = 0; x <= W; x += cell) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
    for (var y = 0; y <= H; y += cell) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();
  }
  function spawn() {
    var cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), horiz = Math.random() < .5;
    return { x: Math.floor(Math.random() * cols) * cell, y: Math.floor(Math.random() * rows) * cell,
      dx: horiz ? (Math.random() < .5 ? 1 : -1) : 0, dy: horiz ? 0 : (Math.random() < .5 ? 1 : -1),
      gold: Math.random() < .5, sp: 140 + Math.random() * 160, trail: [], turn: 2 + Math.floor(Math.random() * 6), life: 6 + Math.random() * 6 };
  }
  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible) { last = t; return; }
    var dt = Math.min(.05, (t - last) / 1000); last = t;
    drawGrid();
    if (cycles.length < (W < 700 ? 4 : 7) && Math.random() < .03) cycles.push(spawn());
    cycles = cycles.filter(function (c) {
      var d = c.sp * dt; c.x += c.dx * d; c.y += c.dy * d; c.life -= dt;
      var last = c.trail[c.trail.length - 1];
      if (!last) c.trail.push([c.x, c.y]);
      else {
        var gx = Math.round(c.x / cell) * cell, gy = Math.round(c.y / cell) * cell;
        if (c.dx && Math.abs(c.x - gx) < d && --c.turn <= 0) { c.x = gx; c.dy = Math.random() < .5 ? 1 : -1; c.dx = 0; c.turn = 2 + Math.floor(Math.random() * 6); c.trail.push([c.x, c.y]); }
        else if (c.dy && Math.abs(c.y - gy) < d && --c.turn <= 0) { c.y = gy; c.dx = Math.random() < .5 ? 1 : -1; c.dy = 0; c.turn = 2 + Math.floor(Math.random() * 6); c.trail.push([c.x, c.y]); }
      }
      if (c.trail.length > 14) c.trail.shift();
      var pts = c.trail.concat([[c.x, c.y]]);
      var g = ctx.createLinearGradient(pts[0][0], pts[0][1], c.x, c.y);
      var col = c.gold ? rgb : brgb;
      g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',.95)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgb(' + col + ')'; ctx.shadowBlur = 14; ctx.lineJoin = 'miter';
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.shadowBlur = 0;
      return c.life > 0 && c.x > -40 && c.x < W + 40 && c.y > -40 && c.y < H + 40;
    });
  }
  readRGB(); size();
  window.addEventListener('resize', function () { size(); });
  new MutationObserver(function () { readRGB(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe($('#hero'));
  if (!reduce) requestAnimationFrame(frame);
})();
