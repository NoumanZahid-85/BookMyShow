/** Map position of each city we serve, by slug. Used to pick the nearest one from GPS. */
export const CITY_COORDS: Record<string, [lat: number, lng: number]> = {
  karachi: [24.86, 67.01],
  lahore: [31.52, 74.36],
  islamabad: [33.68, 73.05],
  rawalpindi: [33.6, 73.04],
  faisalabad: [31.42, 73.08],
};

/**
 * Slug of the closest known city. Flat-earth distance is fine at this scale:
 * the cities are hundreds of km apart, so the error never changes the answer.
 */
export function nearestCitySlug(lat: number, lng: number, slugs: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const slug of slugs) {
    const c = CITY_COORDS[slug];
    if (!c) continue;
    const dLat = c[0] - lat;
    const dLng = (c[1] - lng) * Math.cos((lat * Math.PI) / 180);
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = slug;
    }
  }
  return best;
}
