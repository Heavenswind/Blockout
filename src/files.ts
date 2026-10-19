import { assertLevel } from './model/level';
import type { Level } from './model/types';

export function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'level';
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(data)], { type: 'application/json' }));
}

export async function readLevelFile(file: File): Promise<Level> {
  const data: unknown = JSON.parse(await file.text());
  assertLevel(data);
  return data;
}
