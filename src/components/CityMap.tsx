import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import cityCoords from "@/data/cityCoords";

interface CityMapProps {
  cities: { naam: string; aantalLeden: number; aantalLocaties: number }[];
  onCityClick?: (city: string) => void;
}

const FitBounds = ({ cities }: { cities: CityMapProps["cities"] }) => {
  const map = useMap();
  useEffect(() => {
    const coords = cities
      .map((c) => cityCoords[c.naam])
      .filter(Boolean) as [number, number][];
    if (coords.length > 1) {
      map.fitBounds(coords, { padding: [40, 40] });
    }
  }, [cities, map]);
  return null;
};

const CityMap = ({ cities, onCityClick }: CityMapProps) => {
  const maxLeden = Math.max(...cities.map((c) => c.aantalLeden), 1);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ height: 420 }}>
      <MapContainer
        center={[52.2, 5.3]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds cities={cities} />
        {cities.map((city) => {
          const coords = cityCoords[city.naam];
          if (!coords) return null;
          const radius = 8 + (city.aantalLeden / maxLeden) * 28;
          return (
            <CircleMarker
              key={city.naam}
              center={coords}
              radius={radius}
              pathOptions={{
                fillColor: "hsl(210, 80%, 55%)",
                fillOpacity: 0.6,
                color: "hsl(210, 80%, 40%)",
                weight: 1.5,
              }}
              eventHandlers={{
                click: () => onCityClick?.(city.naam),
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]}>
                <div className="text-xs">
                  <strong>{city.naam}</strong>
                  <br />
                  {city.aantalLeden} leden · {city.aantalLocaties} locaties
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default CityMap;
