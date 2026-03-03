/**
 * EconMap — Kinh tế chính trị Mác-Lênin
 * Full-featured: Mind Map + Progress Tracking + Quiz System
 */
document.addEventListener('DOMContentLoaded', async function () {

  // ── DOM refs ──────────────────────────────────────────────────────
  var loader = document.getElementById('loader');
  var svgEl = document.getElementById('mindmap-svg');
  var canvasEl = document.getElementById('particle-canvas');
  var detailPanel = document.getElementById('detail-panel');
  var closePanelBtn = document.getElementById('close-panel');
  var breadcrumbEl = document.getElementById('breadcrumb');
  var progFill = document.getElementById('prog-fill');
  var learnedCount = document.getElementById('learned-count');
  var totalCount = document.getElementById('total-count');
  var branchList = document.getElementById('branch-list');

  // ── D3 setup ──────────────────────────────────────────────────────
  var svg = d3.select(svgEl);
  var g = svg.append('g').attr('class', 'main-group');

  // ── Particle system ───────────────────────────────────────────────
  var ctx = canvasEl.getContext('2d');

  function resizeCanvas() {
    var rect = canvasEl.parentElement.getBoundingClientRect();
    canvasEl.width = rect.width;
    canvasEl.height = rect.height;
  }
  resizeCanvas();

  var particles = [], animFrameId = null;
  window.addEventListener('resize', resizeCanvas);

  function tickParticles() {
    if (!particles.length) { animFrameId = null; return; }
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      p.life -= p.decay; p.radius *= 0.97;
      if (p.life <= 0 || p.radius < 0.3) { particles.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = p.life;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      if (p.glow) { ctx.shadowBlur = p.radius * 3; ctx.shadowColor = p.color; }
      ctx.fillStyle = p.color; ctx.fill(); ctx.restore();
    }
    animFrameId = requestAnimationFrame(tickParticles);
  }

  function spawnParticles(sx, sy, color, count) {
    count = count || 60;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4.5;
      particles.push({
        x: sx, y: sy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, gravity: 0.08,
        life: 0.75 + Math.random() * 0.25, decay: 0.012 + Math.random() * 0.014,
        radius: 2 + Math.random() * 4.5, color: color, glow: Math.random() > 0.4
      });
    }
    for (var j = 0; j < 25; j++) {
      var a2 = Math.random() * Math.PI * 2, s2 = 3 + Math.random() * 7;
      particles.push({
        x: sx, y: sy, vx: Math.cos(a2) * s2, vy: Math.sin(a2) * s2, gravity: 0.06,
        life: 0.5 + Math.random() * 0.4, decay: 0.02 + Math.random() * 0.02,
        radius: 1 + Math.random() * 2, color: '#ffffff', glow: true
      });
    }
    if (!animFrameId) animFrameId = requestAnimationFrame(tickParticles);
  }

  // ── SVG Defs ──────────────────────────────────────────────────────
  var defs = svg.append('defs');
  var ngf = defs.append('filter').attr('id', 'node-glow').attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%');
  ngf.append('feGaussianBlur').attr('stdDeviation', '8').attr('result', 'blur');
  ngf.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', function (d) { return d; });
  var sgf = defs.append('filter').attr('id', 'strong-glow').attr('x', '-200%').attr('y', '-200%').attr('width', '500%').attr('height', '500%');
  sgf.append('feGaussianBlur').attr('stdDeviation', '15').attr('result', 'blur');
  sgf.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', function (d) { return d; });
  var shockwaveLayer = g.append('g').attr('class', 'shockwave-layer');

  // ── Progress tracking ─────────────────────────────────────────────
  var studiedNodes = new Set();
  var nodeTimers = {};   // nodeId → timeout id
  var allNodeCount = 0; // Will be calculated from data

  function markStudied(nodeId) {
    if (studiedNodes.has(nodeId)) return;
    studiedNodes.add(nodeId);
    var n = studiedNodes.size;
    learnedCount.textContent = n;
    var pct = (n / allNodeCount) * 100;
    progFill.style.width = pct + '%';
    // Glow studied ring on node
    g.selectAll('.node').each(function (d) {
      if (d.data.id === nodeId) {
        d3.select(this).select('.studied-ring').style('opacity', 1);
      }
    });
  }

  function startStudyTimer(nodeId) {
    if (studiedNodes.has(nodeId)) return;
    if (nodeTimers[nodeId]) return;
    nodeTimers[nodeId] = setTimeout(function () {
      markStudied(nodeId);
      delete nodeTimers[nodeId];
      // Quick pulse effect
      g.selectAll('.node').each(function (d) {
        if (d.data.id === nodeId) {
          var c = d3.select(this).select('circle');
          gsap.to(c.node(), {
            attr: { r: nodeRadius(d.data) * 1.4 }, duration: 0.25, ease: 'power2.out',
            onComplete: function () { gsap.to(c.node(), { attr: { r: nodeRadius(d.data) }, duration: 0.4, ease: 'elastic.out(1,0.4)' }); }
          });
        }
      });
    }, 15000);
  }

  function stopStudyTimer(nodeId) {
    if (nodeTimers[nodeId]) { clearTimeout(nodeTimers[nodeId]); delete nodeTimers[nodeId]; }
  }

  // ── Zoom ──────────────────────────────────────────────────────────
  var currentTransform = d3.zoomIdentity;
  var focusedNode = null;
  var showAllNodes = false;
  var zoom = d3.zoom().scaleExtent([0.01, 3]).on('zoom', function (event) {
    currentTransform = event.transform;
    g.attr('transform', event.transform);
  });
  svg.call(zoom);

  // ── Load data ─────────────────────────────────────────────────────
  var mapData, quizData;
  try {
    mapData = await d3.json('mindmap.json');
    quizData = await d3.json('quiz.json');

    // Calculate total nodes (concepts) excluding root
    allNodeCount = d3.hierarchy(mapData).descendants().length - 1;
    totalCount.textContent = allNodeCount;

    buildMap(mapData);
    buildSidebar(mapData);
    gsap.to(loader, { opacity: 0, duration: 0.5, onComplete: function () { loader.style.display = 'none'; } });
  } catch (err) {
    console.error('Load error:', err);
    loader.innerHTML = '<p style="color:#ef5350">Lỗi tải dữ liệu. Vui lòng tải lại trang.</p>';
  }

  // ── Build sidebar ─────────────────────────────────────────────────
  function buildSidebar(data) {
    var iconMap = {
      '⚡': 'bi-lightning-fill',
      '🔮': 'bi-magic',
      '⚛️': 'bi-globe2',
      '🔄': 'bi-arrow-repeat',
      '🏛️': 'bi-bank2',
      '🌟': 'bi-star-fill',
      '📌': 'bi-pin-angle-fill'
    };
    data.children.forEach(function (branch) {
      var btn = document.createElement('button');
      btn.className = 'branch-btn';
      var col = branch.color || '#5c6bc0';
      var iconClass = iconMap[branch.icon] || 'bi-bookmarks-fill';
      btn.innerHTML = '<div class="branch-icon" style="background:' + col + '22; color: ' + col + '"><i class="bi ' + iconClass + '" style="filter:drop-shadow(0 0 6px ' + col + ')"></i></div>'
        + '<span class="branch-name">' + branch.name.replace('\n', ' ') + '</span>';
      btn.style.setProperty('--branch-color', col);
      btn.addEventListener('click', function () {
        zoomToBranchByData(branch);
      });
      branchList.appendChild(btn);
    });
  }

  // ── Build mind map ────────────────────────────────────────────────
  var lastRoot = null;

  function buildMap(data) {
    g.selectAll('.link, .node').remove();
    var root = d3.hierarchy(data);
    var treeLayout = d3.tree().size([360, 1]).separation(function (a, b) {
      return (a.parent === b.parent ? 5 : 7) / (a.depth || 1);
    });
    treeLayout(root);

    root.descendants().forEach(function (d) {
      var angle = (d.x - 90) * Math.PI / 180;
      var radius = d.depth === 1 ? 520 : d.depth === 2 ? 1150 : d.depth === 3 ? 1800 : 0;
      d.radius = radius;
      d.x_cart = radius * Math.cos(angle);
      d.y_cart = radius * Math.sin(angle);
      if (d.depth === 0) { d.x_cart = 0; d.y_cart = 0; }
    });

    // Links
    g.selectAll('.link').data(root.links()).enter().append('path').attr('class', 'link')
      .attr('d', d3.linkRadial().angle(function (d) { return d.x * Math.PI / 180; }).radius(function (d) { return d.radius; }))
      .style('stroke', function (d) { return colorOf(d.target); })
      .style('stroke-width', function (d) { return d.target.depth === 1 ? '6px' : '3px'; });

    // Nodes
    var nodes = g.selectAll('.node').data(root.descendants()).enter()
      .append('g').attr('class', function (d) { return 'node level-' + d.data.level; })
      .attr('transform', function (d) { return 'translate(' + d.x_cart + ',' + d.y_cart + ')'; })
      .on('click', function (event, d) { event.stopPropagation(); onNodeClick(event, d); })
      .on('mouseenter', function (event, d) {
        if (d.depth === 0) return;
        var r = nodeRadius(d.data);
        var el = d3.select(this).select('circle');
        gsap.to(el.node(), { attr: { r: r * 1.3 }, duration: 0.2, ease: 'back.out(2)' });
      })
      .on('mouseleave', function (event, d) {
        if (d.depth === 0) return;
        var r = nodeRadius(d.data);
        var el = d3.select(this).select('circle');
        gsap.to(el.node(), { attr: { r: r }, duration: 0.3, ease: 'elastic.out(1,0.5)' });
      });

    // Studied ring (subtle outer glow ring)
    nodes.filter(function (d) { return d.depth > 0; }).append('circle')
      .attr('class', 'studied-ring')
      .attr('r', function (d) { return nodeRadius(d.data) + 8; })
      .style('fill', 'none')
      .style('stroke', function (d) { return colorOf(d); })
      .style('stroke-width', '2.5')
      .style('stroke-dasharray', '6 3')
      .style('opacity', function (d) { return studiedNodes.has(d.data.id) ? 1 : 0; })
      .style('pointer-events', 'none');

    // Circles
    nodes.append('circle').attr('class', 'node-circle')
      .attr('r', function (d) { return nodeRadius(d.data); })
      .style('fill', function (d) { return d.data.level === 0 ? 'transparent' : 'var(--bg)'; })
      .style('stroke', function (d) { return d.depth === 0 ? 'none' : colorOf(d); })
      .style('stroke-width', function (d) { return d.depth === 0 ? '0' : d.depth === 1 ? '6px' : '4px'; });

    // Center node: image (macimg.png) above + text below
    nodes.filter(function (d) { return d.depth === 0; })
      .append('image')
      .attr('href', 'macimg.png')
      .attr('width', 120).attr('height', 120)
      .attr('x', -60).attr('y', -160)
      .style('pointer-events', 'none');

    nodes.filter(function (d) { return d.depth === 0; }).append('text')
      .attr('text-anchor', 'middle').style('font-size', '52px').style('font-weight', '800')
      .style('fill', 'white').style('font-family', "'Be Vietnam Pro', sans-serif")
      .each(function (d) {
        var el = d3.select(this);
        var lines = (d.data.name || '').split('\n');
        lines.forEach(function (line, i) {
          el.append('tspan').attr('x', 0).attr('dy', i === 0 ? '15px' : '1.3em').text(line);
        });
      });

    // Icons
    nodes.filter(function (d) { return d.depth > 0 && !!d.data.icon; }).append('text')
      .attr('text-anchor', 'middle').attr('dy', '.35em')
      .style('font-size', function (d) { return d.depth === 1 ? '36px' : '24px'; })
      .style('fill', function (d) { return colorOf(d); })
      .text(function (d) { return d.data.icon; });

    // Labels
    nodes.filter(function (d) { return d.depth > 0; }).append('text').attr('class', 'node-text')
      .attr('x', function (d) { return d.x < 180 ? nodeRadius(d.data) + 14 : -(nodeRadius(d.data) + 14); })
      .style('text-anchor', function (d) { return d.x < 180 ? 'start' : 'end'; })
      .style('font-size', function (d) { return d.depth === 1 ? '40px' : d.depth === 2 ? '30px' : '24px'; })
      .style('font-weight', function (d) { return d.depth <= 1 ? '700' : '600'; })
      .each(function (d) {
        var el = d3.select(this);
        var lines = (d.data.name || '').split('\n');
        var xOff = d.x < 180 ? nodeRadius(d.data) + 14 : -(nodeRadius(d.data) + 14);
        lines.forEach(function (line, i) {
          el.append('tspan').attr('x', xOff).attr('dy', i === 0 ? '0.35em' : '1.2em').text(line);
        });
      });

    // Entrance animation
    gsap.set(g.selectAll('.node').nodes(), { opacity: 0, scale: 0, svgOrigin: '0 0' });
    gsap.to(g.selectAll('.node').nodes(), {
      opacity: function (i, el) {
        var d = d3.select(el).datum();
        if (showAllNodes) return 1;
        return d.depth <= 1 ? 1 : 0.07;
      },
      scale: 1, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.02, delay: 0.35
    });
    gsap.to(g.selectAll('.link').nodes(), {
      opacity: function (i, el) {
        var d = d3.select(el).datum();
        if (showAllNodes) return 0.9;
        return d.target.depth <= 1 ? 0.9 : 0.04;
      },
      duration: 0.8, stagger: 0.012, delay: 0.2
    });

    initialView(root);
    lastRoot = root;
  }

  // ── Sidebar: zoom to branch ───────────────────────────────────────
  function zoomToBranchByData(branchData) {
    g.selectAll('.node').each(function (d) {
      if (d.data === branchData) zoomToBranch(d);
    });
  }

  // ── Click handler ─────────────────────────────────────────────────
  var currentNodeId = null;

  function onNodeClick(event, d) {
    // Use the mouse event's position directly — this is always exactly where the user clicked
    // relative to the canvas element (which fills #mindmap-container)
    var containerRect = canvasEl.parentElement.getBoundingClientRect();
    var sx = event.clientX - containerRect.left;
    var sy = event.clientY - containerRect.top;
    var color = colorOf(d) || '#5c6bc0';
    var cnt = d.depth === 0 ? 100 : d.depth === 1 ? 75 : 50;

    spawnParticles(sx, sy, color, cnt);
    emitRings(d.x_cart, d.y_cart, color, d.depth, d.data);
    bloomNode(event.currentTarget, d, color);
    highlightLinks(d, color);

    if (d.depth === 0) {
      resetBranchFocus(); return;
    } else if (d.depth === 1) {
      zoomToBranch(d);
    } else {
      zoomToNode(d);
    }

    showDetails(d.data);

    // Study timer: start when node is viewed
    if (d.data.id) {
      if (currentNodeId && currentNodeId !== d.data.id) stopStudyTimer(currentNodeId);
      currentNodeId = d.data.id;
      startStudyTimer(d.data.id);
    }

    // Update sidebar highlight
    updateSidebarActive(d);
  }

  function updateSidebarActive(d) {
    document.querySelectorAll('.branch-btn').forEach(function (b) { b.classList.remove('active'); });
    var ancestor = d;
    while (ancestor && ancestor.depth > 1) ancestor = ancestor.parent;
    if (ancestor && ancestor.depth === 1) {
      var idx = ancestor.parent ? ancestor.parent.children.indexOf(ancestor) : -1;
      var btns = document.querySelectorAll('.branch-btn');
      if (idx >= 0 && btns[idx]) btns[idx].classList.add('active');
    }
  }

  // ── Zoom helpers ──────────────────────────────────────────────────
  function zoomToBranch(d) {
    focusedNode = d;
    var vw = svgEl.parentElement.clientWidth, vh = svgEl.parentElement.clientHeight;
    var allDesc = d.descendants();
    var xs = allDesc.map(function (n) { return n.x_cart; }).concat([d.x_cart, 0]);
    var ys = allDesc.map(function (n) { return n.y_cart; }).concat([d.y_cart, 0]);
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var bw = maxX - minX + 400, bh = maxY - minY + 400;
    var midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    var panelW = 370, usableW = vw - panelW - 60;
    var scale = Math.min(Math.min(usableW / bw, vh / bh) * 0.88, 2.5);
    scale = Math.max(scale, 0.05);
    var tx = usableW / 2 - scale * midX, ty = vh / 2 - scale * midY;
    svg.transition().duration(900).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    dimSiblings(d); showBreadcrumb(d);
  }

  function zoomToNode(d) {
    focusedNode = d;
    var vw = svgEl.parentElement.clientWidth, vh = svgEl.parentElement.clientHeight;
    var panelW = 370, usableW = vw - panelW - 60;
    var scale = Math.min(currentTransform.k * 1.5, 2.2);
    var tx = usableW / 2 - scale * d.x_cart, ty = vh / 2 - scale * d.y_cart;
    svg.transition().duration(600).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    dimSiblings(d);
  }

  function dimSiblings(focusD) {
    var activeSet = new Set();
    // 1. All descendants of the focused node stay active
    focusD.descendants().forEach(function (n) { activeSet.add(n.data.id || n.data.name); });
    // 2. All ancestors of the focused node stay active
    var curr = focusD;
    while (curr) {
      activeSet.add(curr.data.id || curr.data.name);
      curr = curr.parent;
    }

    g.selectAll('.node').each(function (nd) {
      if (showAllNodes) {
        gsap.to(this, { opacity: 1, duration: 0.45 });
        return;
      }
      var isActive = activeSet.has(nd.data.id || nd.data.name) || nd.depth === 0;
      gsap.to(this, { opacity: isActive ? 1 : 0.07, duration: 0.45 });
    });
    g.selectAll('.link').each(function (ld) {
      if (showAllNodes) {
        gsap.to(this, { opacity: 0.9, duration: 0.45 });
        return;
      }
      var sActive = activeSet.has(ld.source.data.id || ld.source.data.name);
      var tActive = activeSet.has(ld.target.data.id || ld.target.data.name);
      gsap.to(this, { opacity: (sActive && tActive) ? 0.9 : 0.04, duration: 0.45 });
    });
  }

  function dimBranches() {
    g.selectAll('.node').each(function (nd) {
      if (showAllNodes) {
        gsap.to(this, { opacity: 1, duration: 0.45 });
        return;
      }
      var isActive = nd.depth <= 1;
      gsap.to(this, { opacity: isActive ? 1 : 0.07, duration: 0.45 });
    });
    g.selectAll('.link').each(function (ld) {
      if (showAllNodes) {
        gsap.to(this, { opacity: 0.9, duration: 0.45 });
        return;
      }
      var isActive = ld.target.depth <= 1;
      gsap.to(this, { opacity: isActive ? 0.9 : 0.04, duration: 0.45 });
    });
  }

  function resetBranchFocus() {
    focusedNode = null; dimBranches(); hideBreadcrumb(); initialView(lastRoot);
    document.querySelectorAll('.branch-btn').forEach(function (b) { b.classList.remove('active'); });
  }

  // ── Breadcrumb ────────────────────────────────────────────────────
  function showBreadcrumb(d) {
    var color = colorOf(d) || '#5c6bc0';
    breadcrumbEl.querySelector('.bc-name').textContent = (d.data.name || '').replace('\n', ' ');
    breadcrumbEl.querySelector('.bc-dot').style.background = color;
    breadcrumbEl.classList.remove('bc-hidden');
    gsap.fromTo(breadcrumbEl, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' });
  }
  function hideBreadcrumb() {
    gsap.to(breadcrumbEl, { y: -40, opacity: 0, duration: 0.3, onComplete: function () { breadcrumbEl.classList.add('bc-hidden'); } });
  }
  breadcrumbEl.addEventListener('click', resetBranchFocus);
  svg.on('click', function (event) {
    if ((event.target === svgEl || event.target.tagName.toLowerCase() === 'svg') && focusedNode) {
      resetBranchFocus();
    }
  });

  // ── Effects ───────────────────────────────────────────────────────
  function emitRings(cx, cy, color, depth, data) {
    var count = depth === 0 ? 4 : depth === 1 ? 3 : 2;
    var baseR = nodeRadius(data), rangeFactor = depth === 0 ? 280 : depth === 1 ? 180 : 110;
    for (var i = 0; i < count; i++) {
      (function (idx) {
        var ring = shockwaveLayer.append('circle').attr('cx', cx).attr('cy', cy).attr('r', baseR)
          .style('fill', 'none').style('stroke', color).style('stroke-width', depth <= 1 ? 5 : 3)
          .style('opacity', 0.9).style('pointer-events', 'none');
        gsap.to(ring.node(), {
          attr: { r: 70 + rangeFactor + idx * 50 }, opacity: 0, strokeWidth: 1,
          duration: 0.8 + idx * 0.18, delay: idx * 0.1, ease: 'power2.out', onComplete: function () { ring.remove(); }
        });
      })(i);
    }
    var flash = shockwaveLayer.append('circle').attr('cx', cx).attr('cy', cy).attr('r', baseR * 2)
      .style('fill', color).style('opacity', 0.35).style('pointer-events', 'none');
    gsap.to(flash.node(), { attr: { r: baseR * 0.3 }, opacity: 0, duration: 0.28, ease: 'expo.out', onComplete: function () { flash.remove(); } });
  }

  function bloomNode(nodeEl, d, color) {
    var circle = d3.select(nodeEl).select('circle');
    var r = nodeRadius(d.data);
    circle.style('filter', 'url(#strong-glow)');
    gsap.timeline({ onComplete: function () { circle.style('filter', null); } })
      .to(circle.node(), { attr: { r: r * 0.65 }, duration: 0.08, ease: 'power3.in' })
      .to(circle.node(), { attr: { r: r * 1.8 }, stroke: '#ffffff', duration: 0.2, ease: 'expo.out' })
      .to(circle.node(), { attr: { r: r }, stroke: color, duration: 0.45, ease: 'elastic.out(1,0.4)' });
  }

  function highlightLinks(d, color) {
    var desc = d.descendants ? d.descendants() : [d];
    var names = new Set(desc.map(function (n) { return n.data.name; }));
    g.selectAll('.link').each(function (ld) {
      var isDesc = names.has(ld.target.data.name) && names.has(ld.source.data.name);
      var isIncoming = ld.target.data.name === d.data.name;
      if (!isDesc && !isIncoming) return;
      var baseW = ld.target.depth === 1 ? 6 : 3;
      gsap.killTweensOf(this);
      gsap.timeline().to(this, { attr: { 'stroke-width': baseW * 2.5 }, duration: 0.08, ease: 'power3.out' })
        .to(this, { attr: { 'stroke-width': baseW }, duration: 0.5, ease: 'elastic.out(1,0.5)' });
    });
  }

  // ── Detail panel ──────────────────────────────────────────────────
  function showDetails(data) {
    document.getElementById('topic-title').textContent = (data.name || '').replace('\n', ' ');
    document.getElementById('topic-description').textContent = data.description || '';
    document.getElementById('topic-example').textContent = data.vietnam_example || '';
    document.getElementById('topic-icon').textContent = data.icon || '📌';
    document.getElementById('topic-badge').textContent = 'Cấp ' + (data.level === 0 ? 'Gốc' : data.level);
    var color = data.color || '#5c6bc0';
    document.getElementById('topic-badge').style.background = color + '22';
    document.getElementById('topic-badge').style.color = color;
    document.querySelector('.vn-box').style.borderColor = color;
    detailPanel.classList.add('open');
    gsap.fromTo(detailPanel, { x: '100%' }, { x: '0%', duration: 0.5, ease: 'expo.out' });
  }

  closePanelBtn.addEventListener('click', function () {
    if (currentNodeId) stopStudyTimer(currentNodeId);
    gsap.to(detailPanel, { x: '100%', duration: 0.4, ease: 'power2.in', onComplete: function () { detailPanel.classList.remove('open'); } });
  });

  // ── View helpers ──────────────────────────────────────────────────
  function initialView(root) {
    if (root) lastRoot = root;
    var parent = svgEl.parentElement;
    // Better default zoom to match "Ảnh 2": level 1 branches at ~520px radius
    var scale = (Math.min(parent.clientWidth, parent.clientHeight) * 0.92) / (520 * 2 + 400);
    svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity.translate(parent.clientWidth / 2, parent.clientHeight / 2).scale(scale));
  }

  function resetView() {
    var b = g.node().getBBox(), parent = svgEl.parentElement;
    var scale = 0.8 / Math.max(b.width / parent.clientWidth, b.height / parent.clientHeight || 1);
    var midX = b.x + b.width / 2, midY = b.y + b.height / 2;
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(parent.clientWidth / 2 - scale * midX, parent.clientHeight / 2 - scale * midY).scale(scale));
  }

  // ── Utility ───────────────────────────────────────────────────────
  function colorOf(d) {
    if (!d || !d.data) return '#fff';
    if (d.data.level === 0) return '#fff';
    if (d.data.color) return d.data.color;
    var p = d.parent;
    while (p) { if (p.data.color) return p.data.color; p = p.parent; }
    return '#fff';
  }

  function nodeRadius(d) {
    var level = d && d.level !== undefined ? d.level : (d && d.data ? d.data.level : 3);
    switch (level) { case 0: return 85; case 1: return 42; case 2: return 22; default: return 16; }
  }

  // ── Controls ──────────────────────────────────────────────────────
  document.getElementById('zoom-in').addEventListener('click', function () { svg.transition().call(zoom.scaleBy, 1.5); });
  document.getElementById('zoom-out').addEventListener('click', function () { svg.transition().call(zoom.scaleBy, 0.5); });
  document.getElementById('reset-view').addEventListener('click', resetView);

  document.getElementById('toggle-all').addEventListener('click', function () {
    showAllNodes = !showAllNodes;
    this.classList.toggle('active', showAllNodes);
    var icon = this.querySelector('i');
    if (showAllNodes) {
      icon.classList.remove('bi-eye');
      icon.classList.add('bi-eye-fill');
    } else {
      icon.classList.remove('bi-eye-fill');
      icon.classList.add('bi-eye');
    }

    if (!focusedNode) {
      dimBranches();
    } else {
      dimSiblings(focusedNode);
    }
  });

  // ── Search ────────────────────────────────────────────────────────
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');

  function getAllNodes(node, path) {
    var result = [];
    path = path || '';
    var myPath = path ? path + ' › ' + node.name.replace('\n', ' ') : node.name.replace('\n', ' ');
    if (node.level > 0) result.push({ data: node, path: myPath });
    (node.children || []).forEach(function (c) { result = result.concat(getAllNodes(c, myPath)); });
    return result;
  }

  searchInput.addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    if (!q || !mapData) { searchResults.classList.remove('visible'); return; }
    var all = getAllNodes(mapData);
    var matches = all.filter(function (n) { return n.data.name.toLowerCase().includes(q) || (n.data.description || '').toLowerCase().includes(q); }).slice(0, 6);
    if (!matches.length) { searchResults.classList.remove('visible'); return; }
    searchResults.innerHTML = matches.map(function (m) {
      return '<div class="sr-item" data-name="' + m.data.name.replace(/"/g, '') + '"><div class="sri-name">' + m.data.name.replace('\n', ' ') + '</div><div class="sri-path">' + m.path + '</div></div>';
    }).join('');
    searchResults.classList.add('visible');
    searchResults.querySelectorAll('.sr-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        g.selectAll('.node').each(function (d) {
          if ((d.data.name || '').replace('\n', ' ') === name) {
            onNodeClick({ stopPropagation: function () { }, currentTarget: this }, d);
          }
        });
        searchResults.classList.remove('visible');
        searchInput.value = '';
      });
    });
  });

  document.addEventListener('click', function (e) {
    // Close search results if clicked outside
    if (!e.target.closest('.search-box')) searchResults.classList.remove('visible');

    // Determine what was clicked to handle panel close and zoom out
    var isClickInsidePanel = e.target.closest('#detail-panel');
    var isClickOnNode = e.target.closest('.node');
    var isClickOnBranchBtn = e.target.closest('.branch-btn');
    var isClickSearchItem = e.target.closest('.sr-item');
    var isClickOnControls = e.target.closest('.controls');
    var isClickOnBreadcrumb = e.target.closest('#breadcrumb');
    var isClickOnTopBar = e.target.closest('#topbar');
    var isClickOnSidebar = e.target.closest('#sidebar');
    var isClickOnChatBtn = e.target.closest('#ai-chatbot-btn');
    var isClickOnChatWindow = e.target.closest('#ai-chat-window');

    var isClickOnAnyUIElement = isClickInsidePanel || isClickOnNode || isClickOnBranchBtn || isClickSearchItem || isClickOnControls || isClickOnBreadcrumb || isClickOnTopBar || isClickOnSidebar || isClickOnChatBtn || isClickOnChatWindow;

    // 1. Zoom out if clicking strictly on the background (not any UI element)
    if (!isClickOnAnyUIElement && focusedNode) {
      resetBranchFocus();
    }

    // 2. Hide detail panel if clicking outside panel & not opening a new node & not interacting with chat
    var isOpeningNode = isClickOnNode || isClickOnBranchBtn || isClickSearchItem;
    var isInteractingWithChat = isClickOnChatBtn || isClickOnChatWindow;

    if (!isClickInsidePanel && !isOpeningNode && !isInteractingWithChat) {
      if (detailPanel.classList.contains('open')) {
        if (currentNodeId) stopStudyTimer(currentNodeId);
        gsap.to(detailPanel, { x: '100%', duration: 0.4, ease: 'power2.in', onComplete: function () { detailPanel.classList.remove('open'); } });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // ══ QUIZ SYSTEM ══════════════════════════════════════════════════
  // ─────────────────────────────────────────────────────────────────
  var quizOverlay = document.getElementById('quiz-overlay');
  var quizStart = document.getElementById('quiz-start');
  var quizQScreen = document.getElementById('quiz-question-screen');
  var quizResultsDiv = document.getElementById('quiz-results');

  var currentQuiz = [];
  var currentQIdx = 0;
  var userAnswers = [];
  var timerInterval = null;
  var elapsed = 0;
  var bestScore = null;

  function openQuiz() {
    quizOverlay.classList.add('show');
    showQuizStart();
  }

  function closeQuiz() {
    quizOverlay.classList.remove('show');
    clearInterval(timerInterval);
  }

  function showQuizStart() {
    quizStart.style.display = 'block';
    quizQScreen.style.display = 'none';
    quizResultsDiv.style.display = 'none';
    var bsd = document.getElementById('best-score-display');
    bsd.textContent = bestScore !== null ? bestScore + '/20' : '—';
  }

  function startQuiz() {
    if (!quizData || !quizData.length) { alert('Không tải được ngân hàng câu hỏi.'); return; }
    // Shuffle & pick 20
    var shuffled = quizData.slice().sort(function () { return Math.random() - 0.5; });
    currentQuiz = shuffled.slice(0, 20);
    currentQIdx = 0;
    userAnswers = [];
    elapsed = 0;

    quizStart.style.display = 'none';
    quizQScreen.style.display = 'flex';
    quizResultsDiv.style.display = 'none';

    clearInterval(timerInterval);
    timerInterval = setInterval(function () {
      elapsed++;
      var tv = document.getElementById('timer-val');
      if (tv) tv.textContent = elapsed;
    }, 1000);

    renderQuestion();
  }

  function renderQuestion() {
    var q = currentQuiz[currentQIdx];
    var total = currentQuiz.length;
    document.getElementById('quiz-q-num').textContent = 'Câu ' + (currentQIdx + 1);
    document.getElementById('quiz-question').textContent = q.question;
    document.getElementById('quiz-progress-text').textContent = (currentQIdx + 1) + ' / ' + total;
    document.getElementById('quiz-prog-fill').style.width = (((currentQIdx) / total) * 100) + '%';
    document.getElementById('quiz-explain').style.display = 'none';
    document.getElementById('quiz-explain').textContent = '';

    var nextBtn = document.getElementById('quiz-next-btn');
    nextBtn.disabled = true;
    nextBtn.textContent = currentQIdx < total - 1 ? 'Tiếp theo →' : 'Xem kết quả 🎉';

    var optContainer = document.getElementById('quiz-options');
    optContainer.innerHTML = '';
    q.options.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = String.fromCharCode(65 + i) + '. ' + opt;
      btn.addEventListener('click', function () { selectAnswer(i); });
      optContainer.appendChild(btn);
    });
  }

  function selectAnswer(idx) {
    var q = currentQuiz[currentQIdx];
    var opts = document.querySelectorAll('.quiz-opt');
    opts.forEach(function (o) { o.disabled = true; });
    userAnswers[currentQIdx] = idx;

    var isCorrect = idx === q.answer;
    opts[idx].classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) opts[q.answer].classList.add('correct');

    // Show explanation
    var explEl = document.getElementById('quiz-explain');
    explEl.textContent = '💡 ' + (q.explain || '');
    explEl.style.display = 'block';

    document.getElementById('quiz-next-btn').disabled = false;
  }

  document.getElementById('quiz-next-btn').addEventListener('click', function () {
    if (userAnswers[currentQIdx] === undefined) return;
    currentQIdx++;
    if (currentQIdx < currentQuiz.length) {
      renderQuestion();
    } else {
      clearInterval(timerInterval);
      showResults();
    }
  });

  function showResults() {
    quizQScreen.style.display = 'none';
    quizResultsDiv.style.display = 'block';

    var correct = 0;
    userAnswers.forEach(function (ans, i) { if (ans === currentQuiz[i].answer) correct++; });
    var pct = Math.round((correct / currentQuiz.length) * 100);

    if (bestScore === null || correct > bestScore) bestScore = correct;

    var scoreClass = pct >= 80 ? 'score-green' : pct >= 50 ? 'score-orange' : 'score-red';
    var stars = pct >= 80 ? '⭐⭐⭐' : pct >= 60 ? '⭐⭐' : '⭐';
    var msg = pct >= 80 ? 'Xuất sắc! Bạn nắm vững kiến thức.' : pct >= 60 ? 'Khá tốt! Tiếp tục ôn luyện.' : 'Cần ôn tập thêm. Đừng nản!';

    var html = '<div style="padding-bottom:8px">'
      + '<div style="font-size:2.2rem;margin-bottom:8px">' + stars + '</div>'
      + '<h2>Kết quả thi</h2>'
      + '<div class="results-score ' + scoreClass + '">' + correct + '<span style="font-size:1.4rem;opacity:0.5">/' + currentQuiz.length + '</span></div>'
      + '<div class="results-meta">' + msg + ' | Thời gian: ' + elapsed + 's | Tỉ lệ đúng: ' + pct + '%</div>'
      + '</div>';

    html += '<div style="font-size:0.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Chi tiết câu trả lời</div>';

    currentQuiz.forEach(function (q, i) {
      var ua = userAnswers[i];
      var ok = ua === q.answer;
      html += '<div class="result-item ' + (ok ? 'correct' : 'wrong') + '">'
        + '<div class="ri-q">' + (i + 1) + '. ' + q.question + '</div>'
        + '<div class="ri-your" style="color:' + (ok ? 'var(--green)' : '#ef5350') + '">'
        + (ok ? '✅' : '❌') + ' Bạn chọn: ' + String.fromCharCode(65 + ua) + '. ' + q.options[ua]
        + '</div>';
      if (!ok) html += '<div class="ri-correct">✔ Đáp án đúng: ' + String.fromCharCode(65 + q.answer) + '. ' + q.options[q.answer] + '</div>';
      if (q.explain) html += '<div class="ri-explain">💡 ' + q.explain + '</div>';
      html += '</div>';
    });

    html += '<div class="results-actions">'
      + '<button id="retry-btn" onclick="document.getElementById(\'quiz-start-btn\').click()">🔄 Thi lại</button>'
      + '<button id="back-btn">← Quay lại</button>'
      + '</div>';

    quizResultsDiv.innerHTML = html;
    document.getElementById('back-btn').addEventListener('click', function () {
      closeQuiz();
    });
    var retryBtn = document.getElementById('retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', function () { startQuiz(); });
  }

  // Quiz triggers
  document.getElementById('quiz-open-btn').addEventListener('click', openQuiz);
  document.getElementById('quiz-start-btn').addEventListener('click', startQuiz);
  document.getElementById('quiz-cancel-btn').addEventListener('click', closeQuiz);
  document.getElementById('quiz-close-btn2').addEventListener('click', function () {
    clearInterval(timerInterval);
    showQuizStart();
  });

  // Close on backdrop
  quizOverlay.addEventListener('click', function (e) {
    if (e.target === quizOverlay) closeQuiz();
  });

  // ESC close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (quizOverlay.classList.contains('show')) closeQuiz();
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // ══ AI CHATBOT LOGIC ═════════════════════════════════════════════
  // ─────────────────────────────────────────────────────────────────
  const chatBtn = document.getElementById('ai-chatbot-btn');
  const chatWindow = document.getElementById('ai-chat-window');
  const closeChatBtn = document.getElementById('close-chat');
  const chatInput = document.getElementById('chat-input');
  const sendChatBtn = document.getElementById('send-chat');
  const chatMessages = document.getElementById('chat-messages');

  let chatHistory = [
    {
      role: 'system',
      content: 'Bạn là một trợ lý ảo am hiểu về môn học Triết học Mác-Lênin và Lịch sử. Bạn CHỈ được phép trả lời các câu hỏi liên quan đến Triết học và Lịch sử. Đối với bất kỳ câu hỏi nào ngoài hai lĩnh vực này, hãy lịch sự từ chối và giải thích rằng bạn tập trung hỗ trợ sinh viên học tập hai bộ môn này.'
    }
  ];

  chatBtn.addEventListener('click', () => {
    chatWindow.classList.toggle('chat-hidden');
  });

  closeChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('chat-hidden');
  });

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Add user message to UI
    appendMessage('user', text);
    chatInput.value = '';

    // Add to history
    chatHistory.push({ role: 'user', content: text });

    // Show typing...
    const typingId = 'typing-' + Date.now();
    appendMessage('system', '...', typingId);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory })
      });

      const data = await response.json();

      // Remove typing
      document.getElementById(typingId).remove();

      if (data.content) {
        appendMessage('system', data.content);
        chatHistory.push({ role: 'assistant', content: data.content });
      } else {
        appendMessage('system', 'Xin lỗi, có lỗi xảy ra. Bạn vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('Chat error:', error);
      document.getElementById(typingId).remove();
      appendMessage('system', 'Không thể kết nối với server. Hãy chắc chắn backend đã được chạy.');
    }
  }

  function appendMessage(role, text, id) {
    const msg = document.createElement('div');
    msg.className = 'message ' + role;
    if (id) msg.id = id;
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  sendChatBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

});
