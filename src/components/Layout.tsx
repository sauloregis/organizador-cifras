import { NavLink, Outlet } from 'react-router-dom';
import { Icon } from './Icon';

export function Layout() {
  return (
    <div className="layout">
      <div className="page">
        <Outlet />
      </div>
      <nav className="bottom-nav">
        <NavLink to="/repertorios">
          <Icon name="list" />
          <span>Repertórios</span>
        </NavLink>
        <NavLink to="/musicas">
          <Icon name="music" />
          <span>Músicas</span>
        </NavLink>
        <NavLink to="/ajustes">
          <Icon name="settings" />
          <span>Ajustes</span>
        </NavLink>
      </nav>
    </div>
  );
}

export function PageHeader({ title, back, children }: { title: string; back?: () => void; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      {back && (
        <button className="icon-btn" onClick={back} aria-label="Voltar">
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      <div className="page-head-actions">{children}</div>
    </header>
  );
}
