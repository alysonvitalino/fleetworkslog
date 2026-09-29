import { NavLink, Outlet } from 'react-router';
import { ApiStatusBadge } from '../../features/health/ApiStatusBadge';

interface NavItem {
  to: string;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Menu por perfil: o painel web atende TRANSPORTADORA e OPERADOR/ADMIN (docs/07-monorepo.md).
// Quando o login existir (PUTF-26), só a seção do perfil logado será exibida.
const sections: NavSection[] = [
  {
    title: 'Transportadora',
    items: [{ to: '/transportadora', label: 'Visão geral' }],
  },
  {
    title: 'Operação',
    items: [{ to: '/operacao', label: 'Torre de Controle' }],
  },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">fleetworkslog</div>
        <nav>
          {sections.map((section) => (
            <div key={section.title} className="sidebar__section">
              <p className="sidebar__section-title">{section.title}</p>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} className="sidebar__link">
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="app-shell__main">
        <header className="topbar">
          <ApiStatusBadge />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
