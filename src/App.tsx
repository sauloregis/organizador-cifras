import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { usePrefs } from './lib/prefs';
import { Layout } from './components/Layout';
import { SongsPage } from './pages/SongsPage';
import { SongEditPage } from './pages/SongEditPage';
import { SongViewPage } from './pages/SongViewPage';
import { SetlistsPage } from './pages/SetlistsPage';
import { SetlistEditPage } from './pages/SetlistEditPage';
import { PlayPage } from './pages/PlayPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { theme } = usePrefs();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#14161c' : '#f7f5f0');
  }, [theme]);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/repertorios" replace />} />
          <Route path="/repertorios" element={<SetlistsPage />} />
          <Route path="/repertorios/:id" element={<SetlistEditPage />} />
          <Route path="/musicas" element={<SongsPage />} />
          <Route path="/musicas/nova" element={<SongEditPage />} />
          <Route path="/musicas/:id/editar" element={<SongEditPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="/importar" element={<ImportPage />} />
        </Route>
        <Route path="/musicas/:id" element={<SongViewPage />} />
        <Route path="/repertorios/:id/tocar" element={<PlayPage />} />
        <Route path="*" element={<Navigate to="/repertorios" replace />} />
      </Routes>
    </HashRouter>
  );
}
