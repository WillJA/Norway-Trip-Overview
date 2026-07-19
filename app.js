document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const detailId = urlParams.get('id');

  if (window.location.pathname.includes('activity.html')) {
    if (detailId) {
      initDetailView(detailId, urlParams);
    }
  } else {
    initIndexView();
  }

  initLightbox();
});

/* ==========================================================================
   INDEX VIEW LOGIC
   ========================================================================== */
function initIndexView() {
  const cards = document.querySelectorAll('.activity-card');

  fetch('photos.json')
    .then(r => r.json())
    .then(db => {
      cards.forEach(card => {
        const gpxId = card.getAttribute('data-gpx');
        const imgDiv = card.querySelector('.activity-image');
        if (!imgDiv && db[gpxId] && db[gpxId].length > 0) {
           const firstImg = db[gpxId].find(p => !p.filename.toUpperCase().endsWith('.MP4'));
           if (firstImg) {
             const newDiv = document.createElement('div');
             newDiv.className = 'activity-image';
             newDiv.style.backgroundImage = `url('images_web/${firstImg.filename}')`;
             card.insertBefore(newDiv, card.firstChild);
           }
        }
      });
    }).catch(e => console.warn("Could not load photos for index view covers."));

  cards.forEach(card => {
    const gpxId = card.getAttribute('data-gpx');
    if (!gpxId) return;

    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-download')) return;
      const titleEl = card.querySelector('.activity-title');
      const title = titleEl ? titleEl.textContent : `Activity: ${gpxId}`;
      window.location.href = `activity.html?id=${gpxId}&title=${encodeURIComponent(title)}`;
    });

    fetch(`gpx/${gpxId}.gpx`)
      .then(response => {
        if (!response.ok) throw new Error('GPX not found');
        return response.text();
      })
      .then(gpxData => {
        const parsed = parseGPX(gpxData);
        if(parsed.latlngs.length > 0) {
           renderMap(`map-${gpxId}`, parsed.latlngs);
           renderElevation(`chart-${gpxId}`, parsed.distances, parsed.elevations);
        }
      })
      .catch(err => console.warn(`Could not load GPX for ${gpxId}: ${err.message}`));
  });
}

/* ==========================================================================
   DETAIL VIEW LOGIC
   ========================================================================== */
function initDetailView(gpxId, urlParams) {
  const title = urlParams.get('title');
  if (title) {
    document.getElementById('activity-title').textContent = title;
  } else {
    document.getElementById('activity-title').textContent = `Activity: ${gpxId}`;
  }
  
  fetch(`gpx/${gpxId}.gpx`)
    .then(response => response.text())
    .then(gpxData => {
      const parsed = parseGPX(gpxData);
      document.getElementById('val-dist').textContent = parsed.totalDistance.toFixed(1);
      
      const maxEle = Math.max(...parsed.elevations);
      const minEle = Math.min(...parsed.elevations);
      document.getElementById('val-ele').textContent = Math.round(maxEle - minEle);
      
      const map = renderMap('detail-map', parsed.latlngs);
      renderElevation('detail-chart', parsed.distances, parsed.elevations);
      
      fetchPhotos(gpxId, map);
    })
    .catch(err => console.error("Error loading detail view:", err));
}

let currentPhotos = [];

function fetchPhotos(gpxId, map) {
  fetch('photos.json')
    .then(r => {
      if(!r.ok) throw new Error("No photos.json found");
      return r.json();
    })
    .then(db => {
      const photos = db[gpxId] || [];
      const gallery = document.getElementById('photo-gallery');
      
      if (photos.length === 0) {
        gallery.innerHTML = '<p style="color:#888;">No photos matched to this activity yet.</p>';
        return;
      }
      
      currentPhotos = photos;
      
      photos.forEach((p, index) => {
        const isVideo = p.filename.toUpperCase().endsWith('.MP4');
        
        if (isVideo) {
          const vid = document.createElement('video');
          vid.src = `images_web/${p.filename}`;
          vid.className = 'gallery-img'; 
          vid.controls = false; // Disable controls so click works easily
          vid.preload = 'metadata';
          vid.style.cursor = 'pointer';
          vid.addEventListener('click', () => openLightbox(index));
          
          // Optional: simple play indicator overlay could be added, but click plays in lightbox
          gallery.appendChild(vid);
        } else {
          const img = document.createElement('img');
          img.src = `images_web/${p.filename}`;
          img.className = 'gallery-img';
          img.loading = 'lazy';
          img.style.cursor = 'pointer';
          img.addEventListener('click', () => openLightbox(index));
          gallery.appendChild(img);
        }
        
        if (p.lat && p.lon && map) {
          const marker = L.marker([p.lat, p.lon]).addTo(map);
          const popupContent = isVideo ? 
            `<video src="images_web/${p.filename}" style="width: 150px; border-radius: 4px;" controls></video>` :
            `<img src="images_web/${p.filename}" style="width: 150px; border-radius: 4px;">`;
          marker.bindPopup(popupContent);
        }
      });
    })
    .catch(err => {
      console.log("No photos database found.");
      document.getElementById('photo-gallery').innerHTML = '<p style="color:#888;">Photos not processed yet.</p>';
    });
}

/* ==========================================================================
   LIGHTBOX LOGIC
   ========================================================================== */
let currentLightboxIndex = 0;

function initLightbox() {
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxNext = document.getElementById('lightbox-next');
  const lightboxPrev = document.getElementById('lightbox-prev');
  
  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxNext.addEventListener('click', showNext);
    lightboxPrev.addEventListener('click', showPrev);
    
    document.addEventListener('keydown', (e) => {
      const lightbox = document.getElementById('lightbox');
      if (lightbox && !lightbox.classList.contains('lightbox-hidden')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();
      }
    });
  }
}

function openLightbox(index) {
  currentLightboxIndex = index;
  const p = currentPhotos[currentLightboxIndex];
  const isVideo = p.filename.toUpperCase().endsWith('.MP4');
  
  const lightbox = document.getElementById('lightbox');
  const imgEl = document.getElementById('lightbox-img');
  const vidEl = document.getElementById('lightbox-video');
  
  if (isVideo) {
    imgEl.style.display = 'none';
    vidEl.src = `images_web/${p.filename}`;
    vidEl.style.display = 'block';
    vidEl.play();
  } else {
    vidEl.style.display = 'none';
    vidEl.pause();
    imgEl.src = `images_web/${p.filename}`;
    imgEl.style.display = 'block';
  }
  
  lightbox.classList.remove('lightbox-hidden');
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.classList.add('lightbox-hidden');
    document.getElementById('lightbox-video').pause();
  }
}

function showNext() {
  if (currentLightboxIndex < currentPhotos.length - 1) {
    openLightbox(currentLightboxIndex + 1);
  }
}

function showPrev() {
  if (currentLightboxIndex > 0) {
    openLightbox(currentLightboxIndex - 1);
  }
}

/* ==========================================================================
   SHARED HELPERS
   ========================================================================== */
function parseGPX(gpxData) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxData, "text/xml");
  const trkpts = xmlDoc.querySelectorAll("trkpt");

  let latlngs = [];
  let elevations = [];
  let distances = [];
  let totalDistance = 0;
  let prevLat = null, prevLon = null;

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  trkpts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    const eleNode = pt.querySelector("ele");
    const ele = eleNode ? parseFloat(eleNode.textContent) : 0;

    latlngs.push([lat, lon]);
    elevations.push(ele);

    if (prevLat !== null && prevLon !== null) {
      totalDistance += getDistance(prevLat, prevLon, lat, lon);
    }
    distances.push(totalDistance.toFixed(2));
    
    prevLat = lat;
    prevLon = lon;
  });

  return { latlngs, elevations, distances, totalDistance };
}

function renderMap(containerId, latlngs) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  
  const map = L.map(container, { zoomControl: false, attributionControl: false });
  
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
  }).addTo(map);

  const polyline = L.polyline(latlngs, {color: '#fc5200', weight: 4, opacity: 0.8}).addTo(map);
  map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
  
  return map;
}

function renderElevation(canvasId, distances, elevations) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: distances,
      datasets: [{
        label: 'Elevation (m)',
        data: elevations,
        borderColor: '#fc5200',
        backgroundColor: 'rgba(252, 82, 0, 0.2)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { display: false },
        y: { display: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e', maxTicksLimit: 5 } }
      }
    }
  });
}
