import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import cityCoords from "@/data/cityCoords";

interface CityData {
  naam: string;
  aantalLocaties: number;
  totaalNL: number;
  marktPct: number;
}

interface CityMapProps {
  cities: CityData[];
  allCoffeeshopCities?: Record<string, number>;
  onCityClick?: (city: string) => void;
}

const getColor = (pct: number) => {
  if (pct >= 50) return "hsl(142, 71%, 40%)";  // strong green
  if (pct >= 25) return "hsl(142, 60%, 50%)";  // medium green
  if (pct > 0) return "hsl(142, 50%, 60%)";    // light green
  return "hsl(45, 90%, 55%)";                   // yellow
};

const CityMap = ({ cities, allCoffeeshopCities, onCityClick }: CityMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  const maxLocaties = useMemo(() => Math.max(...cities.map((c) => c.totaalNL || c.aantalLocaties), 1), [cities]);

  const cityMap = useMemo(() => {
    const m = new Map<string, CityData>();
    for (const c of cities) m.set(c.naam, c);
    return m;
  }, [cities]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const nlBounds = L.latLngBounds([50.75, 3.2], [53.55, 7.25]);

    const map = L.map(mapContainerRef.current, {
      center: [52.2, 5.3],
      zoom: 7,
      minZoom: 7,
      maxBounds: nlBounds,
      maxBoundsViscosity: 1.0,
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

    // Collect all city names to render
    const allCities = new Set<string>();
    for (const c of cities) allCities.add(c.naam);
    if (allCoffeeshopCities) {
      for (const naam of Object.keys(allCoffeeshopCities)) allCities.add(naam);
    }

    for (const naam of allCities) {
      const coords = cityCoords[naam];
      if (!coords) continue;

      const bcdCity = cityMap.get(naam);
      const totaalNL = bcdCity?.totaalNL || allCoffeeshopCities?.[naam] || 0;
      const aangesloten = bcdCity?.aantalLocaties || 0;
      const pct = bcdCity?.marktPct || 0;
      const hasBcd = aangesloten > 0;

      const radius = hasBcd
        ? 6 + (totaalNL / maxLocaties) * 26
        : 5;

      const color = hasBcd ? getColor(pct) : "hsl(45, 90%, 55%)";

      const marker = L.circleMarker(coords, {
        radius,
        fillColor: color,
        fillOpacity: hasBcd ? 0.6 : 0.45,
        color: color,
        opacity: 0.9,
        weight: hasBcd ? 1.5 : 1,
      });

      const tooltip = hasBcd
        ? `<div class="text-xs"><strong>${naam}</strong><br/>${totaalNL} totaal · ${aangesloten} aangesloten (${pct}%)</div>`
        : `<div class="text-xs"><strong>${naam}</strong><br/>${totaalNL} coffeeshops · geen leden</div>`;

      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -radius] });

      if (onCityClick && hasBcd) {
        marker.on("click", () => onCityClick(naam));
      }

      marker.addTo(markerLayer);
    }
  }, [cities, cityMap, maxLocaties, allCoffeeshopCities, onCityClick]);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ height: 420 }}>
      <div ref={mapContainerRef} className="h-full w-full z-0" />
    </div>
  );
};

export default CityMap;
