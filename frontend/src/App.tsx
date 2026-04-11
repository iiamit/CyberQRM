import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Notification } from './components/ui/Notification';
import { Dashboard } from './pages/Dashboard';
import { Scenarios } from './pages/Scenarios';
import { ScenarioDetail } from './pages/ScenarioDetail';
import { Controls } from './pages/Controls';
import { Portfolios } from './pages/Portfolios';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/scenarios/new" element={<Scenarios />} />
            <Route path="/scenarios/:id" element={<ScenarioDetail />} />
            <Route path="/controls" element={<Controls />} />
            <Route path="/portfolios" element={<Portfolios />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Notification />
      </div>
    </BrowserRouter>
  );
}
