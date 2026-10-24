import { CapturedPhoto } from '../types';

// Generates high-res canvas test photos simulating a 14" laptop screen photographed from 28 cm
export function generateSyntheticLaptopCapture(scene: 'code' | 'docs' | 'terminal'): CapturedPhoto {
  const canvas = document.createElement('canvas');
  // High resolution: 2560 x 1440 (16:9) simulating 4K/high-res sensor capture
  canvas.width = 2560;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d')!;

  // 1. Dark background with subtle gradient to simulate laptop bezel and viewing angle
  const grad = ctx.createLinearGradient(0, 0, 2560, 1440);
  grad.addColorStop(0, '#0c1017');
  grad.addColorStop(0.5, '#121824');
  grad.addColorStop(1, '#0f141d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2560, 1440);

  // 2. Laptop screen border / simulated bezel
  ctx.fillStyle = '#1e2638';
  ctx.fillRect(100, 80, 2360, 1280);

  // 3. Screen content area
  ctx.fillStyle = scene === 'terminal' ? '#0d1117' : scene === 'docs' ? '#ffffff' : '#1e1e2e';
  ctx.fillRect(110, 90, 2340, 1260);

  // 4. Content rendering with small crisp English text
  if (scene === 'code') {
    // VS Code like header
    ctx.fillStyle = '#181825';
    ctx.fillRect(110, 90, 2340, 60);
    ctx.fillStyle = '#a6adc8';
    ctx.font = '22px "JetBrains Mono", Consolas, monospace';
    ctx.fillText('App.tsx - React & TypeScript High-Resolution Screen Capture (14" Display @ 28cm)', 140, 130);

    // Code lines
    ctx.fillStyle = '#cdd6f4';
    ctx.font = '20px "JetBrains Mono", Consolas, monospace';
    const lines = [
      '// Server-side WebSocket Handler & Camera Stream Protocol',
      'import express from "express";',
      'import { WebSocketServer, WebSocket } from "ws";',
      'import { writeFileSync, existsSync, mkdirSync } from "node:fs";',
      'import path from "node:path";',
      '',
      'interface DevicePacket {',
      '  device: "android" | "windows";',
      '  command: "TAKE_PHOTO" | "SYNC_TEXT" | "FOCUS_SET";',
      '  focusDistance?: number; // Distance in meters (e.g. 0.28m)',
      '  timestamp: number;',
      '  payload?: string;',
      '}',
      '',
      'export function setupLocalServer(port: number = 3000) {',
      '  const app = express();',
      '  const wss = new WebSocketServer({ port: 8080 });',
      '  console.log(`[INFO] Remote camera control server listening on port ${port}`);',
      '  console.log(`[INFO] Android Redmi Note 10S connected via local subnet 192.168.1.105`);',
      '  console.log(`[INFO] Current focal length: 26mm eq. | Target distance: 28.5 cm`);',
      '',
      '  wss.on("connection", (socket: WebSocket) => {',
      '    socket.on("message", (raw) => {',
      '      const packet = JSON.parse(raw.toString()) as DevicePacket;',
      '      if (packet.command === "TAKE_PHOTO") {',
      '        console.log("Triggering 16MP quad-bayer exposure on camera...");',
      '      }',
      '    });',
      '  });',
      '}',
      '',
      '// Small font footnote for OCR testing:',
      '// The quick brown fox jumps over the lazy dog. 1234567890. Latency: 14ms. SNR: 38dB.',
      '// Redmi Note 10S sensor: Samsung GW3 64MP f/1.79 aperture PDAF autofocus enabled.'
    ];

    let y = 190;
    lines.forEach((line) => {
      if (line.startsWith('//')) {
        ctx.fillStyle = '#6c7086'; // comment
      } else if (line.startsWith('import') || line.startsWith('export') || line.startsWith('interface')) {
        ctx.fillStyle = '#cba6f7'; // keyword
      } else if (line.includes('console.log') || line.includes('setupLocalServer')) {
        ctx.fillStyle = '#89b4fa'; // function
      } else {
        ctx.fillStyle = '#cdd6f4'; // normal
      }
      ctx.fillText(line, 140, y);
      y += 34;
    });
  } else if (scene === 'docs') {
    // White background docs
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('API Specification & Technical Requirements', 150, 160);

    ctx.fillStyle = '#334155';
    ctx.font = '22px sans-serif';
    ctx.fillText('Section 4.2 - Optics and Focal Calibration for 14-inch Laptop Display', 150, 210);

    ctx.fillStyle = '#1e293b';
    ctx.font = '20px sans-serif';
    const docLines = [
      'The optical geometry requires positioning the smartphone exactly 25 to 30 cm away from the target screen.',
      'At this distance, a 64-megapixel sensor with a 26mm equivalent focal length captures the entirety',
      'of a 14-inch display (approximately 309 mm x 174 mm active area).',
      '',
      'Key Performance Metrics & Tolerances:',
      '  * Resolution per character: 28-36 pixels for standard 9pt monospace fonts.',
      '  * Optical depth of field (DoF): approximately 2.4 cm at f/1.8 aperture.',
      '  * Minimum contrast threshold: 65% MTF (Modulation Transfer Function) at Nyquist.',
      '  * Anti-Moiré suppression: 5-degree physical tilt recommended to disrupt Bayer grid alignment.',
      '',
      'Remote Procedure Calls (RPC):',
      '  1. POST /api/photo/capture -> Returns unique image identifier with ISO timestamp.',
      '  2. POST /api/display/text  -> Updates dark AMOLED viewport with 255-character payload.',
      '  3. GET  /api/camera/focus  -> Queries hardware AF convergence state.'
    ];

    let y = 260;
    docLines.forEach((l) => {
      ctx.fillText(l, 150, y);
      y += 36;
    });
  } else {
    // Terminal
    ctx.fillStyle = '#22c55e';
    ctx.font = '22px "JetBrains Mono", Consolas, monospace';
    ctx.fillText('administrator@workstation-win11:~$ local-capture-cli --status', 140, 140);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "JetBrains Mono", Consolas, monospace';
    const termLines = [
      '[SYSTEM CHECK] Node.js v20.12.0 running on Windows 11 Enterprise x64',
      '[NETWORK] Listening on 192.168.1.100:3000 (HTTPS TLS 1.3 self-signed via mkcert)',
      '[REMOTE CLIENT] Redmi Note 10S connected from 192.168.1.105 (Keep-alive OK)',
      '[BATTERY] Android battery: 80% (Bypass charging mode active, temperature: 31.4 C)',
      '[WAKE LOCK] Screen wake lock acquired. Screen off timer disabled.',
      '[CAMERA SENSOR] Samsung GW3 64MP -> Stream resolution: 3840x2160 @ 30fps',
      '[STORAGE] Image directory: C:\\LocalCapture\\Storage\\ (34 photos saved today)',
      '[LAST ACTION] Windows sent command: "Tirar foto agora" -> Captured in 182ms',
      '[OCR ENGINE] Ready on client side. Tesseract.js WebAssembly worker initialized.'
    ];

    let y = 200;
    termLines.forEach((l) => {
      ctx.fillText(l, 140, y);
      y += 38;
    });
  }

  // Add subtle synthetic noise/Moiré lines simulating LCD photography
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let y = 90; y < 1350; y += 6) {
    ctx.beginPath();
    ctx.moveTo(110, y);
    ctx.lineTo(2450, y);
    ctx.stroke();
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false });

  return {
    id: `photo-${Date.now()}-${scene}`,
    url: dataUrl,
    timestamp: timeStr,
    filename: `CAPT_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${scene}.jpg`,
    width: 2560,
    height: 1440,
    sizeBytes: Math.round(dataUrl.length * 0.75),
    focusDistance: 0.28,
  };
}
