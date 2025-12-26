import { Outlet } from 'react-router-dom';
import { X } from 'lucide-react';
import UnifiedSidebar from './UnifiedSidebar';
import { useDrawer } from '../../context/DrawerContext';

export default function MainLayout() {
  const { isOpen, content, title, closeDrawer } = useDrawer();

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-neutral-300 overflow-hidden">
      <UnifiedSidebar />

      <main className="flex-1 overflow-auto relative flex flex-col min-w-0 canvas-bg">
        <Outlet />
      </main>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:bg-black/20"
          onClick={closeDrawer}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 w-96 bg-neutral-900/80 backdrop-blur-2xl border-l border-white/10 shadow-2xl transform transition-all duration-300 ease-out z-30 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/10 flex-shrink-0 bg-black/20">
          <h3 className="font-semibold text-sm text-white">{title}</h3>
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 animate-slide-in-right">
          {content}
        </div>
      </aside>
    </div>
  );
}
