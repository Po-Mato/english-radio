import Fastify from "fastify";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const app = Fastify({ logger: true });

const PORT = process.env.PORT || 3000;
const STREAM_DIR = process.env.STREAM_DIR || "/stream";
const ASSET_DIR = process.env.ASSET_DIR || "/assets";
const SCRIPT_DIR = process.env.SCRIPT_DIR || path.resolve(process.cwd(), "../../scripts");
const TTS_LANG = process.env.TTS_LANG || "en";
const TTS_VOICE = process.env.TTS_VOICE || "Samantha"; // macOS say voice

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

function discoverChannelAssets(channelName) {
  const dir = path.join(ASSET_DIR, channelName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.(mp3|m4a|aac|wav)$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function discoverChannelScripts(channelName) {
  const dir = path.join(SCRIPT_DIR, channelName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.txt$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function buildConcatArgs(files, outDir) {
  const filterInputs = [];
  const concatInputs = [];
  files.forEach((file, idx) => {
    filterInputs.push("-i", file);
    concatInputs.push(`[${idx}:a]`);
  });

  const filterComplex = `${concatInputs.join("")}concat=n=${files.length}:v=0:a=1[aout]`;

  return [
    ...filterInputs,
    "-filter_complex", filterComplex,
    "-map", "[aout]",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
    "-f", "hls", "-hls_time", "6", "-hls_list_size", "10",
    "-hls_flags", "delete_segments+append_list",
    "-hls_segment_filename", `${outDir}/seg_%05d.ts`,
    `${outDir}/live.m3u8`
  ];
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed with code ${code}`));
    });
  });
}

async function renderTextToMp3({ txtPath, outMp3Path }) {
  const tempAiff = outMp3Path.replace(/\.mp3$/i, ".aiff");
  const text = fs.readFileSync(txtPath, "utf8").trim();
  if (!text) throw new Error(`Empty script: ${txtPath}`);

  // macOS say -> AIFF
  await runCommand("say", ["-v", TTS_VOICE, "-o", tempAiff, text]);
  // ffmpeg -> mp3
  await runCommand("ffmpeg", ["-y", "-i", tempAiff, "-ar", "44100", "-ac", "2", "-b:a", "128k", outMp3Path]);
  fs.rmSync(tempAiff, { force: true });
}

app.get("/health", async () => ({ ok: true }));
app.get("/channels", async () => ({ ok: true, channels: listChannels() }));

app.get("/assets/channels", async () => {
  if (!fs.existsSync(ASSET_DIR)) return { ok: true, channels: [] };
  const channels = fs.readdirSync(ASSET_DIR)
    .filter((n) => fs.existsSync(path.join(ASSET_DIR, n)) && fs.lstatSync(path.join(ASSET_DIR, n)).isDirectory())
    .map((name) => ({
      name,
      files: discoverChannelAssets(name).map((p) => path.basename(p))
    }));
  return { ok: true, channels };
});

app.get("/scripts/channels", async () => {
  if (!fs.existsSync(SCRIPT_DIR)) return { ok: true, channels: [] };
  const channels = fs.readdirSync(SCRIPT_DIR)
    .filter((n) => fs.existsSync(path.join(SCRIPT_DIR, n)) && fs.lstatSync(path.join(SCRIPT_DIR, n)).isDirectory())
    .map((name) => ({
      name,
      files: discoverChannelScripts(name).map((p) => path.basename(p))
    }));
  return { ok: true, channels };
});

app.post("/tts/build/:name", async (req, reply) => {
  const { name } = req.params;
  const body = req.body || {};
  const overwrite = Boolean(body.overwrite ?? false);

  const scriptFiles = discoverChannelScripts(name);
  if (!scriptFiles.length) {
    return reply.code(400).send({ ok: false, error: `No script files found under scripts/${name}/*.txt` });
  }

  const outDir = path.join(ASSET_DIR, name);
  ensureDir(outDir);

  const built = [];
  for (const txtPath of scriptFiles) {
    const base = path.basename(txtPath, ".txt");
    const mp3Path = path.join(outDir, `${base}.mp3`);
    if (!overwrite && fs.existsSync(mp3Path)) continue;
    await renderTextToMp3({ txtPath, outMp3Path: mp3Path });
    built.push(path.basename(mp3Path));
  }

  return {
    ok: true,
    channel: name,
    built,
    outDir: `assets/${name}`
  };
});

app.post("/channels/:name/start", async (req, reply) => {
  const { name } = req.params;
  const body = req.body || {};
  const singleFile = body.file || null;

  const outDir = channelOutDir(name);
  ensureDir(outDir);
  cleanDir(outDir);

  const existing = channelProcesses.get(name);
  if (existing && !existing.killed) {
    existing.kill("SIGTERM");
    channelProcesses.delete(name);
  }

  let args;

  if (singleFile) {
    const input = path.join(ASSET_DIR, singleFile);
    if (!fs.existsSync(input)) {
      return reply.code(400).send({ ok: false, error: `Audio not found: ${input}` });
    }

    args = [
      "-y", "-re", "-stream_loop", "-1", "-i", input,
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      "-f", "hls", "-hls_time", "6", "-hls_list_size", "10",
      "-hls_flags", "delete_segments+append_list",
      "-hls_segment_filename", `${outDir}/seg_%05d.ts`,
      `${outDir}/live.m3u8`
    ];
  } else {
    const files = discoverChannelAssets(name);
    if (!files.length) {
      return reply.code(400).send({
        ok: false,
        error: `No audio files found. Put mp3 files under assets/${name}/`
      });
    }
    args = ["-y", "-re", ...buildConcatArgs(files, outDir)];
  }

  const ffmpeg = spawn("ffmpeg", args, { stdio: "ignore" });
  channelProcesses.set(name, ffmpeg);
  ffmpeg.on("exit", () => channelProcesses.delete(name));

  return {
    ok: true,
    channel: name,
    manifest: `/stream/${name}/live.m3u8`,
    mode: singleFile ? "single-file-loop" : "playlist-concat"
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
    level: name
  };
});

app.listen({ port: Number(PORT), host: "0.0.0.0" }).then(() => {
  app.log.info(`API running on :${PORT}`);
});
