/**
 * Central color palette — derived from the Figma designs.
 * Every UI component should reference these constants instead of
 * hard-coding colour strings.
 */
export const MAX_TUI_WIDTH_PX = 800;
export const APPROX_CHAR_WIDTH_PX = 8;
export const MAX_TUI_WIDTH_CHARS = Math.floor(MAX_TUI_WIDTH_PX / APPROX_CHAR_WIDTH_PX);

export const colors = {
  red: "#FC5753",
  yellow: "#E2AA0F",
  green: "#36C84B",

  /** Main background */
  bg: "#1E1E1E",
  /** Borders, separator lines, very muted helper text */
  border: "#424242",
  /** Un-foregrounded / secondary text */
  dim: "#797979",
  /** Primary foreground text */
  text: "#DCDCDC",
} as const;
