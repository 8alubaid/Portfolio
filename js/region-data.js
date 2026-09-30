/* Outline-only region borders (US states/provinces and counties) —
   brighter than the world borders, but no glow, since these nest
   inside a country that's often already highlighted. Source: US
   Census-derived boundaries via PublicaMundi/MappingAPI (states) and
   plotly/datasets geojson-counties-fips.json (counties), both public
   domain. To outline another state/province or county, add it to
   REGION_TARGETS or COUNTY_TARGETS in scripts/generate-map-data.py
   and re-run that script. */
export const REGION_RINGS = {
  colorado: [
    [-107.92,41.0,-102.05,41.0,-102.04,36.99,-109.04,37.0,-109.05,41.0,-107.92,41.0],
  ],
  boulder_county: [
    [-105.06,40.26,-105.05,39.98,-105.09,39.96,-105.07,39.96,-105.08,39.94,-105.11,39.94,-105.11,39.92,-105.11,39.95,-105.12,39.95,-105.11,39.96,-105.13,39.95,-105.15,39.91,-105.4,39.91,-105.4,39.93,-105.68,39.93,-105.64,40.04,-105.65,40.26,-105.06,40.26],
  ],
};
