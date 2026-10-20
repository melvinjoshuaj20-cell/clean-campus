import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default centre: St. Joseph's Engineering College, OMR, Chennai (adjust if needed)
export const CAMPUS = [12.872, 80.223];

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function MapPicker({ value, onChange, reports = [], theme }) {
  const el = useRef(null);
  const map = useRef(null);
  const pin = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false }).setView(CAMPUS, 17);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    m.on("click", (e) => onChange([e.latlng.lat, e.latlng.lng]));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => m.remove();
    // eslint-disable-next-line
  }, []);

  // Selected spot
  useEffect(() => {
    if (pin.current) {
      pin.current.remove();
      pin.current = null;
    }
    if (value) {
      pin.current = L.circleMarker(value, {
        radius: 10, color: css("--accent"), fillColor: css("--accent"), fillOpacity: 0.35, weight: 3,
      }).addTo(map.current);
    }
  }, [value, theme]);

  // Previously reported spots
  useEffect(() => {
    layer.current.clearLayers();
    reports.forEach((r) => {
      L.circleMarker([r.lat, r.lng], {
        radius: 6,
        color: r.status === "cleaned" ? css("--accent") : css("--danger"),
        fillOpacity: 0.7,
        weight: 1,
      }).addTo(layer.current);
    });
  }, [reports, theme]);

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = [p.coords.latitude, p.coords.longitude];
        map.current.setView(pos, 18);
        onChange(pos);
      },
      () => alert("Could not get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      <button className="locate" onClick={locate}>Use my location</button>
    </div>
  );
}
