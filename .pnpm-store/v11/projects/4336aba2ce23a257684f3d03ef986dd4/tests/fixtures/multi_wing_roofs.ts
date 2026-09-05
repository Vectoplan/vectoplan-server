export const MULTI_WING_ROOF_PATHS = {
  u_four: [[0, 0], [32, 0], [32, 21], [9, 21], [9, 38]],
  oblique_u: [[0, 0], [34, 4], [39, 25], [15, 35], [5, 16]],
  zigzag: [[0, 0], [28, 7], [38, 30], [62, 25], [77, 48]],
  short_connector: [[0, 0], [22, 0], [25, 5], [49, 8]],
} as const;

export const MULTI_WING_ROOF_TYPES = ["hipped", "half_hipped", "pyramid"] as const;
export const MULTI_WING_STOREYS = [7, 6, 8, 5] as const;
