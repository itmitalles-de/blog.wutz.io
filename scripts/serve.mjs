import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { OUTPUT } from './lib/site.mjs';

const host = process.env.HOST || '127.0.0.1';
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : (process.env.PORT || 4173));
const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8']
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
    let pathname = decodeURIComponent(url.pathname);
    let target = path.resolve(OUTPUT, `.${pathname}`);
    if (!target.startsWith(`${OUTPUT}${path.sep}`) && target !== OUTPUT) throw new Error('invalid path');
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = path.join(target, 'index.html');
    const fileInfo = await stat(target).catch(() => null);
    if (!fileInfo?.isFile()) {
      target = path.join(OUTPUT, '404.html');
      response.statusCode = 404;
    }
    response.setHeader('content-type', types.get(path.extname(target)) || 'application/octet-stream');
    response.setHeader('cache-control', 'no-store');
    if (request.method === 'HEAD') return response.end();
    createReadStream(target).pipe(response);
  } catch {
    response.statusCode = 400;
    response.end('bad request');
  }
});

server.listen(port, host, () => console.log(`preview: http://${host}:${port}`));
