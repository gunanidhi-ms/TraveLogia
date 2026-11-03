if (!mapToken || mapToken.trim() === "" || mapToken === "undefined") {
  const mapContainer = document.getElementById("map");
  if (mapContainer && typeof listing !== "undefined") {
    mapContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;background:#f8f9fa;border:1px dashed #ced4da;border-radius:12px;color:#6c757d;text-align:center;padding:24px;">
        <i class="fa-solid fa-map-location-dot" style="font-size:2.8rem;margin-bottom:12px;color:#fe424d;"></i>
        <h5 style="margin-bottom:6px;color:#222;">${listing.location || "Location"}, ${listing.country || ""}</h5>
        <p class="text-muted" style="margin:0;max-width:380px;font-size:0.9rem;">Map coordinates: [${(listing.geometry && listing.geometry.coordinates) ? listing.geometry.coordinates.join(", ") : "0, 0"}]. Mapbox live map preview activates when MAP_TOKEN is configured.</p>
      </div>
    `;
  }
} else if (typeof mapboxgl !== "undefined" && typeof listing !== "undefined") {
  try {
    mapboxgl.accessToken = mapToken;
    const coords =
      listing.geometry &&
      Array.isArray(listing.geometry.coordinates) &&
      listing.geometry.coordinates.length === 2
        ? listing.geometry.coordinates
        : [77.209, 28.6139];

    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/dark-v11",
      center: coords,
      zoom: 9,
    });

    const marker = new mapboxgl.Marker({ color: "red" })
      .setLngLat(coords)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="map-click">
          <h4><b>${listing.title}</b></h4> 
          <p>Exact location will be provided after booking.</p>
          </div>`
        )
      )
      .addTo(map);

    map.addControl(new mapboxgl.ScaleControl());
    map.addControl(new mapboxgl.NavigationControl());
  } catch (err) {
    console.warn("Mapbox initialization error:", err);
  }
}
