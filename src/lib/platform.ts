/**
 * Platform detection for Tauri v2 (desktop vs mobile)
 */

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isDesktop(): boolean {
  return !isMobile();
}

/**
 * Download/share a file. Uses navigator.share() on mobile (native share sheet),
 * falls back to anchor download on desktop.
 */
export async function downloadFile(blob: Blob, filename: string): Promise<void> {
  if (isMobile() && navigator.share) {
    const file = new File([blob], filename, { type: blob.type });
    await navigator.share({ files: [file] });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
