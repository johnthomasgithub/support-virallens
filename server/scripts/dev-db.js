/**
 * Zero-install local MongoDB for development: `npm run db:dev`
 *
 * Starts mongod on 127.0.0.1:27017 using the binary mongodb-memory-server
 * downloads (no system MongoDB / Docker / admin rights needed). Data persists
 * in server/.mongo-data between runs. Use Atlas or Docker in production.
 */
import { mkdirSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

// If something is already listening on 27017 (an earlier `db:dev`, a local MongoDB
// install or Docker), there's nothing to do — starting a second mongod would fail.
const portInUse = await new Promise((resolve) => {
  const socket = net.connect(27017, '127.0.0.1');
  socket.once('connect', () => socket.end(() => resolve(true)));
  socket.once('error', () => resolve(false));
});
if (portInUse) {
  console.log('[dev-db] A MongoDB server is already running on 127.0.0.1:27017 — you can use it as-is.');
  console.log('[dev-db] (To restart it, stop the existing process first, then run this again.)');
  process.exit(0);
}

const dbPath = fileURLToPath(new URL('../.mongo-data', import.meta.url));
mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' }
});

console.log(`[dev-db] MongoDB running at ${mongod.getUri()}ai-support-agent`);
console.log(`[dev-db] Data directory: ${dbPath}`);
console.log('[dev-db] Press Ctrl+C to stop.');

const shutdown = async () => {
  await mongod.stop({ doCleanup: false }); // keep data on disk
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
