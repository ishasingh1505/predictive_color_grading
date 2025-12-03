// src/PredictiveDemo.jsx
import React, { useState, useRef } from "react";
import { makeEdit, makeHistory, runPredictiveBranch } from "./predictive_core"; // Import predictive logic

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
        baseImage: null, // base image will be added here
      },
      index: -1,
      label: "Initial State",
      timestamp: Date.now(),
      isCurrent: true
    }
  ]);
  
  const hiddenCanvasRef = useRef(null);

  // Handle file input change
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

      // Also attach the base image to the latest history entry so predictive_core can find it
      setHistory((prev) => {
        if (!prev || prev.length === 0) return prev;
        const copy = [...prev];
        const last = { ...copy[copy.length - 1] };
        last.state = { ...last.state, baseImage: imageData };  // Update base image in history state
        copy[copy.length - 1] = last;
        return copy;
      });
    };
    img.src = URL.createObjectURL(file);
  };

  const handleRunPredictive = () => {
    if (!baseImageData) {
      alert("Load an image first.");
      return;
    }

    // Create new state after a change in brightness/contrast
    const newState = {
      ...history[history.length - 1].state,
      brightness: 194, // Apply change
      contrast: 100,
      saturation: 100,
      blur: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      opacity: 100,
      sharpen: 0,
      hue: 0,
      selectedLUT: null
    };

    // Build the new history entry and use it immediately (setState is async)
    const newHistory = [
      ...history,
      {
        state: newState,
        index: history.length,
        label: `Brightness: ${newState.brightness}%`,
        timestamp: Date.now(),
        isCurrent: true
      }
    ];

    // Update state with the new history and slide index
    setHistory(newHistory);
    const targetIndex = newHistory.length - 1;
    setSlideIndex(targetIndex);  // Update the slide index to the most recent state

    // Run the predictive logic using the updated history
    let result;
    try {
      result = runPredictiveBranch(newHistory, targetIndex);
    } catch (err) {
      console.error("runPredictiveBranch failed:", err);
      alert("Predictive branch failed. See console for details.");
      return;
    }

    const { aiImage, aiParams, userFutureImage } = result || {};
    console.log("AI params:", aiParams);

    // Convert AI image to data URL (defensive checks)
    if (aiImage && aiImage.data) {
      const aiCanvas = document.createElement("canvas");
      aiCanvas.width = aiImage.width;
      aiCanvas.height = aiImage.height;
      const aiCtx = aiCanvas.getContext("2d");
      aiCtx.putImageData(aiImage, 0, 0);
      setAiUrl(aiCanvas.toDataURL("image/png"));
    } else {
      console.warn("No AI image returned");
      setAiUrl(null);
    }

    // Convert user future image to data URL (defensive checks)
    if (userFutureImage && userFutureImage.data) {
      const ufCanvas = document.createElement("canvas");
      ufCanvas.width = userFutureImage.width;
      ufCanvas.height = userFutureImage.height;
      const ufCtx = ufCanvas.getContext("2d");
      ufCtx.putImageData(userFutureImage, 0, 0);
      setUserFutureUrl(ufCanvas.toDataURL("image/png"));
    } else {
      console.warn("No user future image returned");
      setUserFutureUrl(null);
    }
  };

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

      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
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
