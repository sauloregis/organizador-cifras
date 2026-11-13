// Compartilhamento sem servidor: por link (dados comprimidos no próprio link)
// ou por arquivo .json (ex.: enviado no grupo do WhatsApp).

import LZString from 'lz-string';
import { db } from './db';
import type { Setlist, SharePayload, Song } from './types';

export async function payloadForSetlist(setlist: Setlist): Promise<SharePayload> {
  const ids = [...new Set(setlist.items.map((i) => i.songId))];
  const songs = (await db.songs.bulkGet(ids)).filter((s): s is Song => !!s);
  return { app: 'cifras-louvor', v: 1, setlists: [setlist], songs };
}

export function payloadForSongs(songs: Song[]): SharePayload {
  return { app: 'cifras-louvor', v: 1, setlists: [], songs };
}

export function encodePayload(payload: SharePayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodePayload(data: string): SharePayload {
  const json = LZString.decompressFromEncodedURIComponent(data);
  if (!json) throw new Error('Link inválido ou incompleto.');
  return validatePayload(JSON.parse(json));
}

export function validatePayload(obj: unknown): SharePayload {
  const p = obj as Partial<SharePayload>;
  if (!p || p.app !== 'cifras-louvor' || !Array.isArray(p.songs) || !Array.isArray(p.setlists)) {
    throw new Error('Este arquivo não é do Cifras Louvor.');
  }
  return p as SharePayload;
}

export function shareLink(payload: SharePayload): string {
  const base = location.origin + location.pathname;
  return `${base}#/importar?d=${encodePayload(payload)}`;
}

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function payloadFile(payload: SharePayload, name: string): File {
  const blob = JSON.stringify(payload);
  return new File([blob], `${slugify(name) || 'cifras'}.json`, { type: 'application/json' });
}

export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'manual';

/** Tenta o menu de compartilhar do celular; se não houver, copia o link. */
export async function shareUrl(title: string, url: string): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'manual';
  }
}

/** Tenta compartilhar o arquivo (WhatsApp etc.); se não der, baixa o arquivo. */
export async function shareFile(title: string, file: File): Promise<ShareResult> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

export async function readPayloadFile(file: File): Promise<SharePayload> {
  return validatePayload(JSON.parse(await file.text()));
}
