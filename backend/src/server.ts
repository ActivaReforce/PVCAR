import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './config/db.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 PVCAR API escuchando en :${env.PORT} (${env.NODE_ENV})`);
  console.log(`   Health: http://localhost:${env.PORT}/api/v1/health`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recibido, cerrando...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  // Forzar salida si no cierra en 10s.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
