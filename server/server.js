// server.js - Servidor Local Node.js para Windows 11
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

// Servir o frontend React compilado (pasta dist na raiz do projeto)
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Configuração de upload de fotos (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_DIR),
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `CAPT_${timestamp}.jpg`);
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
        url: `/photos/${filename}`,
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
    url: `/photos/${req.file.filename}`,
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    sizeBytes: req.file.size
  };

  // Notifica cliente Windows via WebSocket instantaneamente
  broadcast({
    type: 'PHOTO_READY',
    payload: photoInfo,
    timestamp: Date.now()
  });

  console.log(`[FOTO RECEBIDA] Gravada em disco: ${req.file.filename} (${Math.round(req.file.size / 1024)} KB)`);
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
  console.log(`======================================================`);
  console.log(`  Servidor Local Android-Windows Rodando!`);
  console.log(`  Endereço local Windows: http://localhost:${PORT}`);
  console.log(`  Acesse no Android:      http://<SEU_IP_WINDOWS>:${PORT}`);
  console.log(`  Armazenamento de fotos: ${STORAGE_DIR}`);
  console.log(`======================================================`);
});
