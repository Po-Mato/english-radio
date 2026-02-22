export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" }
      });
    }

    if (url.pathname.startsWith("/stream/")) {
      const key = url.pathname.replace(/^\//, ""); // stream/...
      const object = await env.AUDIO_BUCKET.get(key);
      if (!object) return new Response("Not found", { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("access-control-allow-origin", "*");
      headers.set("cache-control", "public, max-age=30");

      if (key.endsWith(".m3u8")) {
        headers.set("content-type", "application/vnd.apple.mpegurl");
      } else if (key.endsWith(".ts")) {
        headers.set("content-type", "video/mp2t");
      }

      return new Response(object.body, { headers });
    }

    return new Response("English Radio Worker", { status: 200 });
  }
};
