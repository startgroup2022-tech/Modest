// cPanel / Passenger entrypoint. `next start` is not used on cPanel because the
// Application Manager launches a single startup file.
const { createServer } = require('http');
const next = require('next');

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port);
});
