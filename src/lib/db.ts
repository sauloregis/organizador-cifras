// Armazenamento local no próprio aparelho (IndexedDB). Sem servidor, sem internet.

import Dexie, { type Table } from 'dexie';
import type { Setlist, SharePayload, Song } from './types';

class CifrasDB extends Dexie {
  songs!: Table<Song, string>;
  setlists!: Table<Setlist, string>;

  constructor() {
    super('cifras-louvor');
    this.version(1).stores({
      songs: 'id, title, updatedAt',
      setlists: 'id, date, updatedAt',
    });
  }
}

export const db = new CifrasDB();

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* navegador sem suporte */
  }
  return false;
}

export async function saveSong(song: Song): Promise<void> {
  await db.songs.put({ ...song, updatedAt: Date.now() });
}

export async function saveSetlist(setlist: Setlist): Promise<void> {
  await db.setlists.put({ ...setlist, updatedAt: Date.now() });
}

export async function deleteSong(id: string): Promise<void> {
  await db.songs.delete(id);
}

export async function deleteSetlist(id: string): Promise<void> {
  await db.setlists.delete(id);
}

export type ImportStatus = 'new' | 'update' | 'same' | 'older';

export interface ImportPlan {
  songs: { song: Song; status: ImportStatus }[];
  setlists: { setlist: Setlist; status: ImportStatus }[];
}

function statusFor(local: { updatedAt: number } | undefined, incoming: { updatedAt: number }): ImportStatus {
  if (!local) return 'new';
  if (incoming.updatedAt > local.updatedAt) return 'update';
  if (incoming.updatedAt === local.updatedAt) return 'same';
  return 'older';
}

export async function planImport(payload: SharePayload): Promise<ImportPlan> {
  const songs = await Promise.all(
    payload.songs.map(async (song) => ({ song, status: statusFor(await db.songs.get(song.id), song) })),
  );
  const setlists = await Promise.all(
    payload.setlists.map(async (setlist) => ({
      setlist,
      status: statusFor(await db.setlists.get(setlist.id), setlist),
    })),
  );
  return { songs, setlists };
}

/**
 * Aplica a importação mantendo as datas originais (para que todos tenham a mesma versão).
 * `overwriteOlder` também substitui itens locais mais novos que os recebidos.
 */
export async function applyImport(plan: ImportPlan, overwriteOlder: boolean): Promise<number> {
  const accept = (s: ImportStatus) => s === 'new' || s === 'update' || (overwriteOlder && s === 'older');
  const songs = plan.songs.filter((x) => accept(x.status)).map((x) => x.song);
  const setlists = plan.setlists.filter((x) => accept(x.status)).map((x) => x.setlist);
  await db.transaction('rw', db.songs, db.setlists, async () => {
    await db.songs.bulkPut(songs);
    await db.setlists.bulkPut(setlists);
  });
  return songs.length + setlists.length;
}

export async function exportAll(): Promise<SharePayload> {
  return {
    app: 'cifras-louvor',
    v: 1,
    songs: await db.songs.toArray(),
    setlists: await db.setlists.toArray(),
  };
}
