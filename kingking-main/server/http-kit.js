/* ============================================================
   Minimal HTTP framework (no dependencies)
   Express-style routes over node:http, JSON bodies, cookie auth,
   and a static file server for public/ and media/.
   ============================================================ */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json'
};

const MAX_BODY = 12 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', part => {
      size += part.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(part);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

function sendFile(res, filePath, status) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (e) {
    return false;
  }
  if (!stat.isFile()) return false;
  res.writeHead(status || 200, {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

/* Each entry maps a URL prefix onto a directory on disk. */
function staticServer(entries) {
  return function serve(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const parsed = new URL(req.url, 'http://localhost');
    const urlPath = decodeURIComponent(parsed.pathname);
    for (const entry of entries) {
      if (urlPath.indexOf(entry.prefix) !== 0) continue;
      const rel = urlPath.slice(entry.prefix.length);
      const root = path.normalize(entry.dir);
      const abs = path.normalize(path.join(root, rel));
      if (abs !== root && abs.indexOf(root + path.sep) !== 0) continue;
      if (sendFile(res, abs, 200)) return true;
      /* A folder is only reachable with its trailing slash — the pages inside
         link their assets relatively, so /pickleball must become /pickleball/. */
      let isDir = false;
      try { isDir = fs.statSync(abs).isDirectory(); } catch (e) { isDir = false; }
      if (!isDir) continue;
      if (urlPath.slice(-1) !== '/') {
        res.writeHead(301, { Location: urlPath + '/' + parsed.search });
        res.end();
        return true;
      }
      if (sendFile(res, path.join(abs, 'index.html'), 200)) return true;
    }
    return false;
  };
}

function Router() {
  const routes = [];
  const add = (method, pattern, handler) => {
    const keys = [];
    const source = pattern.replace(/:[A-Za-z_]+/g, match => {
      keys.push(match.slice(1));
      return '([^/]+)';
    });
    routes.push({ method, regex: new RegExp('^' + source + '$'), keys, handler });
  };
  const router = {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    put: (p, h) => add('PUT', p, h),
    patch: (p, h) => add('PATCH', p, h),
    delete: (p, h) => add('DELETE', p, h),
    match(method, pathname) {
      for (const route of routes) {
        if (route.method !== method) continue;
        const hit = route.regex.exec(pathname);
        if (!hit) continue;
        const params = {};
        route.keys.forEach((k, i) => { params[k] = decodeURIComponent(hit[i + 1]); });
        return { handler: route.handler, params };
      }
      return null;
    }
  };
  return router;
}

/* Pipeline: middlewares -> /api routes -> static files -> SPA shell. */
function serve(router, middlewares, options) {
  const opts = options || {};
  return http.createServer((req, res) => {
    const parsed = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(parsed.pathname);

    const fail = error => {
      if (res.headersSent) return;
      const status = error && error.status ? error.status : 500;
      if (status === 500) console.error(error);
      json(res, status, { ok: false, error: String((error && error.message) || 'Server error') });
    };

    let index = 0;
    const next = err => {
      if (err) return fail(err);
      if (index < middlewares.length) return middlewares[index++](req, res, next);

      if (pathname.indexOf('/api/') === 0) {
        const hit = router.match(req.method, pathname);
        if (!hit) return json(res, 404, { ok: false, error: 'No route for ' + pathname });
        req.params = hit.params;
        req.query = Object.fromEntries(parsed.searchParams.entries());
        return readBody(req).then(raw => {
          req.rawBody = raw;
          try { req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; }
          catch (e) { req.body = {}; }
          return hit.handler(req, res);
        }).catch(fail);
      }

      if (opts.statics && opts.statics(req, res)) return undefined;
      if (opts.shell && req.method === 'GET') {
        if (sendFile(res, opts.shell, 200)) return undefined;
      }
      return json(res, 404, { ok: false, error: 'No route for ' + pathname });
    };

    next();
  });
}

module.exports = { serve, staticServer, Router, json, sendFile, readBody, MIME, MAX_BODY };
