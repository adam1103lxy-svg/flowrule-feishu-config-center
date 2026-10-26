import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import DashboardPage from './pages/dashboard';
import ConnectorsPage from './pages/connectors';
import RulesPage from './pages/rules';
import RuleEditorPage from './pages/rule-editor';
import SimulationPage from './pages/simulation';
import IntegrationPage from './pages/integration';
import AuditPage from './pages/audit';
import SettingsPage from './pages/settings';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="connectors" element={<ConnectorsPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="rules/new" element={<RuleEditorPage />} />
        <Route path="rules/:ruleId/edit" element={<RuleEditorPage />} />
        <Route path="simulation" element={<SimulationPage />} />
        <Route path="integration" element={<IntegrationPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
