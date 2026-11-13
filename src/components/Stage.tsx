import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Song } from '../lib/types';
import { FONT_MAX, FONT_MIN, setPrefs, usePrefs } from '../lib/prefs';
import { baseScrollSpeed, useAutoScroll, useWakeLock } from '../lib/hooks';
import { SongBody } from './SongBody';
import { KeyPicker } from './KeyPicker';
import { Icon } from './Icon';

export interface StageEntry {
  id: string;
  song: Song;
  toKey?: string;
  arrangement?: string[];
  notes?: string;
}

interface Props {
  title: string;
  entries: StageEntry[];
  onBack: () => void;
  onKeyChange?: (index: number, key: string) => void;
  actions?: ReactNode;
}

const TOOLBAR_H = 52;

/** Modo de apresentação: todas as músicas em sequência, rolando sem precisar voltar. */
export function Stage({ title, entries, onBack, onKeyChange, actions }: Props) {
  const prefs = usePrefs();
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [showList, setShowList] = useState(false);
  useWakeLock();

  const currentIndex = useCallback(() => {
    const line = TOOLBAR_H + window.innerHeight * 0.3;
    let idx = 0;
    refs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= line) idx = i;
    });
    return idx;
  }, []);

  const speedFor = (i: number) => {
    const song = entries[i]?.song;
    if (!song) return 30;
    const factor = prefs.scrollFactor[song.id] ?? 1;
    return baseScrollSpeed(song.bpm, song.beatsPerBar, prefs.fontSize, prefs.showChords) * factor;
  };

  const { playing, toggle, stop } = useAutoScroll(() => speedFor(currentIndex()));

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCurrent(currentIndex()));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [currentIndex]);

  // Pedal Bluetooth / teclado: espaço = play/pausa, setas/PageDown = avança uma tela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const page = (window.innerHeight - TOOLBAR_H) * 0.75;
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (['PageDown', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        window.scrollBy({ top: page, behavior: 'smooth' });
      } else if (['PageUp', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault();
        window.scrollBy({ top: -page, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const jumpTo = (i: number) => {
    const el = refs.current[i];
    if (el) window.scrollTo({ top: el.offsetTop - TOOLBAR_H, behavior: 'smooth' });
    setShowList(false);
  };

  const currentSong = entries[current]?.song;
  const factor = currentSong ? (prefs.scrollFactor[currentSong.id] ?? 1) : 1;
  const changeFactor = (mult: number) => {
    if (!currentSong) return;
    const next = Math.min(4, Math.max(0.2, Math.round(factor * mult * 100) / 100));
    setPrefs((p) => ({ scrollFactor: { ...p.scrollFactor, [currentSong.id]: next } }));
  };

  const setFont = (d: number) =>
    setPrefs((p) => ({ fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, p.fontSize + d)) }));

  return (
    <div className="stage" style={{ ['--fs' as string]: `${prefs.fontSize}px` }}>
      <header className="toolbar">
        <button className="icon-btn" onClick={() => (stop(), onBack())} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <div className="toolbar-title" onClick={() => entries.length > 1 && setShowList(true)}>
          <strong>{entries.length > 1 ? (currentSong?.title ?? title) : title}</strong>
          {entries.length > 1 && (
            <small>
              {current + 1}/{entries.length} · {title}
            </small>
          )}
        </div>
        <button className="icon-btn" onClick={() => setFont(-2)} aria-label="Diminuir letra">
          <Icon name="textSmall" />
        </button>
        <button className="icon-btn" onClick={() => setFont(2)} aria-label="Aumentar letra">
          <Icon name="textBig" />
        </button>
        <button
          className={`icon-btn${prefs.showChords ? ' on' : ''}`}
          onClick={() => setPrefs({ showChords: !prefs.showChords })}
          aria-label={prefs.showChords ? 'Mostrar só a letra' : 'Mostrar cifras'}
          title={prefs.showChords ? 'Cifra + letra (toque para só letra)' : 'Só letra (toque para cifra)'}
        >
          <Icon name={prefs.showChords ? 'guitar' : 'mic'} />
        </button>
        {entries.length > 1 && (
          <button className="icon-btn" onClick={() => setShowList(true)} aria-label="Lista de músicas">
            <Icon name="list" />
          </button>
        )}
        {actions}
      </header>

      <main className="stage-body">
        {entries.map((e, i) => (
          <article key={e.id} ref={(el) => void (refs.current[i] = el)} className="stage-song">
            <div className="song-head">
              <div className="song-head-title">
                {entries.length > 1 && <span className="num">{i + 1}</span>}
                <div>
                  <h2>{e.song.title}</h2>
                  {e.song.artist && <small className="muted">{e.song.artist}</small>}
                </div>
              </div>
              <div className="song-head-meta">
                {prefs.showChords && onKeyChange && e.song.key ? (
                  <KeyPicker compact originalKey={e.song.key} value={e.toKey} onChange={(k) => onKeyChange(i, k)} />
                ) : (
                  e.song.key && <span className="pill">Tom {e.toKey || e.song.key}</span>
                )}
                {e.song.bpm ? <span className="pill">{e.song.bpm} bpm</span> : null}
              </div>
            </div>
            {e.notes && <p className="item-notes">{e.notes}</p>}
            <SongBody
              song={e.song}
              toKey={e.toKey}
              arrangement={e.arrangement}
              showChords={prefs.showChords}
              showLabels={prefs.showSectionLabels}
            />
          </article>
        ))}
        <div className="stage-end">{entries.length > 1 ? 'Fim do repertório' : ''}</div>
      </main>

      <div className="scroll-ctrl">
        {playing && (
          <>
            <button className="icon-btn" onClick={() => changeFactor(1 / 1.15)} aria-label="Mais devagar">
              <Icon name="minus" />
            </button>
            <span className="speed">{factor.toFixed(2).replace(/\.?0+$/, '')}×</span>
            <button className="icon-btn" onClick={() => changeFactor(1.15)} aria-label="Mais rápido">
              <Icon name="plus" />
            </button>
          </>
        )}
        <button className="fab" onClick={toggle} aria-label={playing ? 'Pausar rolagem' : 'Rolar automaticamente'}>
          <Icon name={playing ? 'pause' : 'play'} size={26} />
        </button>
      </div>

      {showList && (
        <div className="overlay" onClick={() => setShowList(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h2>{title}</h2>
              <button className="icon-btn" onClick={() => setShowList(false)} aria-label="Fechar">
                <Icon name="close" />
              </button>
            </div>
            <ol className="jump-list">
              {entries.map((e, i) => (
                <li key={e.id}>
                  <button className={i === current ? 'on' : ''} onClick={() => jumpTo(i)}>
                    <span className="num">{i + 1}</span>
                    <span className="grow">{e.song.title}</span>
                    <span className="pill">{e.toKey || e.song.key}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
