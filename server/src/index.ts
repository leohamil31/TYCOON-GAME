import { createServer } from 'node:http';
import pg from 'pg';
import { createApp } from './app';
import { BattleHub } from './battle';
import { dbFromPool, migrate } from './db';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Defina DATABASE_URL (ex.: postgres://user:pass@localhost:5432/tycoon).',
  );
  process.exit(1);
}

const db = dbFromPool(new pg.Pool({ connectionString: url }));
await migrate(db);

const battleHub = new BattleHub();
const app = createApp(db, {
  allowSimulatedIap: process.env.ALLOW_SIMULATED_IAP === 'true',
  corsOrigin: process.env.CORS_ORIGIN,
  battleHub,
});
const server = createServer(app);
battleHub.attach(server);
const port = Number(process.env.PORT ?? 3001);
server.listen(port, () =>
  console.log(`Tycoon Game API em http://localhost:${port}`),
);
