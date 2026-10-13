// Coordinates (latitude, longitude) of the cities that appear in locations, for the travel figure.
// Add a city here when a new one shows up; unknown cities are left out with a build warning.
const COORDINATES: Record<string, [number, number]> = {
  "The Hague": [52.07, 4.3], Leiden: [52.16, 4.49], Amsterdam: [52.37, 4.9], Eindhoven: [51.44, 5.47],
  Maastricht: [50.85, 5.69], Breda: [51.59, 4.78], Tilburg: [51.56, 5.09], Helmond: [51.48, 5.66],
  Utrecht: [52.09, 5.12], "St-Petersburg": [59.94, 30.31], Peterhof: [59.88, 29.91], "West Virginia": [37.95, -81.12],
  Lyon: [45.76, 4.84], Geneva: [46.2, 6.14], Barcelona: [41.39, 2.17], Odense: [55.4, 10.39],
  "Bad Saarow": [52.29, 14.06], Braga: [41.55, -8.42],
};

/** The city of a location like "Leiden, NL", or null for virtual or unknown places. */
export function cityOf(location?: string): { name: string; at: [number, number] } | null {
  if (!location || /virtual|global/i.test(location)) return null;
  const name = location.split(",")[0].trim();
  if (!COORDINATES[name]) {
    console.warn(`places: no coordinates for "${name}"; add it to src/lib/places.ts`);
    return null;
  }
  return { name, at: COORDINATES[name] };
}

/** Great-circle distance (km) and initial bearing (radians, clockwise from north) from a to b. */
export function distanceBearing([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const rad = Math.PI / 180, [p1, p2, dl] = [lat1 * rad, lat2 * rad, (lon2 - lon1) * rad];
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distance = 2 * 6371 * Math.asin(Math.sqrt(a));
  const bearing = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  return { distance, bearing };
}
