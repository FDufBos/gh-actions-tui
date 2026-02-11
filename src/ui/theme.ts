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

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return [0, 0, 0];
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Simulates opacity for terminal colors by blending a foreground color
 * against the background color.
 */
export function blendOnBg(color: string, opacity: number, background: string = colors.bg): string {
  const alpha = Math.max(0, Math.min(1, opacity));
  const [fr, fg, fb] = hexToRgb(color);
  const [br, bg, bb] = hexToRgb(background);
  return rgbToHex([
    Math.round(fr * alpha + br * (1 - alpha)),
    Math.round(fg * alpha + bg * (1 - alpha)),
    Math.round(fb * alpha + bb * (1 - alpha)),
  ]);
}
