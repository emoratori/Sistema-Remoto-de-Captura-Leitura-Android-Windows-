import React, { useState } from 'react';
import { Camera, Sliders, Eye, Sparkles, Check, ArrowRight, Layers, Smartphone, Laptop } from 'lucide-react';
import { generateSyntheticLaptopCapture } from '../data/samplePhotos';
import { savePhoto } from '../services/localBus';
import { CapturedPhoto } from '../types';

interface CameraTestBenchProps {
  onPhotoGenerated: () => void;
  onSwitchToWindowsTab: () => void;
}

export default function CameraTestBench({ onPhotoGenerated, onSwitchToWindowsTab }: CameraTestBenchProps) {
  const [distanceCm, setDistanceCm] = useState<number>(28);
  const [tiltAngle, setTiltAngle] = useState<number>(4);
  const [selectedScene, setSelectedScene] = useState<'code' | 'docs' | 'terminal'>('code');
  const [lastGenerated, setLastGenerated] = useState<CapturedPhoto | null>(null);

  const handleGenerateAndInject = (scene: 'code' | 'docs' | 'terminal') => {
    setSelectedScene(scene);
    const photo = generateSyntheticLaptopCapture(scene);
    photo.focusDistance = distanceCm / 100;
    savePhoto(photo);
    setLastGenerated(photo);
    onPhotoGenerated();
  };

  // Optical calculations based on Redmi Note 10S 26mm eq. sensor (FOV 65° horizontal)
  const fovHorizontalRad = (65 * Math.PI) / 180;
  const capturedWidthCm = Math.round(2 * distanceCm * Math.tan(fovHorizontalRad / 2) * 10) / 10;
  const laptopWidthCm = 30.9;
  const coverageRatio = Math.round((capturedWidthCm / laptopWidthCm) * 100);
  const dofMm = Math.round(distanceCm * 0.9); // approximate depth of field in mm at f/1.8

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          <Smartphone className="w-4 h-4" />
          Bancada de Teste Óptico & Calibração de Distância
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Simulador Físico: Redmi Note 10S vs Tela 14"
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          Teste como a distância focal (25–30 cm), o ângulo de inclinação anti-Moiré (3°–5°) e a resolução de 16MP afetam
          o enquadramento da tela do laptop e a legibilidade das fontes pequenas no OCR antes de fixar o suporte físico.
        </p>
      </div>

      {/* Interactive Controls & Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Sliders & Optical Geometry */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            Parâmetros de Posicionamento Físico
          </h3>

          {/* Distance Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-700">Distância do Celular à Tela:</span>
              <span className="font-mono font-bold text-indigo-600">{distanceCm} cm</span>
            </div>
            <input
              type="range"
              min="15"
              max="40"
              value={distanceCm}
              onChange={(e) => setDistanceCm(parseInt(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>15 cm (Mto Perto)</span>
              <span className="text-emerald-600 font-bold">Faixa Ideal (25–30 cm)</span>
              <span>40 cm (Mto Longe)</span>
            </div>
          </div>

          {/* Tilt Angle Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-700">Inclinação Anti-Moiré (Tilt):</span>
              <span className="font-mono font-bold text-emerald-600">{tiltAngle}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              value={tiltAngle}
              onChange={(e) => setTiltAngle(parseInt(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>0° (Risco Alto de Moiré)</span>
              <span className="text-emerald-600 font-bold">3°–5° (Recomendado)</span>
              <span>15° (Distorção)</span>
            </div>
          </div>

          {/* Optical Metrics Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
            <div className="font-semibold text-slate-800">Diagnóstico Óptico Calculado:</div>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Largura Fotografada:</span>
                <strong className="text-slate-800 font-mono">{capturedWidthCm} cm</strong>
              </div>
              <div className="flex justify-between">
                <span>Largura Tela 14":</span>
                <span className="text-slate-800 font-mono">30.9 cm</span>
              </div>
              <div className="flex justify-between">
                <span>Enquadramento:</span>
                <strong className={coverageRatio >= 100 ? 'text-emerald-600' : 'text-red-600'}>
                  {coverageRatio}% da tela enquadrada ({coverageRatio >= 100 ? 'Cobertura Total' : 'Corta Bordas!'})
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Profundidade de Foco (DoF):</span>
                <span className="text-slate-800 font-mono">±{dofMm} mm</span>
              </div>
            </div>
          </div>

          {/* Quick Scene Injections */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700">
              Disparar Captura Simulada para o Windows:
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleGenerateAndInject('code')}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium text-center"
              >
                Código TypeScript
              </button>
              <button
                onClick={() => handleGenerateAndInject('docs')}
                className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium text-center"
              >
                Documento de Texto
              </button>
              <button
                onClick={() => handleGenerateAndInject('terminal')}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium text-center"
              >
                Log de Terminal
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Diagram of the Physical Setup */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-slate-700" />
                Diagrama Físico do Suporte de Bancada
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Escala Visual 1:1
              </span>
            </div>

            {/* Visual SVG Schema */}
            <div className="w-full h-64 bg-slate-950 rounded-xl p-4 relative overflow-hidden flex items-center justify-center">
              <svg viewBox="0 0 600 240" className="w-full h-full">
                {/* Desk Surface */}
                <line x1="20" y1="210" x2="580" y2="210" stroke="#334155" strokeWidth="2" />
                <text x="30" y="230" fill="#64748b" fontSize="11" fontFamily="sans-serif">Mesa de Trabalho / Bancada Fixa</text>

                {/* Laptop 14" on the left */}
                <rect x="80" y="70" width="16" height="135" fill="#475569" rx="2" />
                <rect x="96" y="75" width="4" height="125" fill="#38bdf8" />
                <rect x="60" y="205" width="120" height="6" fill="#1e293b" rx="2" />
                <text x="65" y="55" fill="#94a3b8" fontSize="12" fontWeight="bold">Laptop 14" (Fonte de Luz)</text>

                {/* Distance arrow */}
                <line x1="105" y1="130" x2={105 + (distanceCm * 7.5)} y2="130" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="105" cy="130" r="3" fill="#10b981" />
                <circle cx={105 + (distanceCm * 7.5)} cy="130" r="3" fill="#10b981" />
                <rect x={105 + (distanceCm * 3.5) - 30} y="112" width="60" height="20" fill="#0f172a" rx="4" />
                <text x={105 + (distanceCm * 3.5)} y="126" fill="#34d399" fontSize="11" fontWeight="bold" textAnchor="middle">{distanceCm} cm</text>

                {/* Smartphone Redmi Note 10S on the right */}
                <g transform={`translate(${105 + (distanceCm * 7.5)}, 70) rotate(${tiltAngle})`}>
                  {/* Stand */}
                  <rect x="18" y="100" width="8" height="35" fill="#64748b" />
                  <rect x="5" y="135" width="34" height="6" fill="#475569" rx="2" />
                  
                  {/* Phone body */}
                  <rect x="0" y="0" width="22" height="135" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.5" rx="4" />
                  {/* AMOLED Screen (facing away or towards laptop) */}
                  <rect x="3" y="10" width="4" height="115" fill="#000000" />
                  {/* Back Camera Lens */}
                  <circle cx="22" cy="30" r="5" fill="#38bdf8" />
                  <circle cx="22" cy="30" r="2" fill="#0284c7" />
                  
                  {/* Charger cable */}
                  <path d="M 11 135 L 11 145 L 30 150" stroke="#f59e0b" strokeWidth="2" fill="none" />
                </g>

                <text x={105 + (distanceCm * 7.5) - 30} y="55" fill="#a5b4fc" fontSize="12" fontWeight="bold">Redmi Note 10S</text>
                <text x={105 + (distanceCm * 7.5) - 20} y="230" fill="#f59e0b" fontSize="10">Cabo de Carga Permanente</text>
              </svg>
            </div>
          </div>

          {/* Action button to test in Windows controller */}
          <div className="pt-4 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {lastGenerated ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Foto "{lastGenerated.filename}" enviada ao histórico!
                </span>
              ) : (
                <span>Clique em um dos botões à esquerda para gerar uma foto de teste.</span>
              )}
            </div>
            <button
              onClick={onSwitchToWindowsTab}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <span>Ver Foto no Console Windows</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
