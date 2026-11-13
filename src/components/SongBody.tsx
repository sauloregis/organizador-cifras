import { memo, useMemo } from 'react';
import {
  buildSegments,
  parseLines,
  prefersFlats,
  semitonesBetween,
  tokensToString,
  transposeTokens,
  type Line,
} from '../lib/chords';
import type { Section, Song } from '../lib/types';
import { resolveArrangement } from '../lib/songText';

interface Props {
  song: Song;
  /** Tom em que deve aparecer (vazio = original). */
  toKey?: string;
  arrangement?: string[];
  showChords: boolean;
  showLabels: boolean;
}

/** Corpo da música: seções na ordem do arranjo, já transpostas. */
export const SongBody = memo(function SongBody({ song, toKey, arrangement, showChords, showLabels }: Props) {
  const sections = resolveArrangement(song, arrangement);
  const target = toKey || song.key;
  const semis = semitonesBetween(song.key, target);
  const flats = prefersFlats(target);

  return (
    <div className="song-body">
      {sections.map((s, i) => (
        <SectionView
          key={i}
          section={s}
          semis={semis}
          flats={flats}
          showChords={showChords}
          showLabel={showLabels}
        />
      ))}
    </div>
  );
});

const SectionView = memo(function SectionView({
  section,
  semis,
  flats,
  showChords,
  showLabel,
}: {
  section: Section;
  semis: number;
  flats: boolean;
  showChords: boolean;
  showLabel: boolean;
}) {
  const lines = useMemo(() => {
    const parsed = parseLines(section.content);
    return showChords ? parsed : lyricsOnly(parsed);
  }, [section.content, showChords]);

  if (!showChords && lines.length === 0) return null;

  return (
    <section className={`sec t-${section.type}`}>
      {showLabel && <div className="sec-label">{section.label}</div>}
      <div className="sec-lines">
        {lines.map((line, i) => (
          <LineView key={i} line={line} semis={semis} flats={flats} />
        ))}
      </div>
    </section>
  );
});

function lyricsOnly(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (const l of lines) {
    if (l.kind === 'pair') out.push({ kind: 'lyric', text: l.lyric.trim() });
    else if (l.kind === 'lyric') out.push({ kind: 'lyric', text: l.text.trim() });
    else if (l.kind === 'empty' && out.length && out[out.length - 1].kind !== 'empty') out.push(l);
  }
  while (out.length && out[out.length - 1].kind === 'empty') out.pop();
  return out;
}

function LineView({ line, semis, flats }: { line: Line; semis: number; flats: boolean }) {
  switch (line.kind) {
    case 'empty':
      return <div className="ln empty" />;
    case 'lyric':
      return <div className="ln lyric">{line.text}</div>;
    case 'tab':
      return <div className="ln tab">{line.text}</div>;
    case 'chords':
      return <div className="ln chords">{tokensToString(transposeTokens(line.chords, semis, flats))}</div>;
    case 'pair': {
      const segments = buildSegments(transposeTokens(line.chords, semis, flats), line.lyric);
      return (
        <div className="ln pair">
          {segments.map((seg, i) =>
            seg.type === 'space' ? (
              <span key={i} className="p">
                <span className="c" />
                <span className="l">{seg.text}</span>
              </span>
            ) : (
              <span key={i} className="w">
                {seg.parts.map((p, j) => (
                  <span key={j} className="p">
                    <span className="c">{p.chord ?? ''}</span>
                    <span className="l">{p.text}</span>
                  </span>
                ))}
              </span>
            ),
          )}
        </div>
      );
    }
  }
}
