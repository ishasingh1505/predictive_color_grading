// src/PredictiveDemo.jsx
import React, { useState, useRef } from "react";
import * as ort from "onnxruntime-web";

// ------------------------------
// NeurOP ONNX helpers (module-scope)
// ------------------------------

// If neurop_lite.onnx is in public/neurop_lite.onnx:
const MODEL_URL = process.env.PUBLIC_URL + "/neurop_lite.onnx";

let neuropSessionPromise = null;

async function getNeuropSession() {
  if (!neuropSessionPromise) {
    neuropSessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    });
  }
  return neuropSessionPromise;
}

/**
 * Downscale to 256x256, normalize to [-1, 1], NCHW float32 tensor.
 */
function preprocessForNeurOP(fullResImageData) {
  const targetSize = 256;

  // Source canvas with original ImageData
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = fullResImageData.width;
  srcCanvas.height = fullResImageData.height;
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.putImageData(fullResImageData, 0, 0);

  // Downscale into 256x256
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = targetSize;
  tmpCanvas.height = targetSize;
  const tctx = tmpCanvas.getContext("2d");
  tctx.drawImage(
    srcCanvas,
    0,
    0,
    srcCanvas.width,
    srcCanvas.height,
    0,
    0,
    targetSize,
    targetSize
  );

  const lowRes = tctx.getImageData(0, 0, targetSize, targetSize);
  const { data } = lowRes;

  const C = 3;
  const H = targetSize;
  const W = targetSize;
  const hw = H * W;
  const chw = new Float32Array(C * H * W);

  // RGBA (Uint8Clamped) -> NCHW float32 in [-1, 1]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const srcIdx = (y * W + x) * 4;
      const r = data[srcIdx] / 255;
      const g = data[srcIdx + 1] / 255;
      const b = data[srcIdx + 2] / 255;

       // NeurOP expects inputs in [0,1], so keep them as-is
      const rn = r;
      const gn = g;
      const bn = b;

      const base = y * W + x;
      chw[0 * hw + base] = rn;
      chw[1 * hw + base] = gn;
      chw[2 * hw + base] = bn;
    }
  }

  const tensor = new ort.Tensor("float32", chw, [1, 3, H, W]);
  return { tensor, width: W, height: H };
}

/**
 * NCHW float32 (probably [-1,1]) -> ImageData (RGBA, 0..255)
 */
function decodeNeurOPOutput(outputTensor) {
  const dims = outputTensor.dims; // [1,3,256,256]
  const data = outputTensor.data; // Float32Array
  const [N, C, H, W] = dims;

  console.log("ONNX output dims:", dims);
  console.log("Output data length:", data.length);

  const hw = H * W;
  const out = new Uint8ClampedArray(H * W * 4);

  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const base = y * W + x;

      let r = data[0 * hw + base];
      let g = data[1 * hw + base];
      let b = data[2 * hw + base];

      // track range for debugging
      if (r < minVal) minVal = r;
      if (g < minVal) minVal = g;
      if (b < minVal) minVal = b;
      if (r > maxVal) maxVal = r;
      if (g > maxVal) maxVal = g;
      if (b > maxVal) maxVal = b;

      // NeurOP already outputs in [0,1]; just clamp
      r = r < 0 ? 0 : r > 1 ? 1 : r;
      g = g < 0 ? 0 : g > 1 ? 1 : g;
      b = b < 0 ? 0 : b > 1 ? 1 : b;


      const dstIdx = base * 4;
      out[dstIdx] = Math.round(r * 255);
      out[dstIdx + 1] = Math.round(g * 255);
      out[dstIdx + 2] = Math.round(b * 255);
      out[dstIdx + 3] = 255;
    }
  }

  console.log("NeurOP output range approx:", minVal, "to", maxVal);
  return new ImageData(out, W, H);
}

async function runNeuropOnnx(fullResImageData) {
  const session = await getNeuropSession();
  const { tensor } = preprocessForNeurOP(fullResImageData);
  const feeds = { "img.1": tensor }; // modelInspector said input is "img.1"
  const outputs = await session.run(feeds);
  const firstOutput = outputs[session.outputNames[0]];
  return decodeNeurOPOutput(firstOutput); // ImageData 256x256
}

// ------------------------------
// React component
// ------------------------------
export default function PredictiveDemo() {
  const [baseImageData, setBaseImageData] = useState(null);
  const [aiUrl, setAiUrl] = useState(null);
  const [userFutureUrl, setUserFutureUrl] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [history, setHistory] = useState([
    {
      state: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
        opacity: 100,
        sharpen: 0,
        hue: 0,
        selectedLUT: null,
        baseImage: null,
      },
      index: -1,
      label: "Initial State",
      timestamp: Date.now(),
      isCurrent: true,
    },
  ]);

  const hiddenCanvasRef = useRef(null);

  // FILE UPLOAD
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = hiddenCanvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      setBaseImageData(imageData);

      // store base image in last history state
      setHistory((prev) => {
        if (!prev || prev.length === 0) return prev;
        const copy = [...prev];
        const last = { ...copy[copy.length - 1] };
        last.state = { ...last.state, baseImage: imageData };
        copy[copy.length - 1] = last;
        return copy;
      });
    };
    img.src = URL.createObjectURL(file);
  };

  // BUTTON HANDLER – currently: just run NeurOP on base image
  const handleRunPredictive = async () => {
    if (!baseImageData) {
      alert("Load an image first.");
      return;
    }

    try {
      // simple history update, like before
      const newState = {
        ...history[history.length - 1].state,
        brightness: 50,
        contrast: 80,
      };

      const newHistory = [
        ...history,
        {
          state: newState,
          index: history.length,
          label: `Brightness: ${newState.brightness}%`,
          timestamp: Date.now(),
          isCurrent: true,
        },
      ];
      setHistory(newHistory);
      setSlideIndex(newHistory.length - 1);

      const aiImageData = await runNeuropOnnx(baseImageData);

      // AI preview
      const aiCanvas = document.createElement("canvas");
      aiCanvas.width = aiImageData.width;
      aiCanvas.height = aiImageData.height;
      const aiCtx = aiCanvas.getContext("2d");
      aiCtx.putImageData(aiImageData, 0, 0);
      setAiUrl(aiCanvas.toDataURL("image/png"));

      // User future = original (for now)
      const ufCanvas = document.createElement("canvas");
      ufCanvas.width = baseImageData.width;
      ufCanvas.height = baseImageData.height;
      const ufCtx = ufCanvas.getContext("2d");
      ufCtx.putImageData(baseImageData, 0, 0);
      setUserFutureUrl(ufCanvas.toDataURL("image/png"));
    } catch (err) {
      console.error("runPredictiveBranch / NeurOP failed:", err);
      alert("NeurOP inference failed. Check console for details.");
    }
  };

  // RENDER
  return (
    <div style={{ padding: 16 }}>
      <h2>Predictive Branching Demo (Client-side Only)</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      <div style={{ marginTop: 12 }}>
        <label>Slide index (branch point): </label>
        <input
          type="number"
          value={slideIndex}
          min={0}
          max={5}
          onChange={(e) => setSlideIndex(Number(e.target.value))}
        />
      </div>

      <button onClick={handleRunPredictive} style={{ marginTop: 12 }}>
        Run Predictive Branch
      </button>

      <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 24,
          flexWrap: "wrap",
        }}
      >
        {userFutureUrl && (
          <div>
            <h4>User Future (no AI)</h4>
            <img
              src={userFutureUrl}
              alt="User future"
              style={{ maxWidth: 300, borderRadius: 8 }}
            />
          </div>
        )}
        {aiUrl && (
          <div>
            <h4>AI Predicted Future</h4>
            <img
              src={aiUrl}
              alt="AI future"
              style={{ maxWidth: 300, borderRadius: 8 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
