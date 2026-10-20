import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const CAMPUS = [12.872, 80.223];
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function AdminMap({ reports, selectedId, onSelect, theme, visible }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false }).setView(CAMPUS, 17);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    layer.current.clearLayers();
    reports.forEach((r) => {
      const sel = r.id === selectedId;
      const color = r.status === "cleaned" ? css("--accent") : css("--danger");
      L.circleMarker([r.lat, r.lng], {
        radius: sel ? 11 : 7,
        color: sel ? css("--text") : color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: sel ? 3 : 1,
      })
        .on("click", () => select.current(r.id))
        .addTo(layer.current);
    });
  }, [reports, selectedId, theme]);

  // Centre on selected report
  useEffect(() => {
    const r = reports.find((x) => x.id === selectedId);
    if (r && map.current) map.current.setView([r.lat, r.lng], Math.max(map.current.getZoom(), 18));
    // eslint-disable-next-line
  }, [selectedId]);

  // Fix sizing when the map becomes visible on mobile
  useEffect(() => {
    if (visible) setTimeout(() => map.current?.invalidateSize(), 50);
  }, [visible]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
    </div>
  );
}
