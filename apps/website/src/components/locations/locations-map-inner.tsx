"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { getDirectionsUrl } from "@/lib/marketing/default-locations";
import type { MarketingLocationPublic } from "@/lib/marketing/types";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export function LocationsMapInner({ locations }: { locations: MarketingLocationPublic[] }) {
  const withCoords = locations.filter(
    (l): l is MarketingLocationPublic & { latitude: number; longitude: number } =>
      l.latitude != null &&
      l.longitude != null &&
      Number.isFinite(l.latitude) &&
      Number.isFinite(l.longitude),
  );

  const points = useMemo(
    () => withCoords.map((l) => [l.latitude, l.longitude] as [number, number]),
    [withCoords],
  );

  const icon = useMemo(
    () =>
      L.divIcon({
        className: "pet-marker-wrap",
        html: `<div class="pet-marker-pin" aria-hidden="true"><span class="pet-marker-emoji">🐾</span></div>`,
        iconSize: [44, 48],
        iconAnchor: [22, 48],
        popupAnchor: [0, -44],
      }),
    [],
  );

  const center: [number, number] = points[0] ?? INDIA_CENTER;
  const zoom = points.length === 0 ? 6 : points.length === 1 ? 12 : 11;

  return (
    <MapContainer center={center} zoom={zoom} className="z-0 h-full w-full rounded-2xl" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.length > 1 ? <FitBounds points={points} /> : null}
      {withCoords.map((loc) => (
        <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={icon}>
          <Popup>
            <span className="font-semibold">{loc.name}</span>
            <br />
            <a className="text-primary underline" href={getDirectionsUrl(loc)} target="_blank" rel="noopener noreferrer">
              Directions
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
