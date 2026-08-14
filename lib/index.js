/**
 * dsh-foxy-jumpscare — node half.
 *
 * Serves the jumpscare assets and the config file to the browser half so the
 * scare is fully self-hosted (no external URLs, no CORS, no network at the
 * moment of the scare). Registers exact routes under
 * `/plugins/dsh-foxy-jumpscare`:
 *
 *   /plugins/dsh-foxy-jumpscare/config.json
 *   /plugins/dsh-foxy-jumpscare/assets/foxy-jumpscare.webp
 *   /plugins/dsh-foxy-jumpscare/assets/foxy-scream.ogg
 *
 * config.json is the local (gitignored) override; when absent the committed
 * config.example.json is served instead, so the plugin works out of the box.
 * The scare itself lives entirely in lib/client.js.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Cordis plugin name (matches the `id` used in cordis.patch.yml). */
const name = "foxy-jumpscare";
/** Needs the web server service to register the asset/config routes. */
const inject = ["webServer"];

const here = dirname(fileURLToPath(import.meta.url));
/** Package root — one level above lib/. */
const ROOT = join(here, "..");
const PREFIX = "/plugins/dsh-foxy-jumpscare";

/** Exact routes served to the browser half, in priority order (config first). */
const ROUTES = [
  {
    path: `${PREFIX}/config.json`,
    files: [join(ROOT, "config.json"), join(ROOT, "config.example.json")],
    type: "application/json; charset=utf-8",
  },
  {
    path: `${PREFIX}/assets/foxy-jumpscare.webp`,
    files: [join(ROOT, "assets", "foxy-jumpscare.webp")],
    type: "image/webp",
  },
  {
    path: `${PREFIX}/assets/foxy-scream.ogg`,
    files: [join(ROOT, "assets", "foxy-scream.ogg")],
    type: "audio/ogg",
  },
];

/** Build a route handler that streams the first readable file, else 404. */
function makeHandler(files, type) {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    for (const file of files) {
      try {
        const body = await readFile(file);
        res.writeHead(200, {
          "content-type": type,
          "cache-control": "no-cache",
        });
        res.end(body);
        return;
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "EISDIR") throw error;
      }
    }
    res.writeHead(404);
    res.end();
  };
}

function apply(ctx) {
  // dsh 的 ctx.effect 会立即执行回调,并把回调的返回值当作卸载时的清理函数;
  // ctx.webServer.register 返回的 disposer 即该清理函数。
  for (const route of ROUTES) {
    ctx.effect(
      () => ctx.webServer.register({
        kind: "exact",
        path: route.path,
        handler: makeHandler(route.files, route.type),
      }),
      `foxy-jumpscare: serve ${route.path}`,
    );
  }
}

export { apply, inject, name };
