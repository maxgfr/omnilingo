/**
 * Platform detection for Tauri v2 (desktop vs mobile)
 */

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isDesktop(): boolean {
  return !isMobile();
}
