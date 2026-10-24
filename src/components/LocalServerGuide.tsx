import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode, Server, ShieldCheck, Download, ExternalLink } from 'lucide-react';

export default function LocalServerGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const standaloneServerCode = `// server.js - Servidor Local Node.js para Windows 11
// Suporta HTTPS nativo com mkcert, WebSocket em tempo real e armazenamento de fotos em disco

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const STORAGE_DIR = path.join(__dirname, 'Storage');

// Garante pasta de armazenamento de fotos
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir fotos estáticas salvas
app.use('/photos', express.static(STORAGE_DIR));

// Configuração de upload de fotos (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_DIR),
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, \`CAPT_\${timestamp}.jpg\`);
  }
});
const upload = multer({ storage });

// Endpoints REST
// 1. Listar fotos salvas ordenadas
app.get('/api/photos', (req, res) => {
  const files = fs.readdirSync(STORAGE_DIR)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'))
    .map(filename => {
      const stat = fs.statSync(path.join(STORAGE_DIR, filename));
      return {
        id: filename,
        filename,
        url: \`/photos/\${filename}\`,
        timestamp: stat.mtime.toLocaleTimeString('pt-BR'),
        createdTime: stat.mtime.getTime(),
        sizeBytes: stat.size
      };
    })
    .sort((a, b) => b.createdTime - a.createdTime);

  res.json(files);
});

// 2. Upload de foto capturada pelo Android
app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const photoInfo = {
    id: req.file.filename,
    filename: req.file.filename,
    url: \`/photos/\${req.file.filename}\`,
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    sizeBytes: req.file.size
  };

  // Notifica cliente Windows via WebSocket instantaneamente
  broadcast({
    type: 'PHOTO_READY',
    payload: photoInfo,
    timestamp: Date.now()
  });

  console.log(\`[FOTO RECEBIDA] Gravada em disco: \${req.file.filename} (\${Math.round(req.file.size / 1024)} KB)\`);
  res.json({ success: true, photo: photoInfo });
});

// Criação do servidor HTTP ou HTTPS
let server;
const keyPath = path.join(__dirname, 'cert.key');
const certPath = path.join(__dirname, 'cert.crt');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  server = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  }, app);
  console.log('[SECURITY] HTTPS ativado com certificados locais.');
} else {
  server = http.createServer(app);
  console.log('[SECURITY] HTTP simples ativo. Para Chrome Camera/WakeLock, use mkcert ou flags do Chrome.');
}

// Servidor WebSocket integrado
const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log('[WS] Novo cliente conectado da rede local');

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      // Re-encaminha para todos os outros clientes (Windows <-> Android)
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.error('Erro no parser de mensagem WS:', e);
    }
  });

  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`======================================================\`);
  console.log(\`  Servidor Local Android-Windows Rodando!\`);
  console.log(\`  Endereço local Windows: http://localhost:\${PORT}\`);
  console.log(\`  Acesse no Android:      http://<SEU_IP_WINDOWS>:\${PORT}\`);
  console.log(\`  Armazenamento de fotos: \${STORAGE_DIR}\`);
  console.log(\`======================================================\`);
});
`;

  const packageJsonContent = `{
  "name": "local-remote-capture-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "multer": "^1.4.5-lts.1",
    "ws": "^8.18.0"
  }
}`;

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider">
          <Server className="w-4 h-4" />
          Servidor Local Windows 11 (Seção 7 da Especificação)
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Código de Produção & Guia de Inicialização do Servidor
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          O servidor local atua como intermediário assíncrono entre o computador Windows 11 e o Redmi Note 10S.
          Ele gerencia o canal WebSocket para comandos instantâneos, recebe as fotos via multipart stream,
          salva em disco com nomenclatura padronizada e disponibiliza a lista cronológica.
        </p>
      </div>

      {/* 3 Step Setup Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h3 className="text-xs font-bold text-slate-900">Criar Pasta & Instalar Dependências</h3>
          <p className="text-[11px] text-slate-600">
            Crie uma pasta no Windows (ex: <code className="bg-slate-100 px-1 py-0.5 rounded">C:\LocalCapture</code>), salve o <code className="font-mono">server.js</code> e execute:
          </p>
          <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded text-[11px] font-mono overflow-x-auto">
            npm install express ws multer cors
          </pre>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h3 className="text-xs font-bold text-slate-900">Configurar HTTPS com mkcert (Opcional)</h3>
          <p className="text-[11px] text-slate-600">
            Para garantir que a Câmera e o WakeLock abram sem avisos no Chrome do Android:
          </p>
          <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded text-[11px] font-mono overflow-x-auto">
            mkcert -key-file cert.key -cert-file cert.crt 192.168.1.100 localhost
          </pre>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h3 className="text-xs font-bold text-slate-900">Iniciar e Conectar</h3>
          <p className="text-[11px] text-slate-600">
            Execute no PowerShell e abra o IP no navegador do Redmi Note 10S:
          </p>
          <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded text-[11px] font-mono overflow-x-auto">
            node server.js
          </pre>
        </div>
      </div>

      {/* Troubleshooting card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-2 text-amber-900">
        <div className="font-semibold flex items-center gap-1.5 text-amber-800">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          Resolução de Erro no "npm install" (ERESOLVE / esbuild conflict)
        </div>
        <p className="leading-relaxed">
          Se você baixou o projeto completo e teve o erro <code className="bg-white px-1 py-0.5 rounded border border-amber-300 font-mono text-amber-950">ERESOLVE could not resolve peerOptional esbuild</code>, isso ocorre porque o <strong>Vite 8</strong> requer <strong>esbuild 0.28.x</strong>.
        </p>
        <div className="space-y-1 pl-2">
          <div>• <strong>Solução Rápida:</strong> Execute <code className="bg-slate-900 text-emerald-400 px-2 py-0.5 rounded font-mono">npm install --legacy-peer-deps</code></div>
          <div>• <strong>Solução Definitiva no package.json:</strong> No seu <code className="font-mono">package.json</code>, altere <code className="font-mono">"esbuild": "^0.25.0"</code> para <code className="font-mono">"esbuild": "^0.28.2"</code> e execute <code className="font-mono">npm install</code> novamente.</div>
          <div>• <strong>Para o Servidor Local apenas:</strong> Lembre-se que o <code className="font-mono">server.js</code> não precisa do Vite! Em uma pasta separada, instale apenas: <code className="bg-slate-900 text-emerald-400 px-2 py-0.5 rounded font-mono">npm install express ws multer cors</code>.</div>
        </div>
      </div>

      {/* Code Blocks */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold">server.js (Node.js Express + WebSocket Server)</span>
          </div>
          <button
            onClick={() => copyCode(standaloneServerCode, 'serverjs')}
            className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded transition-colors"
          >
            {copiedSection === 'serverjs' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Código</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-4 bg-slate-950 text-slate-300 text-xs font-mono overflow-x-auto max-h-[460px] leading-relaxed">
          {standaloneServerCode}
        </pre>
      </div>

      {/* Package.json Block */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold">package.json</span>
          </div>
          <button
            onClick={() => copyCode(packageJsonContent, 'pkgjson')}
            className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded transition-colors"
          >
            {copiedSection === 'pkgjson' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Código</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-4 bg-slate-950 text-slate-300 text-xs font-mono overflow-x-auto leading-relaxed">
          {packageJsonContent}
        </pre>
      </div>
    </div>
  );
}
