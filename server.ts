import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';

// Storage directory for real captured photos
const STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'photos');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const httpServer = createServer(app);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve captured photos statically
  app.use('/photos', express.static(STORAGE_DIR));

  // REST API: List all saved photos ordered by date
  app.get('/api/photos', (req, res) => {
    try {
      const files = fs.readdirSync(STORAGE_DIR)
        .filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg'))
        .map((filename) => {
          const stat = fs.statSync(path.join(STORAGE_DIR, filename));
          return {
            id: filename,
            filename,
            url: `/photos/${filename}`,
            timestamp: stat.mtime.toLocaleTimeString('pt-BR', { hour12: false }),
            createdTime: stat.mtime.getTime(),
            sizeBytes: stat.size,
          };
        })
        .sort((a, b) => b.createdTime - a.createdTime);
      res.json(files);
    } catch {
      res.json([]);
    }
  });

  // REST API: Health & Telemetry Status
  app.get('/api/status', (req, res) => {
    const isAndroidAlive = (Date.now() - lastAndroidHeartbeat) < 7000 && androidSockets.size > 0;
    res.json({
      online: true,
      androidConnected: isAndroidAlive,
      androidCount: androidSockets.size,
      windowsCount: windowsSockets.size,
      lastAndroidHeartbeat,
      timestamp: Date.now(),
    });
  });

  // REST API: Upload Photo from Android device
  app.post('/api/upload-photo', (req, res) => {
    try {
      const { imageBase64, filename, width, height, focusDistance } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada' });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const now = new Date();
      const timeTag = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
      const fname = filename || `CAPT_${timeTag}.jpg`;
      const filePath = path.join(STORAGE_DIR, fname);

      fs.writeFileSync(filePath, buffer);

      const photoInfo = {
        id: fname,
        filename: fname,
        url: `/photos/${fname}`,
        timestamp: now.toLocaleTimeString('pt-BR', { hour12: false }),
        width: width || 3840,
        height: height || 2160,
        sizeBytes: buffer.length,
        focusDistance: focusDistance || 0.28,
      };

      // Notify all Windows clients immediately!
      broadcastToWindows({
        type: 'PHOTO_READY',
        payload: photoInfo,
        timestamp: Date.now(),
      });

      console.log(`[FOTO SALVA] Gravada no disco com sucesso: ${fname} (${Math.round(buffer.length / 1024)} KB)`);
      res.json({ success: true, photo: photoInfo });
    } catch (e: any) {
      console.error('[ERRO UPLOAD]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Real-time WebSocket Server on /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const androidSockets = new Set<WebSocket>();
  const windowsSockets = new Set<WebSocket>();
  let lastAndroidHeartbeat = 0;

  function broadcastToWindows(data: any) {
    const raw = JSON.stringify(data);
    for (const ws of windowsSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  function broadcastToAndroid(data: any) {
    const raw = JSON.stringify(data);
    for (const ws of androidSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  function broadcastAll(data: any) {
    const raw = JSON.stringify(data);
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  // Periodic Heartbeat check
  setInterval(() => {
    const isAndroidAlive = (Date.now() - lastAndroidHeartbeat) < 7000 && androidSockets.size > 0;
    broadcastAll({
      type: 'SERVER_TELEMETRY',
      payload: {
        androidOnline: isAndroidAlive,
        androidCount: androidSockets.size,
        windowsCount: windowsSockets.size,
        lastAndroidHeartbeat,
      },
      timestamp: Date.now(),
    });
  }, 2000);

  wss.on('connection', (ws) => {
    let role: 'android' | 'windows' | 'unknown' = 'unknown';

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Device Registration
        if (msg.type === 'REGISTER') {
          role = msg.payload?.device;
          if (role === 'android') {
            androidSockets.add(ws);
            lastAndroidHeartbeat = Date.now();
            console.log(`[CONEXÃO] Celular Android Redmi Note 10S conectado! Total: ${androidSockets.size}`);
            broadcastToWindows({
              type: 'ANDROID_STATUS',
              payload: { online: true, capabilities: msg.payload?.capabilities },
              timestamp: Date.now(),
            });
          } else {
            windowsSockets.add(ws);
            console.log(`[CONEXÃO] Console Windows 11 conectado! Total: ${windowsSockets.size}`);
            const isAndroidAlive = (Date.now() - lastAndroidHeartbeat) < 7000 && androidSockets.size > 0;
            ws.send(JSON.stringify({
              type: 'ANDROID_STATUS',
              payload: { online: isAndroidAlive },
              timestamp: Date.now(),
            }));
          }
          return;
        }

        // Heartbeats
        if (msg.type === 'HEARTBEAT' && msg.payload?.device === 'android') {
          lastAndroidHeartbeat = Date.now();
          if (!androidSockets.has(ws)) androidSockets.add(ws);
          return;
        }

        // Forward commands from Windows to Android
        if (
          msg.type === 'TAKE_PHOTO' ||
          msg.type === 'SET_FOCUS' ||
          msg.type === 'AUTO_FOCUS' ||
          msg.type === 'SYNC_TEXT' ||
          msg.type === 'CLEAR_TEXT'
        ) {
          broadcastToAndroid(msg);
          return;
        }

        // Forward responses from Android to Windows
        if (msg.type === 'PHOTO_READY' || msg.type === 'ANDROID_STATUS') {
          if (msg.type === 'ANDROID_STATUS') {
            lastAndroidHeartbeat = Date.now();
          }
          broadcastToWindows(msg);
          return;
        }

        broadcastAll(msg);
      } catch (e) {
        console.error('Erro ao processar mensagem WS:', e);
      }
    });

    ws.on('close', () => {
      androidSockets.delete(ws);
      windowsSockets.delete(ws);
      if (role === 'android') {
        console.log('[CONEXÃO] Celular Android desconectado.');
        broadcastToWindows({
          type: 'ANDROID_STATUS',
          payload: { online: androidSockets.size > 0 },
          timestamp: Date.now(),
        });
      }
    });
  });

  // Mount Vite middlewares in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` Servidor Local Android-Windows Rodando na Porta ${PORT}`);
    console.log(` Console Windows: http://localhost:${PORT}`);
    console.log(` Acesso Android:  http://192.168.15.101:${PORT}/#android`);
    console.log(` Pasta de Fotos:  ${STORAGE_DIR}`);
    console.log(`====================================================`);
  });
}

startServer();
