// Duplo Quadro: guarda o app e a IA no iPhone para funcionar sem internet
const CACHE = "duplo-quadro-v2";
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const PRECACHE = [
  "./",
  "./index.html",
  MP + "/vision_bundle.mjs",
  MP + "/wasm/vision_wasm_internal.js",
  MP + "/wasm/vision_wasm_internal.wasm",
  MP + "/wasm/vision_wasm_nosimd_internal.js",
  MP + "/wasm/vision_wasm_nosimd_internal.wasm",
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // um arquivo que falhar não impede os outros
    await Promise.all(PRECACHE.map(u => c.add(new Request(u, { mode: u.startsWith("http") ? "cors" : "same-origin" })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isPage = req.mode === "navigate" || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));

  if (isPage) {
    // página: tenta a internet primeiro (pega versões novas), senão usa a guardada
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put("./index.html", res.clone());
        return res;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // IA, fontes e demais arquivos: usa o guardado; se não tiver, baixa e guarda
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      return Response.error();
    }
  })());
});
