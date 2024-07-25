import init, { run_algorithm } from "./../wasm_project/pkg/wasm_project.js";

let animationData = [];
let prev = Date.now();

const play = document.getElementById("play");
const speed = document.getElementById("speed");

async function run() {
  await init();
}
run();

async function runSelectedAlgorithm() {
  const algorithmId = document.getElementById("algorithm").value;
  const numRectangles = document.getElementById("numRectangles").value;
  const fileInput = document.getElementById("fileInput");

  let file;
  if (fileInput.files.length > 0) {
    file = fileInput.files[0];
  } else {
    const response = await fetch("./test/images/parrots.png");
    const blob = await response.blob();
    file = new File([blob], "parrots.png", { type: "image/png" });
  }

  try {
    const imageData = await loadImageData(file);
    let ret = run_algorithm(algorithmId, numRectangles, imageData.width, imageData.height, imageData.data);
    animationData = ret.animation_data;
    document.getElementById("turn").max = ret.max_turn;
    document.getElementById("t_bar").max = ret.max_turn;
    update_t(ret.max_turn);
    play.value = "▶";
  } catch (error) {
    console.log(error);
    document.getElementById("result").innerHTML = "";
  }
}
window.runSelectedAlgorithm = runSelectedAlgorithm;

function loadImageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      };
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function visualize() {
  const t = document.getElementById("turn").value;
  try {
    const svgData = animationData[t];
    document.getElementById("result").innerHTML = svgData;
  } catch (error) {
    console.log(error);
    document.getElementById("result").innerHTML = "";
  }
}
window.visualize = visualize;

function update_t(t) {
  const max_turn = Number(document.getElementById("turn").max);
  const new_turn = Math.min(Math.max(0, t), max_turn);
  document.getElementById("turn").value = new_turn;
  document.getElementById("t_bar").value = new_turn;
  visualize();
}
window.update_t = update_t;

function start_autoplay() {
  if (Number(document.getElementById("turn").value) >= Number(document.getElementById("turn").max)) {
    document.getElementById("turn").value = 0;
  }
  prev = Date.now();
  play.value = "■";
  update_t(document.getElementById("turn").value);
}
window.start_autoplay = start_autoplay;

play.onclick = (event) => {
  if (play.value === "■") {
    play.value = "▶";
  } else {
    start_autoplay();
  }
};

function autoplay() {
  if (play.value === "■") {
    const now = Date.now();
    const s = 5000;
    if ((now - prev) * speed.value >= s) {
      const inc = Math.floor(((now - prev) * speed.value) / s);
      prev += Math.floor((inc * s) / speed.value);
      update_t(Number(document.getElementById("turn").value) + inc);
      if (Number(document.getElementById("turn").value) >= Number(document.getElementById("turn").max)) {
        play.value = "▶";
      }
    }
  }
  requestAnimationFrame(autoplay);
}
autoplay();

document.getElementById("save_png").onclick = (event) => {
  const t = document.getElementById("turn").value;
  const svgData = animationData[t];
  const svgDoc = new DOMParser().parseFromString(svgData, "image/svg+xml");
  const svgElement = svgDoc.documentElement;
  const width = svgElement.getAttribute("width");
  const height = svgElement.getAttribute("height");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const image = new Image();
  image.onload = function () {
    ctx.drawImage(image, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "vis.png";
    a.click();
  };
  image.src = "data:image/svg+xml;charset=utf-8;base64," + btoa(decodeURIComponent(encodeURIComponent(svgData)));
};

document.getElementById("save_gif").onclick = (event) => {
  save_gif.disabled = true;
  save_gif.value = "Generating GIF...";
  const max_turn = Number(document.getElementById("turn").max);
  const step = Math.max(1, Math.round((100 * speed.value) / 5000));
  const delay = (step * 5000) / speed.value;
  const gif = new GIF({
    workers: 2,
    quality: 10,
  });
  gif.on("progress", function (p) {
    save_gif.value = String(Math.round(50 + 50 * p)).padStart(3, " ") + "% finished";
  });
  function add_frame(t) {
    save_gif.value = String(Math.round((50.0 * t) / max_turn)).padStart(3, " ") + "% finished";
    const svgData = animationData[t];
    const svgDoc = new DOMParser().parseFromString(svgData, "image/svg+xml");
    const svgElement = svgDoc.documentElement;
    const width = svgElement.getAttribute("width");
    const height = svgElement.getAttribute("height");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.willReadFrequently = true;
    const image = new Image();
    image.onload = function () {
      ctx.drawImage(image, 0, 0);
      if (t === max_turn) {
        gif.addFrame(canvas, { delay: 3000 });
      } else {
        gif.addFrame(canvas, { delay: delay });
      }
      if (t < max_turn) {
        add_frame(Math.min(t + step, max_turn));
      } else {
        try {
          gif.on("finished", function (blob) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "vis.gif";
            a.click();
            window.URL.revokeObjectURL(a.href);
            save_gif.value = "Save as Animation GIF";
            save_gif.disabled = false;
          });
          gif.render();
        } catch (error) {
          console.error("gif.render() error:", error);
        }
      }
    };
    image.src = "data:image/svg+xml;charset=utf-8;base64," + btoa(decodeURIComponent(encodeURIComponent(svgData)));
  }
  add_frame(0);
};
