import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Monitor, 
  Smartphone, 
  Server, 
  Sliders, 
  Activity, 
  Wifi, 
  Camera,
  ExternalLink,
  Laptop
} from 'lucide-react';
import TechnicalAnalysis from './components/TechnicalAnalysis';
import WindowsController from './components/WindowsController';
import AndroidView from './components/AndroidView';
import LocalServerGuide from './components/LocalServerGuide';
import CameraTestBench from './components/CameraTestBench';
import { localBus } from './services/localBus';

export default function App() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'windows' | 'android' | 'testbench' | 'server'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash === '#android' || search.includes('android')) {
        return 'android';
      }
    }
    return 'windows';
  });

  const [serverIp, setServerIp] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
      return window.location.hostname;
    }
    return '192.168.15.101';
  });
  const [isAndroidOnline, setIsAndroidOnline] = useState<boolean>(false);

  // Check if opened directly via #android on mobile
  const isStandaloneAndroid = typeof window !== 'undefined' && (window.location.hash === '#android' || window.location.search.includes('mode=android'));

  // Listen to hash changes in real time
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#android') {
        setActiveTab('android');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Monitor REAL Android online status via localBus and server telemetry
  useEffect(() => {
    let lastSeen = 0;

    const unsub = localBus.subscribe((msg) => {
      if (msg.type === 'ANDROID_STATUS') {
        const isOnline = Boolean(msg.payload?.online);
        setIsAndroidOnline(isOnline);
        if (isOnline) lastSeen = Date.now();
      } else if (msg.type === 'SERVER_TELEMETRY') {
        const isOnline = Boolean(msg.payload?.androidOnline);
        setIsAndroidOnline(isOnline);
        if (isOnline) lastSeen = Date.now();
      }
    });

    // Watchdog check every 3s: if no heartbeat in 8s, mark as offline
    const interval = setInterval(() => {
      if (lastSeen > 0 && Date.now() - lastSeen > 8000) {
        setIsAndroidOnline(false);
      }
    }, 3000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (isStandaloneAndroid) {
    return (
      <div className="fixed inset-0 w-full h-full bg-black overflow-hidden flex flex-col z-50">
        <AndroidView serverIp={serverIp} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col">
      {/* Top Application Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                <Camera className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">
                    Sistema Remoto Android-Windows
                  </h1>
                  <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                    · Captura Óptica & Leitura OCR de Tela
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Redmi Note 10S (64MP)</span>
                  <span aria-hidden="true">·</span>
                  <span>Laptop 14" (28cm)</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 font-medium">Rede Local Segura</span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Functional interactive tabs) */}
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'analysis', label: 'Parecer Técnico', icon: ShieldCheck },
                { id: 'windows', label: 'Console Windows 11', icon: Monitor },
                { id: 'android', label: 'Tela Android (PWA)', icon: Smartphone },
                { id: 'testbench', label: 'Bancada Óptica', icon: Laptop },
                { id: 'server', label: 'Servidor Local', icon: Server },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'analysis' && (
          <TechnicalAnalysis />
        )}

        {activeTab === 'windows' && (
          <WindowsController
            serverIp={serverIp}
            onServerIpChange={setServerIp}
            isAndroidOnline={isAndroidOnline}
            onSwitchToAndroidTab={() => setActiveTab('android')}
          />
        )}

        {activeTab === 'android' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <strong className="font-semibold">Modo PWA Android em Execução:</strong> Esta visualização reproduz exatamente o que o Redmi Note 10S exibirá na bancada: tela 100% preta AMOLED com texto cinza-escuro grande (máx 255 caracteres), câmera em prontidão e Wake Lock ativo para não desligar a tela.
              </div>
              <button
                onClick={() => setActiveTab('windows')}
                className="shrink-0 font-semibold text-indigo-700 hover:underline"
              >
                ← Voltar ao Console Windows
              </button>
            </div>
            <AndroidView serverIp={serverIp} />
          </div>
        )}

        {activeTab === 'testbench' && (
          <CameraTestBench
            onPhotoGenerated={() => {}}
            onSwitchToWindowsTab={() => setActiveTab('windows')}
          />
        )}

        {activeTab === 'server' && (
          <LocalServerGuide />
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 mt-auto text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sistema Pessoal de Captura Local & OCR · Rede Local Exclusiva</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Redmi Note 10S (64MP)</span>
            <span>·</span>
            <span>Tesseract.js WebAssembly</span>
            <span>·</span>
            <span>Windows 11 Node.js Hub</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
