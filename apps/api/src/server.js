import Fastify from "fastify";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const app = Fastify({ logger: true });

const PORT = process.env.PORT || 3000;
const STREAM_DIR = process.env.STREAM_DIR || "/stream";
const ASSET_DIR = process.env.ASSET_DIR || "/assets";

/** @type {Map<string, import('node:child_process').ChildProcess>} */
const channelProcesses = new Map();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, f), { force: true, recursive: true });
  }
}

function channelOutDir(name) {
  return path.join(STREAM_DIR, name);
}

function channelManifestPath(name) {
  return path.join(channelOutDir(name), "live.m3u8");
}

function listChannels() {
  if (!fs.existsSync(STREAM_DIR)) return [];
  return fs.readdirSync(STREAM_DIR)
    .filter((n) => fs.existsSync(channelManifestPath(n)))
    .map((name) => ({
      name,
      running: channelProcesses.has(name),
      manifest: `/stream/${name}/live.m3u8`
    }));
}

app.get("/health", async () => ({ ok: true }));

app.get("/channels", async () => ({ ok: true, channels: listChannels() }));

app.post("/channels/:name/start", async (req, reply) => {
  const { name } = req.params;
  const body = req.body || {};
  const file = body.file || "sample.mp3";

  const input = path.join(ASSET_DIR, file);
  if (!fs.existsSync(input)) {
    return reply.code(400).send({ ok: false, error: `Audio not found: ${input}` });
  }

  const outDir = channelOutDir(name);
  ensureDir(outDir);
  cleanDir(outDir);

  const existing = channelProcesses.get(name);
  if (existing && !existing.killed) {
    existing.kill("SIGTERM");
    channelProcesses.delete(name);
  }

  const args = [
    "-y", "-re", "-stream_loop", "-1", "-i", input,
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
    "-f", "hls", "-hls_time", "6", "-hls_list_size", "10",
    "-hls_flags", "delete_segments+append_list",
    "-hls_segment_filename", `${outDir}/seg_%05d.ts`,
    `${outDir}/live.m3u8`
  ];

  const ffmpeg = spawn("ffmpeg", args, { stdio: "ignore" });
  channelProcesses.set(name, ffmpeg);

  ffmpeg.on("exit", () => channelProcesses.delete(name));

  return {
    ok: true,
    channel: name,
    manifest: `/stream/${name}/live.m3u8`
  };
});

app.post("/channels/:name/stop", async (req, reply) => {
  const { name } = req.params;
  const proc = channelProcesses.get(name);

  if (!proc) {
    return reply.code(404).send({ ok: false, error: "Channel not running" });
  }

  proc.kill("SIGTERM");
  channelProcesses.delete(name);
  return { ok: true, channel: name, stopped: true };
});

app.get("/channels/:name/now", async (req) => {
  const { name } = req.params;
  const running = channelProcesses.has(name);
  const manifestExists = fs.existsSync(channelManifestPath(name));

  return {
    channel: name,
    running,
    manifestExists,
    manifest: manifestExists ? `/stream/${name}/live.m3u8` : null,
    trackTitle: running ? "Sample English Lesson" : null,
    sentence: running ? "Welcome to Chunshik English Radio." : null,
    level: "beginner"
  };
});

app.listen({ port: Number(PORT), host: "0.0.0.0" }).then(() => {
  app.log.info(`API running on :${PORT}`);
});
