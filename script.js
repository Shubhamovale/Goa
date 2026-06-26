/* ===================================================================
   GOA LOGBOOK — script.js
   Handles: road path generation + scooter movement, scroll reveals,
   nav progress, day-rail highlighting, animated counters,
   packing checklist, Leaflet map.
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------
     1. BUILD THE ROAD PATH
     The road needs to span from the hero through to the end of Day 5.
     We generate a smooth curving path procedurally so it always
     matches the actual page height, then move a vehicle along it
     using getPointAtLength() as the user scrolls.
  ---------------------------------------------------------------- */
  const roadSvg = document.getElementById('roadSvg');
  const roadPath = document.getElementById('roadPath');
  const roadDash = document.getElementById('roadDash');
  const vehicle = document.getElementById('roadVehicle');
  const daySections = Array.from(document.querySelectorAll('.day-section'));

  function buildRoadD(totalHeight) {
    const points = [];
    const segments = Math.ceil(totalHeight / 800);
    let x = 500;
    points.push([x, 0]);
    for (let i = 1; i <= segments; i++) {
      const y = (totalHeight / segments) * i;
      x = 500 + (i % 2 === 0 ? 1 : -1) * (180 + (i % 3) * 40);
      x = Math.max(260, Math.min(740, x));
      points.push([x, y]);
    }
    let d = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [px, py] = points[i - 1];
      const [cx, cy] = points[i];
      const midY = (py + cy) / 2;
      d += ` C ${px},${midY} ${cx},${midY} ${cx},${cy}`;
    }
    return d;
  }

  function setupRoad() {
    if (window.innerWidth <= 760) return;
    const totalHeight = document.body.scrollHeight;
    roadSvg.setAttribute('viewBox', `0 0 1000 ${totalHeight}`);
    roadSvg.style.height = totalHeight + 'px';
    const d = buildRoadD(totalHeight);
    roadPath.setAttribute('d', d);
    roadDash.setAttribute('d', d);
  }

  let roadLength = 0;
  function cacheRoadLength() {
    try { roadLength = roadPath.getTotalLength(); } catch (e) { roadLength = 0; }
  }

  function moveVehicleAlongRoad() {
    if (window.innerWidth <= 760 || !roadLength) return;
    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const progress = Math.min(1, Math.max(0, scrollTop / docHeight));
    const distance = progress * roadLength;
    const point = roadPath.getPointAtLength(distance);
    const lookAhead = roadPath.getPointAtLength(Math.min(roadLength, distance + 4));
    const angle = Math.atan2(lookAhead.y - point.y, lookAhead.x - point.x) * (180 / Math.PI);

    const scaleX = roadSvg.clientWidth / 1000;
    const pxX = point.x * scaleX;
    const pxY = point.y;

    vehicle.style.transform = `translate(${pxX - 14}px, ${pxY - 14}px) rotate(${angle + 90}deg)`;
  }

  /* ----------------------------------------------------------------
     2. SCROLL REVEAL (Intersection Observer)
  ---------------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  revealEls.forEach((el) => revealObserver.observe(el));

  /* ----------------------------------------------------------------
     3. ANIMATED COUNTERS (budget numbers)
  ---------------------------------------------------------------- */
  const counters = document.querySelectorAll('[data-count]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach((el) => counterObserver.observe(el));

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'), 10);
    if (reducedMotion) {
      el.textContent = '₹' + target.toLocaleString('en-IN');
      return;
    }
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(eased * target);
      el.textContent = '₹' + value.toLocaleString('en-IN');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------------
     4. NAV PROGRESS BAR + MILE LABEL
  ---------------------------------------------------------------- */
  const navProgressFill = document.getElementById('navProgressFill');
  const navProgressLabel = document.getElementById('navProgressLabel');

  function updateNavProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    navProgressFill.style.width = (progress * 100) + '%';
    navProgressLabel.textContent = 'Mile ' + Math.round(progress * 5);
  }

  /* ----------------------------------------------------------------
     5. DAY RAIL ACTIVE STATE
  ---------------------------------------------------------------- */
  const railStops = document.querySelectorAll('.day-rail-stop');
  const dayObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const day = entry.target.getAttribute('data-day');
      const stop = document.querySelector(`.day-rail-stop[data-day="${day}"]`);
      if (!stop) return;
      if (entry.isIntersecting) {
        railStops.forEach((s) => s.classList.remove('active'));
        stop.classList.add('active');
      }
    });
  }, { threshold: 0.5 });

  daySections.forEach((sec) => dayObserver.observe(sec));

  /* ----------------------------------------------------------------
     6. PACKING CHECKLIST PROGRESS
  ---------------------------------------------------------------- */
  const checkboxes = document.querySelectorAll('#packingList input[type="checkbox"]');
  const checklistFill = document.getElementById('checklistFill');
  const checklistCount = document.getElementById('checklistCount');

  function updateChecklist() {
    const total = checkboxes.length;
    const checked = Array.from(checkboxes).filter((cb) => cb.checked).length;
    checklistFill.style.width = (total ? (checked / total) * 100 : 0) + '%';
    checklistCount.textContent = `${checked} / ${total} packed`;
  }

  checkboxes.forEach((cb) => cb.addEventListener('change', updateChecklist));
  updateChecklist();

  /* ----------------------------------------------------------------
     7. HERO PARALLAX (subtle, on scroll)
  ---------------------------------------------------------------- */
  const heroImg = document.getElementById('heroImg');
  function updateHeroParallax() {
    if (reducedMotion) return;
    const scrollTop = window.scrollY;
    if (scrollTop < window.innerHeight) {
      heroImg.style.transform = `scale(1.08) translateY(${scrollTop * 0.25}px)`;
    }
  }

  /* ----------------------------------------------------------------
     8. SCROLL LOOP (throttled via rAF)
  ---------------------------------------------------------------- */
  let scrollTicking = false;
  function onScroll() {
    if (!scrollTicking) {
      requestAnimationFrame(() => {
        updateNavProgress();
        moveVehicleAlongRoad();
        updateHeroParallax();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  function onResize() {
    setupRoad();
    cacheRoadLength();
    moveVehicleAlongRoad();
  }
  window.addEventListener('resize', onResize);

  setupRoad();
  cacheRoadLength();
  updateNavProgress();
  moveVehicleAlongRoad();

  /* ----------------------------------------------------------------
     9. LEAFLET MAP
  ---------------------------------------------------------------- */
  const mapEl = document.getElementById('goaMap');
  if (mapEl && window.L) {
    const map = L.map('goaMap', { scrollWheelZoom: false }).setView([15.32, 73.97], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const stops = [
      { name: 'Parra Road', lat: 15.5736, lng: 73.7898, desc: 'North Goa scooter run, day one.', time: 'Morning, Day 1' },
      { name: 'Immaculate Conception Church', lat: 15.5057, lng: 73.8278, desc: 'Whitewashed hilltop church in Panaji.', time: 'Afternoon, Day 1' },
      { name: 'Thalassa', lat: 15.5963, lng: 73.7432, desc: 'Sunset dinner spot on the cliffs of Vagator.', time: 'Evening, Day 1' },
      { name: 'Cruise Point (Panaji Jetty)', lat: 15.4989, lng: 73.8278, desc: 'Night cruise departure point on the Mandovi.', time: 'Night, Day 1' },
      { name: 'Dudhsagar Falls', lat: 15.3144, lng: 74.3144, desc: 'Four-tier waterfall, jeep safari + swim.', time: 'Day 2' },
      { name: 'Cabo de Rama Fort', lat: 15.0886, lng: 73.9358, desc: 'Clifftop Portuguese-era fort, South Goa.', time: 'Morning, Day 3' },
      { name: 'Cola Beach', lat: 15.0167, lng: 73.9436, desc: 'Calm lagoon, the best kayaking on this trip.', time: 'Afternoon, Day 3' },
      { name: 'Butterfly Beach', lat: 15.0083, lng: 73.9494, desc: 'Reachable only by boat or trail. Quiet, scenic.', time: 'Late afternoon, Day 3' },
      { name: 'Agonda Beach', lat: 15.0457, lng: 73.9763, desc: 'Long, slow beach day. Sunset shacks.', time: 'Day 4' },
      { name: 'Hammerzz', lat: 15.0457, lng: 73.9763, desc: 'Nightclub near Agonda, optional late stop.', time: 'Night, Day 4' },
      { name: 'Baga Beach', lat: 15.5553, lng: 73.7517, desc: 'Water sports, lunch, shopping. Last stop.', time: 'Day 5' },
    ];

    const latlngs = [];
    stops.forEach((stop) => {
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: 8,
        fillColor: '#FF6B47',
        fillOpacity: 1,
        color: '#F5EFE3',
        weight: 2,
      }).addTo(map);

      const gmapsLink = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
      marker.bindPopup(
        `<div class="map-popup-title">${stop.name}</div>
         <span class="map-popup-time">${stop.time}</span>
         <p class="map-popup-desc">${stop.desc}</p>
         <a class="map-popup-link" href="${gmapsLink}" target="_blank" rel="noopener">Navigate in Google Maps →</a>`
      );

      latlngs.push([stop.lat, stop.lng]);
    });

    L.polyline(latlngs, {
      color: '#FFD66B',
      weight: 3,
      opacity: 0.8,
      dashArray: '8 8',
    }).addTo(map);

    map.fitBounds(latlngs, { padding: [30, 30] });
  }
});
