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

  /* ---------- hero build carousel ---------- */
  (function () {
    var frame = $('#hframe'); if (!frame) return;
    var slides = $$('.hslide', frame), dots = $$('#hdots button', frame), name = $('#hname'), num = $('#hnum'), i = 0, timer = null, DUR = 5500;
    frame.style.setProperty('--dur', DUR + 'ms');
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); d.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      num.textContent = 'Build 0' + (i + 1); name.textContent = slides[i].dataset.title;
      restart();
    }
    function restart() {
      clearInterval(timer); frame.classList.remove('run'); void frame.offsetWidth;
      if (reduce || frame.classList.contains('paused')) return;
      frame.classList.add('run'); timer = setInterval(function () { show(i + 1); }, DUR);
    }
    function pause() { frame.classList.add('paused'); clearInterval(timer); }
    function resume() { frame.classList.remove('paused'); restart(); }
    $('#hnext', frame).addEventListener('click', function () { show(i + 1); });
    $('#hprev', frame).addEventListener('click', function () { show(i - 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); }); });
    frame.addEventListener('mouseenter', pause); frame.addEventListener('mouseleave', resume);
    frame.addEventListener('focusin', pause); frame.addEventListener('focusout', resume);
    frame.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
    var sx = 0;
    frame.addEventListener('touchstart', function (e) { sx = e.changedTouches[0].clientX; }, { passive: true });
    frame.addEventListener('touchend', function (e) { var d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 40) show(i + (d < 0 ? 1 : -1)); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else resume(); });
    restart();
  })();

  /* ---------- hero: calm light-cycle grid ---------- */
  var cv = $('#grid'); if (!cv) return;
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, cell = 64, cycles = [], gold = '255,199,38', blue = '35,87,224', line = '42,91,255';
  var gridLayer = document.createElement('canvas'), visible = true, last = 0, nextSpawn = 0, TRAIL = 340;
  function readColors() {
    var cs = getComputedStyle(document.documentElement), g = cs.getPropertyValue('--a-rgb').trim(), b = cs.getPropertyValue('--g-rgb').trim(), l = cs.getPropertyValue('--b-rgb').trim();
    if (g) gold = g; if (b) blue = b; if (l) line = l;
  }
  function buildGrid() {
    gridLayer.width = W * dpr; gridLayer.height = H * dpr;
    var g = gridLayer.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(' + line + ',.13)'; g.lineWidth = 1; g.beginPath();
    for (var x = 0; x <= W; x += cell) { g.moveTo(x + .5, 0); g.lineTo(x + .5, H); }
    for (var y = 0; y <= H; y += cell) { g.moveTo(0, y + .5); g.lineTo(W, y + .5); }
    g.stroke();
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    cell = W < 700 ? 48 : 64; buildGrid(); paint();
  }
  function paint() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(gridLayer, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function spawn() {
    var side = Math.floor(Math.random() * 4), cols = Math.floor(W / cell), rows = Math.floor(H / cell), x, y, dx = 0, dy = 0;
    if (side === 0) { x = -8; y = (1 + Math.floor(Math.random() * Math.max(1, rows - 1))) * cell; dx = 1; }
    else if (side === 1) { x = W + 8; y = (1 + Math.floor(Math.random() * Math.max(1, rows - 1))) * cell; dx = -1; }
    else if (side === 2) { y = -8; x = (1 + Math.floor(Math.random() * Math.max(1, cols - 1))) * cell; dy = 1; }
    else { y = H + 8; x = (1 + Math.floor(Math.random() * Math.max(1, cols - 1))) * cell; dy = -1; }
    return { x: x, y: y, dx: dx, dy: dy, speed: 55 + Math.random() * 30, col: Math.random() < .28 ? gold : blue, pts: [[x, y]], age: 0 };
  }
  function step(c, dt) {
    var d = c.speed * dt, horiz = c.dx !== 0, dir = horiz ? c.dx : c.dy, p = horiz ? c.x : c.y, np = p + dir * d;
    var a = Math.floor(p / cell), b = Math.floor(np / cell);
    if (a !== b && p > 0 && np > 0) {
      var L = (dir > 0 ? b : a) * cell;
      if (horiz) c.x = L; else c.y = L;
      var onScreen = c.x > cell && c.x < W - cell && c.y > cell && c.y < H - cell;
      if (onScreen && Math.random() < .22) {
        c.pts.push([c.x, c.y]);
        var nd = Math.random() < .5 ? 1 : -1;
        if (horiz) { c.dx = 0; c.dy = nd; } else { c.dy = 0; c.dx = nd; }
        return;
      }
    }
    c.x += c.dx * d; c.y += c.dy * d;
  }
  function drawCycle(c) {
    var pts = c.pts.concat([[c.x, c.y]]), dist = 0, fade = Math.min(1, c.age / 1.6), col = c.col;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = pts.length - 1; i > 0 && dist < TRAIL; i--) {
      var x1 = pts[i][0], y1 = pts[i][1], x0 = pts[i - 1][0], y0 = pts[i - 1][1], len = Math.hypot(x1 - x0, y1 - y0);
      var use = Math.min(len, TRAIL - dist), tx = x1 + (x0 - x1) * (use / (len || 1)), ty = y1 + (y0 - y1) * (use / (len || 1));
      var g = ctx.createLinearGradient(x1, y1, tx, ty), a1 = (1 - dist / TRAIL) * fade, a2 = (1 - (dist + use) / TRAIL) * fade;
      g.addColorStop(0, 'rgba(' + col + ',' + a1 * .95 + ')'); g.addColorStop(1, 'rgba(' + col + ',' + Math.max(0, a2) * .95 + ')');
      ctx.strokeStyle = 'rgba(' + col + ',' + a1 * .12 + ')'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(tx, ty); ctx.stroke(); /* soft halo */
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(tx, ty); ctx.stroke();
      dist += use;
    }
    ctx.fillStyle = 'rgba(' + col + ',' + (.95 * fade) + ')'; ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
  }
  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible) { last = t; return; }
    var dt = Math.min(.04, (t - last) / 1000); last = t;
    paint();
    var max = W < 700 ? 2 : 4;
    if (cycles.length < max && t > nextSpawn) { cycles.push(spawn()); nextSpawn = t + 2200 + Math.random() * 2500; }
    cycles = cycles.filter(function (c) {
      c.age += dt; step(c, dt);
      var out = c.x < -TRAIL - 60 || c.x > W + TRAIL + 60 || c.y < -TRAIL - 60 || c.y > H + TRAIL + 60;
      if (!out) drawCycle(c);
      return !out;
    });
  }
  readColors(); size();
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 150); });
  new MutationObserver(function () { readColors(); buildGrid(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe($('#hero'));
  if (!reduce) requestAnimationFrame(frame);
})();
