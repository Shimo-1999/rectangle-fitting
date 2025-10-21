import init, { Store } from "./../wasm/pkg/wasm.js";

// ---------- limits & notice helpers ----------
const LIMITS = {
  IMG_MAX_BYTES: 15 * 1024 * 1024,  // 15MB
  RECT_MAX_INPUT: 5000,
  IMG_MAX_PIXELS: 20_000_000,
  IMG_MAX_SIDE: 8192,
};

// ---------- module-scope state ----------
const state = {
  store: null, // wasm Store
  hasResult: false,
  isPlaying: false,
  prevTime: 0,
  srcSize: null, // { width, height }
};

let els = {}; // DOM refs

window.addEventListener("DOMContentLoaded", async () => {
  await init();

  // cache DOM
  els = {
    notice: document.getElementById("notice"),
    fileInput: document.getElementById("fileInput"),
    algo: document.getElementById("algorithm"),
    numRects: document.getElementById("numRectangles"),
    runBtn: document.getElementById("run"),

    fieldset: document.getElementById("sequenceControls"),
    stage: document.getElementById("stage"),

    // save buttons
    savePng: document.getElementById("save_png"),
    saveGif: document.getElementById("save_gif"),
    saveFrames: document.getElementById("save_frames"),

    // toolbar
    playBtn: document.getElementById("play"),
    tBar: document.getElementById("t_bar"),
    turn: document.getElementById("turn"),
    speed: document.getElementById("speed"),
  };

  // events
  els.fileInput.addEventListener("change", onFileChange);
  els.runBtn?.addEventListener("click", onRunClick);

  els.playBtn.addEventListener("click", togglePlay);
  els.tBar.addEventListener("input", () => seek(Number(els.tBar.value)));
  els.turn.addEventListener("input", () => seek(Number(els.turn.value)));

  // save handlers
  els.savePng.addEventListener("click", onSavePng);
  els.saveGif.addEventListener("click", onSaveGif);
  els.saveFrames.addEventListener("click", onSaveFramesZip);

  state.store = new Store();

  setResultReady(false);
  resetControls();
  requestAnimationFrame(loop);
});

function hasActiveWarn() {
  return !!els.notice?.querySelector(".alert");
}

function syncRunButtonWithWarn() {
  if (els.runBtn) els.runBtn.disabled = hasActiveWarn();
}

function showWarn(msg, variant = "warning") {
  const box = els.notice; if (!box) return;
  box.classList.remove("d-none");
  box.innerHTML = "";
  box.insertAdjacentHTML("beforeend", `
    <div class="alert alert-${variant} alert-dismissible fade show" role="alert">
      <div>${msg}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    </div>
  `);
  syncRunButtonWithWarn();

  const alertEl = box.querySelector(".alert:last-child");
  alertEl?.addEventListener("closed.bs.alert", () => {
    if (!hasActiveWarn()) box.classList.add("d-none");
    syncRunButtonWithWarn();
  });
}

function clearWarn() {
  const box = els.notice; if (!box) return;
  box.innerHTML = "";
  box.classList.add("d-none");
  syncRunButtonWithWarn();
}

// ---------- UI toggles ----------
function setResultReady(on) {
  state.hasResult = on;
  els.fieldset.disabled = !on;
  [els.savePng, els.saveGif, els.saveFrames].forEach(b => {
    b.disabled = !on;
    b.setAttribute("aria-disabled", String(!on));
  });
}

function resetControls() {
  stopPlay();
  els.tBar.min = 1;
  els.tBar.value = 1;
  els.tBar.max = 1;
  els.turn.min = 1;
  els.turn.value = 1;
  els.turn.max = 1;
}

function clearStage() {
  els.stage.innerHTML =
    '<div class="d-flex align-items-center justify-content-center text-secondary small" data-placeholder>' +
    '<i class="bi bi-image" style="font-size: 2rem;"></i></div>';
}

// ---------- event handlers ----------
async function onFileChange() {
  setResultReady(false);
  resetControls();
  clearStage();
  state.store.clear();

  const file = els.fileInput.files?.[0];
  if (!file) {
    clearWarn();
    return;
  }

  if (file.size > LIMITS.IMG_MAX_BYTES) {
    els.fileInput.value = "";
    showWarn(
      `ファイルが大きすぎます（${(file.size/1024/1024).toFixed(1)}MB）。` +
      `上限は ${(LIMITS.IMG_MAX_BYTES/1024/1024)}MB です。`,
      "warning"
    );
    return;
  }

  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width, h = bmp.height;
    bmp.close?.();

    if (Number.isFinite(LIMITS.IMG_MAX_PIXELS)) {
      const px = w * h;
      if (px > LIMITS.IMG_MAX_PIXELS) {
        els.fileInput.value = "";
        showWarn(
          `解像度が大きすぎます（${w}×${h} ≈ ${(px/1e6).toFixed(1)}MP）。` +
          `上限は ${(LIMITS.IMG_MAX_PIXELS/1e6)}MP です。`,
          "warning"
        );
        return;
      }
    }
    if (Number.isFinite(LIMITS.IMG_MAX_SIDE)) {
      const sideMax = LIMITS.IMG_MAX_SIDE;
      if (Math.max(w, h) > sideMax) {
        els.fileInput.value = "";
        showWarn(
          `一辺が大きすぎます（${w}×${h}）。` +
          `上限は ${sideMax}px です。`,
          "warning"
        );
        return;
      }
    }
  } catch (e) {
    els.fileInput.value = "";
    showWarn("画像の読み込みに失敗しました。別のファイルをお試しください。", "danger");
    return;
  }

  clearWarn();
}


async function fetchDefaultAsFile() {
  const resp = await fetch("./assets/images/Parrot.jpg");
  const blob = await resp.blob();
  return new File([blob], "Parrot.jpg", { type: blob.type });
}

async function onRunClick() {
  const file = els.fileInput.files?.[0] ?? await fetchDefaultAsFile();
  await runPipeline(file);
}

// ---------- main pipeline ----------
async function runPipeline(file) {
  stopPlay();
  setResultReady(false);
  resetControls();
  clearStage();
  state.store.clear();
  els.runBtn.disabled = true;
  els.fileInput.disabled = true;

  try {
    const { width, height, rgba } = await decodeToRGBA(file);
    state.srcSize = { width, height };

    const numRects = Number(els.numRects?.value || 1000);
    const algoId = Number(els.algo?.value || 1);

    const rgbaView = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    state.store.init(width, height);
    await state.store.runAlgorithmWithImage(algoId, numRects, rgbaView);

    const stepMax = Number(state.store.stepCount());
    els.tBar.min = 1;
    els.turn.min = 1;
    els.tBar.max = stepMax;
    els.turn.max = stepMax;

    seek(stepMax);
    setResultReady(true);
  } catch (err) {
    console.error(err);
    setResultReady(false);
    resetControls();
    clearStage();
    state.store.clear();
  } finally {
    els.runBtn.disabled = false;
    els.fileInput.disabled = false;
  }
}

// ---------- decode ----------
async function decodeToRGBA(file) {
  const bmp = await createImageBitmap(file);
  const w = bmp.width, h = bmp.height;

  let ctx;
  if (typeof OffscreenCanvas !== "undefined") {
    const cvs = new OffscreenCanvas(w, h);
    ctx = cvs.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
  } else {
    const cvs = document.createElement("canvas");
    cvs.width = w; cvs.height = h;
    ctx = cvs.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
  }
  const { data } = ctx.getImageData(0, 0, w, h);
  bmp.close?.();
  return { width: w, height: h, rgba: data };
}

// ---------- render / seek ----------
function seek(step) {
  const max = Number(els.tBar.max) || 1;
  const min = Number(els.tBar.min) || 1;
  const clamped = Math.max(min, Math.min(Number(step), max));
  els.tBar.value = clamped;
  els.turn.value = clamped;
  renderStep(clamped);
}

function renderStep(step) {
  if (!state.store) return;
  const svg = state.store.visSvg(step);
  els.stage.innerHTML = svg;
}

// ---------- play loop ----------
function togglePlay() {
  state.isPlaying = !state.isPlaying;
  els.playBtn.innerHTML = state.isPlaying
    ? '<i class="bi bi-pause-fill"></i>'
    : '<i class="bi bi-play-fill"></i>';

  if (state.isPlaying) {
    if (Number(els.turn.value) >= Number(els.turn.max)) {
      seek(1);
    }
    state.prevTime = performance.now();
  }
}

function stopPlay() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  els.playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
}

function loop(now) {
  if (state.isPlaying && state.hasResult) {
    const fps = Number(els.speed.value || 100);
    const interval = 1000 / Math.max(1, fps); // ms/step

    const dt = now - state.prevTime;
    const steps = Math.floor(dt / interval);
    if (steps > 0) {
      state.prevTime = now - (dt % interval);

      const max = Number(els.turn.max) || 0;
      const next = Math.min(Number(els.turn.value) + steps, max);

      seek(next);
      if (next >= max) stopPlay();
    }
  }
  requestAnimationFrame(loop);
}

// ========== Save （PNG / GIF） ==========

async function onSavePng() {
  if (!state.store || !state.hasResult) return;
  try {
    const step = Number(els.turn.value) || 0;
    const svg = state.store.visSvg(step);

    const { canvas } = await svgToCanvas(svg, { scale: 1, background: "#ffffff" });
    const blob = await canvasToBlob(canvas, "image/png");
    downloadBlob(blob, makeFileName("png"));
  } catch (e) {
    console.error(e);
  }
}

async function onSaveGif() {
  if (!state.store || !state.hasResult) return;
  if (typeof GIF === "undefined") {
    alert("GIF エンコード用の gif.js が読み込まれていません。");
    return;
  }
  stopPlay();

  const btn = els.saveGif;
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> GIF 作成中…';

  try {
    const max = Number(els.turn.max) || 0;

    const uiFps = Number(els.speed.value || 30);
    const speedValue = Math.pow(1.2, uiFps / 10);
    const step = Math.max(1, Math.round(100 * speedValue / 2000));
    const delay = Math.round((step * 2000) / speedValue);
    const lastDelay = 3000;

    const firstSvg = state.store.visSvg(1);
    const { canvas } = await svgToCanvas(firstSvg, { background: "#ffffff" });

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: "./vendor/gif.worker.js",
    });

    gif.on("progress", p => { btn.innerHTML = `GIF ${Math.round(p * 100)}%`; });

    const addFrame = async (s, d) => {
      const svg = state.store.visSvg(s);
      await drawSvgOntoCanvas(svg, canvas, { background: "#ffffff" });
      gif.addFrame(canvas, { copy: true, delay: d });
    };

    for (let s = 1; s <= max; s += step) {
      await addFrame(s, delay);
      btn.innerHTML = `GIF ${Math.round(50 * (s / Math.max(1, max)))}%`;
    }
    await addFrame(max, lastDelay);

    await new Promise(resolve => {
      gif.on("finished", blob => { downloadBlob(blob, makeFileName("gif")); resolve(); });
      gif.render();
    });

  } catch (e) {
    console.error(e);
  } finally {
    btn.disabled = false; btn.innerHTML = origHTML;
  }
}

async function svgToCanvas(svgString, { scale = 1, background = null } = {}) {
  const size = parseSvgSize(svgString) || state.srcSize || { width: 800, height: 600 };
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;

  await drawSvgOntoCanvas(svgString, canvas, { background });
  return { canvas };
}

async function drawSvgOntoCanvas(svgString, canvas, { background = null } = {}) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  try {
    const bmp = await createImageBitmap(blob);
    const ctx = canvas.getContext("2d");
    if (background) {
      ctx.save();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return;
  } catch (e) {
    console.warn("createImageBitmap failed; falling back to <img>", e);
  }

  const url = URL.createObjectURL(blob);
  try {
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        if (background) {
          ctx.save();
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}


function parseSvgSize(svgString) {
  const m = svgString.match(/viewBox\s*=\s*["']\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (m) return { width: Number(m[1]), height: Number(m[2]) };
  const mw = svgString.match(/width\s*=\s*["']\s*([\d.]+)\s*["']/i);
  const mh = svgString.match(/height\s*=\s*["']\s*([\d.]+)\s*["']/i);
  if (mw && mh) return { width: Number(mw[1]), height: Number(mh[1]) };
  return null;
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function makeFileName(ext) {
  const base = (els.fileInput.files?.[0]?.name || "rectangle-fitting").replace(/\.[^.]+$/, "");
  const t = new Date();
  const ts = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}_${String(t.getHours()).padStart(2, "0")}${String(t.getMinutes()).padStart(2, "0")}${String(t.getSeconds()).padStart(2, "0")}`;
  return `${base}_${ts}.${ext}`;
}

async function onSaveFramesZip() {
  if (!state.store || !state.hasResult) return;
  stopPlay();

  const btn = els.saveFrames;
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> 画像を書き出し中…';

  try {
    const max = Number(els.turn.max) || 1;
    const firstSvg = state.store.visSvg(1);
    const { canvas } = await svgToCanvas(firstSvg, { background: "#fff" });
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    const zip = new window.JSZip();
    const folder = zip.folder("frames");

    // filename: frame_0001.png
    const pad = String(max).length;

    for (let s = 1; s <= max; s++) {
      const svg = state.store.visSvg(s);
      await drawSvgOntoCanvas(svg, canvas, { background: "#fff" });
      const blob = await canvasToBlob(canvas, "image/png");
      const filename = `frame_${String(s).padStart(pad, "0")}.png`;
      folder.file(filename, blob);
      if (s % Math.ceil(max / 20) === 0 || s === max) {
        btn.innerHTML = `書き出し中… ${Math.round((s / max) * 100)}%`;
        await new Promise(r => setTimeout(r));
      }
    }

    btn.innerHTML = "ZIP を作成中…";
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }, (meta) => {
      // btn.innerHTML = `ZIP ${Math.round(meta.percent)}%`;
    });

    downloadBlob(zipBlob, makeFileName("zip"));
    btn.innerHTML = origHTML;
  } catch (e) {
    console.error(e);
    btn.innerHTML = origHTML;
  } finally {
    btn.disabled = false;
  }
}