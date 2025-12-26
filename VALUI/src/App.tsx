import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DrawerProvider } from './context/DrawerContext';
import MainLayout from './components/Layout/MainLayout';
import Home from './pages/Home';
import ValueCanvas from './pages/ValueCanvas';
import ImpactCascade from './pages/ImpactCascade';
import AgentDashboard from './pages/AgentDashboard';
import ROICalculator from './pages/ROICalculator';
import ConversationalAI from './pages/ConversationalAI';

function App() {
  return (
    <BrowserRouter>
      <DrawerProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="canvas" element={<ValueCanvas />} />
            <Route path="cascade" element={<ImpactCascade />} />
            <Route path="dashboard" element={<AgentDashboard />} />
            <Route path="calculator" element={<ROICalculator />} />
            <Route path="agents" element={<ConversationalAI />} />
            <Route path="settings" element={<div className="flex-1 flex items-center justify-center text-white">Settings Page (Coming Soon)</div>} />
            <Route path="help" element={<div className="flex-1 flex items-center justify-center text-white">Help Page (Coming Soon)</div>} />
          </Route>
        </Routes>
      </DrawerProvider>
    </BrowserRouter>
  );
}

export default App;
