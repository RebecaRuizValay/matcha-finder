console.log("✅ prueba corchetes");
let map;
let markersLayer;
let cafesQueue = [];

function getLocation() {
  const cache = JSON.parse(localStorage.getItem('cachedLocation') || '{}');
  const now = Date.now();

  if (cache.timestamp && now - cache.timestamp < 10 * 60 * 1000) {
    useLocation(cache.lat, cache.lng);
  } else {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        localStorage.setItem(
          'cachedLocation',
          JSON.stringify({ lat, lng, timestamp: now })
        );
        useLocation(lat, lng);
      },
      () => alert("Acceso a la ubicación denegado.")
    );
  }
}

function initMap(lat, lng) {
  if (!map) {
    map = L.map('map').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

     map.on("click", () => {
      document.querySelectorAll(".swipe-wrapper").forEach(w => {
        w.style.transform = "translateX(0) rotate(0)";
        w.style.opacity = "1";
        w.style.pointerEvents = "auto";
      });
    });

  } else {
    map.flyTo([lat, lng], 15, {
      animate: true,
      duration: 1
    });
    markersLayer.clearLayers();
  }
}

async function useLocation(lat, lng) {
  const query = `
    [out:json];
    node
      (around:1500, ${lat}, ${lng})
      ["amenity"="cafe"];
    out;
  `;

  const cacheKey = `cafes_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  const cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');

  if (cache.timestamp && Date.now() - cache.timestamp < 5 * 60 * 1000) {
    console.log("usando cafes cacheados");
    initMap(lat, lng);
   let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");
  cafesQueue = cache.data.filter(cafe =>
    !saved.find(s => String(s.place_id) === String(cafe.id))
  );
  displayCards(cafesQueue);
  return; 
}

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    });

    if (!response.ok) {
      throw new Error("Overpass API saturada (429)");
    }

    const data = await response.json();

    if (data.elements && data.elements.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: data.elements,
        timestamp: Date.now()
      }));
      initMap(lat, lng);
      let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");
      cafesQueue = data.elements.filter(cafe =>
        !saved.find(s => String(s.place_id) === String(cafe.id))
      );
      displayCards(cafesQueue);
    } else {
      alert("No hay cafeterias cerca de ti");
    }

  } catch (e) {
    console.error(e);
    alert("Error encontrando cafés (puede ser límite de la API).");
  }
}

const nominatimQueue = [];
let nominatimRunning = false;

function queueNominatim(lat, lon, callback) {
  nominatimQueue.push({ lat, lon, callback });
  if (!nominatimRunning) runNominatimQueue();
}

async function runNominatimQueue() {
  nominatimRunning = true;
  while (nominatimQueue.length > 0) {
    const { lat, lon, callback } = nominatimQueue.shift();
    const addr = await getPrettyAddress(lat, lon);
    callback(addr);
    await new Promise(r => setTimeout(r, 1100)); 
  }
  nominatimRunning = false;
}

async function getPrettyAddress(lat, lon) {
  const key = `addr_${lat}_${lon}`;
  const cached = localStorage.getItem(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );
    const data = await res.json();
    const a = data.address || {};
    const street = a.road || a.pedestrian || a.cycleway || "";
    const number = a.house_number || "";
    const suburb = a.suburb || a.neighbourhood || a.quarter || "";
    const city = a.city || a.town || a.village || "";
    let pretty = [street, number].filter(Boolean).join(" ");
    let area = [suburb, city].filter(Boolean).join(", ");
    const finalAddress =
      (pretty || area)
        ? `${pretty}${area ? ", " + area : ""}`
        : "Dirección no disponible";
    localStorage.setItem(key, finalAddress);
    return finalAddress;
  } catch (e) {
    return "Dirección no disponible";
  }
}

function displayCards(cafes) {
  const container = document.querySelector('.cards');
  container.innerHTML = "";
  markersLayer.clearLayers();

  cafes.forEach((cafe, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'swipe-wrapper';
    wrapper.dataset.id = cafe.id;
    wrapper.style.zIndex = 200 - i;
  
    const card = document.createElement("div");
    card.className = "location-card";
    const cafeName = cafe.tags?.name || "Cafe sin nombre";

  const cafeData = {
    name: cafeName,
    place_id: cafe.id,
    rating: "—",
    note: "",
    lat: cafe.lat,
    lon: cafe.lon
  };

  if (cafe.lat && cafe.lon) {
    cafe.marker = L.marker([cafe.lat, cafe.lon]).addTo(markersLayer);
    
    cafe.marker.on("click", () => {
      map.flyTo([cafe.lat, cafe.lon], 17, { animate: true, duration: 1 });
    
      document.querySelectorAll(".swipe-wrapper").forEach(w => {
        w.classList.remove("highlight");
        if (w.dataset.id != cafe.id) {
          w.style.transform = "translateX(-150%) rotate(-10deg)";
          w.style.opacity = "0";
          w.style.pointerEvents = "none";
        }
      });
     
      wrapper.style.transform = "translateX(0) rotate(0)";
      wrapper.style.opacity = "1";
      wrapper.style.pointerEvents = "auto";
      wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
      wrapper.classList.add("highlight");
      setTimeout(() => wrapper.classList.remove("highlight"), 800);
    });
  }

  card.innerHTML = `
    <h3>${cafeName}</h3>
    <p class="address">📍 Buscando dirección...</p>
    <div class="rating">
      <span data-star="1">🍵</span>
      <span data-star="2">🍵</span>
      <span data-star="3">🍵</span>
      <span data-star="4">🍵</span>
      <span data-star="5">🍵</span>
    </div>
    <textarea class="note">${cafe.note || ""}</textarea>
  `;

  const addressEl = card.querySelector(".address");
  if (cafe.lat && cafe.lon) {
    const tag = cafe.tags?.["addr:street"];
    const num = cafe.tags?.["addr:housenumber"] || "";
    if (tag) {
      if (addressEl) addressEl.textContent = "📍 " + [tag, num].filter(Boolean).join(" ");
    } else {
      queueNominatim(cafe.lat, cafe.lon, addr => {
        if (addressEl) addressEl.textContent = "📍 " + addr;
      });
    }
  }

  let currentRating = cafe.rating || 0;
  const stars = card.querySelectorAll(".rating span");

  function paintStars() {
    stars.forEach(s => {
      s.style.opacity = s.dataset.star <= currentRating ? "1" : "0.3";
    });
  }
  
  paintStars();

  stars.forEach(star => {
    star.addEventListener("click", () => {
      currentRating = Number(star.dataset.star);
      cafe.rating = currentRating;
      paintStars();
      updateSaved(cafe);
    });
  });

  const textarea = card.querySelector(".note");
  textarea.addEventListener("input", () => {
    cafe.note = textarea.value;
    updateSaved(cafe);
  });

  wrapper.appendChild(card);
  container.appendChild(wrapper);

  wrapper.addEventListener("click", () => {
    if (!cafe.marker) return;
    map.flyTo(cafe.marker.getLatLng(), 17, {  animate: true, duration: 1 });
  cafe.marker.openPopup?.();
  document.querySelectorAll(".swipe-wrapper").forEach(w => {
    w.classList.remove("highlight");
  });
  wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
  wrapper.classList.add("highlight");
  setTimeout(() => {
    wrapper.classList.remove("highlight");
  }, 800);
});

const hammertime = new Hammer(wrapper);

hammertime.on("swipeleft", () => {
  wrapper.style.transition = "transform 0.2s, opacity 0.2s";
  wrapper.style.transform = "translateX(-150%) rotate(-15deg)";
  wrapper.style.opacity = 0;
  setTimeout(() => {
    wrapper.remove(); 
    cafesQueue = cafesQueue.filter(c => c.id !== cafe.id);
    cafesQueue.push(cafe); 
    if (cafe.marker) markersLayer.removeLayer(cafe.marker);
  }, 200);
});

hammertime.on("swiperight", () => {
  wrapper.style.transition = "transform 0.2s, opacity 0.2s";
  wrapper.style.transform = "translateX(150%) rotate(15deg)";
  wrapper.style.opacity = 0;
  if (cafe.marker) {
    map.flyTo(cafe.marker.getLatLng(), 17, { duration: 1.2 });
    cafe.marker.openPopup?.();
  }
  const note = card.querySelector(".note").value;
  cafeData.rating = currentRating;
  cafeData.note = note;
  setTimeout(() => {
    wrapper.remove();
    cafe.saved = true;
    cafesQueue = cafesQueue.filter(c => c.id !== cafe.id);
    saveCafe(JSON.stringify(cafeData));
  }, 200);
});

});
}

function saveCafe(cafeJSON) {
  const cafe = JSON.parse(cafeJSON);
  let saved = JSON.parse(localStorage.getItem('savedCafes') || '[]');
  if (!saved.find((c) => String(c.place_id) === String(cafe.place_id))) {
    saved.push(cafe);
    localStorage.setItem("savedCafes", JSON.stringify(saved));
    console.log(`☕ Guardado: ${cafe.name}`);
  }
}

function updateSaved(cafe) {
  let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");
  const index = saved.findIndex(s => String(s.place_id) === String(cafe.id));
  if (index !== -1) {
    saved[index].rating = cafe.rating;
    saved[index].note = cafe.note;
    localStorage.setItem("savedCafes", JSON.stringify(saved));
  }
}

function showSaved() {
  const container = document.querySelector('.cards');
  container.innerHTML = '';
  markersLayer.clearLayers();
  let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");
  saved.forEach(cafe => { cafe._savedMarker = null; });

  if (saved.length === 0) {
    container.innerHTML = "<p>Aún no tienes nada</p>";
    return;
  }

  saved.forEach((cafe, index) => {
    const card = document.createElement('div');
    card.className = 'location-card';
    card.innerHTML = `
      <h3>${cafe.name}</h3>
      <div class="saved-rating">${"🍵".repeat(cafe.rating || 0)}</div>
      <p class="saved-note">${cafe.note || "Sin notas, aún..."}</p>
      <button class="edit-btn">✏️</button>
      <div class="edit-panel" style="display:none;">
        <div class="rating-edit">
          <span data-star="1">🍵</span>
          <span data-star="2">🍵</span>
          <span data-star="3">🍵</span>
          <span data-star="4">🍵</span>
          <span data-star="5">🍵</span>
        </div>
        <textarea class="edit-note">${cafe.note || ""}</textarea>
        <button class="save-edit">Guardar</button>
      </div>
    `;

    const editBtn = card.querySelector(".edit-btn");
    const panel = card.querySelector(".edit-panel");
    const stars = card.querySelectorAll(".rating-edit span");
    const textarea = card.querySelector(".edit-note");
    const saveBtn = card.querySelector(".save-edit");
    let tempRating = cafe.rating || 0;

    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });

    function paintStars() {
      stars.forEach(s => {
        s.style.opacity = s.dataset.star <= tempRating ? "1" : "0.3";
      });
    }
    paintStars();

    stars.forEach(star => {
      star.addEventListener("click", () => {
        tempRating = Number(star.dataset.star);
        paintStars();
      });
    });

    saveBtn.addEventListener("click", () => {
      cafe.rating = tempRating;
      cafe.note = textarea.value;
      let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");
      saved[index] = cafe;
      localStorage.setItem("savedCafes", JSON.stringify(saved));
      showSaved();
    });

    card.addEventListener("click", (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.dataset.star) return;
      if (e.target.classList.contains("edit-btn") || e.target.classList.contains("save-edit")) return;
      if (cafe.lat && cafe.lon) {
        map.flyTo([cafe.lat, cafe.lon], 17, { animate: true, duration: 1.2 });
        if (!cafe._savedMarker) {
          markersLayer.clearLayers();
          cafe._savedMarker = L.marker([cafe.lat, cafe.lon])
            .addTo(markersLayer)
            .bindPopup(cafe.name || "Café");
        }
        cafe._savedMarker.openPopup();
      }
    });

    container.appendChild(card);
  });
}

function focusCard(id) {
  const cards = document.querySelectorAll(".swipe-wrapper");
  cards.forEach(card => {
    if (card.dataset.id == id) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("highlight");
      setTimeout(() => {
        card.classList.remove("highlight");
      }, 1200);
    }
  });
}