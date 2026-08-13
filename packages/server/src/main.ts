// Process entry point: `node dist/main.js`.
import { createServer } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const app = await createServer();
await app.listen({ port, host: '0.0.0.0' });
