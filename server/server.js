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

let lastAndroidSeen = 0;

// Endpoints REST
// 1. Listar fotos salvas ordenadas
app.get('/api/photos', (req, res) => {
  try {
    const files = fs.readdirSync(STORAGE_DIR)
      .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'))
      .map(filename => {
        const stat = fs.statSync(path.join(STORAGE_DIR, filename));
        return {
          id: filename,
          filename,
          url: `/photos/${filename}`,
          timestamp: stat.mtime.toLocaleTimeString('pt-BR', { hour12: false }),
          createdTime: stat.mtime.getTime(),
          sizeBytes: stat.size,
          width: 3840,
          height: 2160,
          focusDistance: 0.28
        };
      })
      .sort((a, b) => b.createdTime - a.createdTime);

    res.json(files);
  } catch {
    res.json([]);
  }
});

// 2. Status de Telemetria e Conexão
app.get('/api/status', (req, res) => {
  const isAndroidAlive = (Date.now() - lastAndroidSeen) < 7000;
  res.json({
    online: true,
    androidConnected: isAndroidAlive,
    clientsCount: clients.size,
    lastAndroidSeen,
    timestamp: Date.now()
  });
});

// 3. Upload de foto capturada pelo Android (suporta FormData multipart E JSON base64)
app.post('/api/upload-photo', (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      console.warn('[UPLOAD WARN]', err);
    }

    let filename = '';
    let sizeBytes = 0;

    if (req.file) {
      filename = req.file.filename;
      sizeBytes = req.file.size;
    } else if (req.body && (req.body.imageBase64 || req.body.photoBase64)) {
      const base64Str = req.body.imageBase64 || req.body.photoBase64;
      const cleanBase64 = base64Str.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = req.body.filename || `CAPT_${timestamp}.jpg`;
      fs.writeFileSync(path.join(STORAGE_DIR, filename), buffer);
      sizeBytes = buffer.length;
    } else {
      return res.status(400).json({ error: 'Nenhum arquivo ou imagem enviado' });
    }

    const photoInfo = {
      id: filename,
      filename,
      url: `/photos/${filename}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
      sizeBytes,
      width: Number(req.body?.width) || 3840,
      height: Number(req.body?.height) || 2160,
      focusDistance: Number(req.body?.focusDistance) || 0.28,
    };

    // Notifica cliente Windows via WebSocket instantaneamente com a URL leve do servidor
    broadcast({
      type: 'PHOTO_READY',
      payload: photoInfo,
      timestamp: Date.now()
    });

    console.log(`[FOTO RECEBIDA] Gravada em disco: ${filename} (${Math.round(sizeBytes / 1024)} KB)`);
    res.json({ success: true, photo: photoInfo });
  });
});

// Criação do servidor HTTP ou HTTPS
let server;
let isHttps = false;
const keyPath = path.join(__dirname, 'cert.key');
const certPath = path.join(__dirname, 'cert.crt');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  server = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  }, app);
  isHttps = true;
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

// Telemetria periódica para os clientes
setInterval(() => {
  const isAndroidAlive = (Date.now() - lastAndroidSeen) < 7000;
  broadcast({
    type: 'SERVER_TELEMETRY',
    payload: {
      androidOnline: isAndroidAlive,
      clientsCount: clients.size,
      lastAndroidSeen
    },
    timestamp: Date.now()
  });
}, 2500);

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log('[WS] Novo cliente conectado da rede local');

  // Envia status imediato ao novo cliente conectado
  if (Date.now() - lastAndroidSeen < 7000) {
    ws.send(JSON.stringify({
      type: 'ANDROID_STATUS',
      payload: { online: true },
      timestamp: Date.now()
    }));
  }

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);

      // Rastreia heartbeat do Android
      if (
        parsed.type === 'HEARTBEAT' || 
        parsed.type === 'ANDROID_STATUS' || 
        (parsed.type === 'PONG' && parsed.payload?.device === 'android') ||
        (parsed.type === 'REGISTER' && parsed.payload?.device === 'android')
      ) {
        lastAndroidSeen = Date.now();
      }

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
  const proto = isHttps ? 'https' : 'http';
  console.log(`======================================================`);
  console.log(`  Servidor Local Android-Windows Rodando! [${proto.toUpperCase()}]`);
  console.log(`  Endereço local Windows: ${proto}://localhost:${PORT}`);
  console.log(`  Acesse no Android:      ${proto}://<SEU_IP_WINDOWS>:${PORT}/#android`);
  console.log(`  Armazenamento de fotos: ${STORAGE_DIR}`);
  console.log(`======================================================`);
});
