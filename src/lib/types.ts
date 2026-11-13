export type SectionType =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'instrumental'
  | 'tag'
  | 'outro'
  | 'other';

export interface Section {
  id: string;
  label: string;
  type: SectionType;
  /** Texto bruto no formato "cifra sobre a letra". */
  content: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  /** Tom original, ex.: "G", "Em", "Bb". */
  key: string;
  bpm?: number;
  beatsPerBar?: number;
  notes?: string;
  sections: Section[];
  /** Ordem padrão das partes (ids de seção; pode repetir). */
  arrangement: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SetlistItem {
  id: string;
  songId: string;
  /** Tom em que será tocada neste repertório (vazio = tom original). */
  key?: string;
  /** Ordem das partes só para este repertório (vazio = ordem padrão da música). */
  arrangement?: string[];
  notes?: string;
}

export interface Setlist {
  id: string;
  name: string;
  /** Data no formato AAAA-MM-DD. */
  date: string;
  notes?: string;
  items: SetlistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface SharePayload {
  app: 'cifras-louvor';
  v: 1;
  setlists: Setlist[];
  songs: Song[];
}
