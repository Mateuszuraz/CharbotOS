const KEY = 'charbot_gallery';
const MAX = 100;

export interface GalleryItem {
  id: string;
  name: string;
  dataUrl: string;
  timestamp: string; // ISO string
}

export function getGallery(): GalleryItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function addToGallery(item: GalleryItem): void {
  const updated = [item, ...getGallery()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Storage full — trim to half and retry
    const trimmed = [item, ...getGallery().slice(0, Math.floor(MAX / 2))];
    try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch { /* give up */ }
  }
}

export function removeFromGallery(id: string): GalleryItem[] {
  const updated = getGallery().filter(i => i.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}
