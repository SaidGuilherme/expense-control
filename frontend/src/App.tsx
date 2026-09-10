import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import OverviewPage from './pages/OverviewPage';
import PlansPage from './pages/PlansPage';
import PlanWizardPage from './pages/PlanWizardPage';
import CatalogPage from './pages/CatalogPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/resumo" className="brand">
          <span className="brand-mark" aria-hidden="true">◧</span>
          Controle de Gastos
        </NavLink>

        <nav className="topnav">
          <NavLink to="/resumo">Resumo anual</NavLink>
          <NavLink to="/planejamentos">Planejamentos</NavLink>
          <NavLink to="/cadastros">Cadastros</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/resumo" replace />} />
        <Route path="/resumo" element={<OverviewPage />} />
        <Route path="/planejamentos" element={<PlansPage />} />
        <Route path="/planejamentos/:id" element={<PlanWizardPage />} />
        <Route path="/cadastros" element={<CatalogPage />} />
        <Route path="*" element={<Navigate to="/resumo" replace />} />
      </Routes>
    </div>
  );
}
