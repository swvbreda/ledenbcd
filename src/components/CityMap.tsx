import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import cityCoords from "@/data/cityCoords";

interface CityMapProps {
  cities: { naam: string; aantalLeden: number; aantalLocaties: number }[];
  onCityClick?: (city: string) => void;
}

const CityMap = ({ cities, onCityClick }: CityMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  const maxLeden = useMemo(() => Math.max(...cities.map((c) => c.aantalLeden), 1), [cities]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [52.2, 5.3],
      zoom: 7,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markerLayerRef.current = markerLayer;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    for (const city of cities) {
      const coords = cityCoords[city.naam];
      if (!coords) continue;

      bounds.push(coords);
      const radius = 8 + (city.aantalLeden / maxLeden) * 28;

      const marker = L.circleMarker(coords, {
        radius,
        fillColor: "hsl(var(--primary))",
        fillOpacity: 0.55,
        color: "hsl(var(--primary))",
        opacity: 0.9,
        weight: 1.5,
      });

      marker.bindTooltip(
        `<div class="text-xs"><strong>${city.naam}</strong><br/>${city.aantalLeden} leden · ${city.aantalLocaties} locaties</div>`,
        { direction: "top", offset: [0, -radius] },
      );

      if (onCityClick) {
        marker.on("click", () => onCityClick(city.naam));
      }

      marker.addTo(markerLayer);
    }

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 10);
    }
  }, [cities, maxLeden, onCityClick]);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ height: 420 }}>
      <div ref={mapContainerRef} className="h-full w-full z-0" />
    </div>
  );
};

export default CityMap;
