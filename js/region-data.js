/* Outline-only region borders (US states/provinces) — brighter than
   the world borders, but no glow, since these nest inside a country
   that's often already highlighted. Source: US Census-derived state
   boundaries via PublicaMundi/MappingAPI (public domain). To outline
   another state/province, add it to REGION_TARGETS in
   scripts/generate-map-data.py and re-run that script. */
export const REGION_RINGS = {
  colorado: [
    [-107.92,41.0,-102.05,41.0,-102.04,36.99,-109.04,37.0,-109.05,41.0,-107.92,41.0],
  ],
};
