// Coordinates of the places in the content, as fetched by `folio external` (OpenStreetMap).
import external from "../data/external.json";

const COORDINATES = external.locations as Record<string, [number, number]>;

/** The city of a location like "Leiden, NL", or null for virtual places or ones without coordinates. */
export function cityOf(location?: string): { name: string; at: [number, number] } | null {
  if (!location || !COORDINATES[location]) {
    if (location && !/virtual|global/i.test(location)) console.warn(`places: no coordinates for "${location}"; run folio external`);
    return null;
  }
  return { name: location.split(",")[0].trim(), at: COORDINATES[location] };
}

/** Great-circle distance (km) and initial bearing (radians, clockwise from north) from a to b. */
export function distanceBearing([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const rad = Math.PI / 180, [p1, p2, dl] = [lat1 * rad, lat2 * rad, (lon2 - lon1) * rad];
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distance = 2 * 6371 * Math.asin(Math.sqrt(a));
  const bearing = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  return { distance, bearing };
}
