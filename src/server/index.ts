import express from 'express';
import { createServer, getServerPort } from '@devvit/web/server';
import { mountPresenceRoutes } from './routes/presence';
import { mountBlocksRoutes } from './routes/blocks';
import { mountSmartBlocksRoutes } from './routes/smartBlocks';
import { mountPlayerStateRoutes } from './routes/playerState';
import { mountWorldRoutes } from './routes/world';
import { mountInitRoutes } from './routes/init';
import { mountPostRoutes } from './routes/posts';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();
app.use(router);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());

// Mount modular routes
mountInitRoutes(router);
mountPresenceRoutes(router);
mountBlocksRoutes(router);
mountSmartBlocksRoutes(router);
mountPlayerStateRoutes(router);
mountWorldRoutes(router);
mountPostRoutes(router);
