// src/PredictiveBranching.jsx
import React, { useState, useRef } from "react";
import { makeEdit, makeHistory, runPredictiveBranch } from "./predictive_core"; // Import the predictive logic

export default function PredictiveBranching() {
  const [baseImageData, setBaseImageData] = useState(null);
  const [aiPreviewUrl, setAiPreviewUrl] = useState(null);
  const [userFutureUrl, setUserFutureUrl] = useState(null);
  const [slideIndex, setSlideIndex] = useState(1);
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
      },
      index: -1,
      label: "Initial State",
      timestamp: Date.now(),
      isCurrent: true,
    },
  ]);
  const hiddenCanvasRef = useRef(null);

  // Handle file input (image upload)
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
    };
    img.src = URL.createObjectURL(file);
  };

  // Handle predictive branch
  const handleRunPredictive = () => {
    if (!baseImageData) {
      alert("Load an image first.");
      return;
    }

    // 1. Calculate a dynamic change or use input (Simulating user moving slider to +20 brightness)
    // currently hardcoded to 194 in your code, let's make it relative to current
    const currentBrightness = history[slideIndex]?.state?.brightness || 100;
    const newBrightness = currentBrightness + 20; // Example: User increased brightness

    // Generate new state for brightness and contrast updates
    const newState = {
      ...history[slideIndex].state,
      brightness: newBrightness,
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

    const newHistoryEntry = {
        state: newState,
        index: history.length,
        label: `Brightness: ${newState.brightness}%`,
        timestamp: Date.now(),
        isCurrent: true,
    };

    // If we are branching from the middle, we might want to slice history or add as a new path
    // For this demo, simply appending:
    const updatedHistory = [...history.slice(0, slideIndex + 1), newHistoryEntry];
    
    setHistory(updatedHistory);
    // Update the slide index to the new tip
    const newSlideIndex = updatedHistory.length - 1;
    setSlideIndex(newSlideIndex);

    // 2. PASS baseImageData explicitly to the core function
    const { aiImage, aiParams, userFutureImage } = runPredictiveBranch(
       updatedHistory, 
       newSlideIndex, 
       baseImageData // <--- IMPORTANT FIX
    );

    console.log("AI params:", aiParams);

    // Convert AI image to data URL
    const aiCanvas = document.createElement("canvas");
    aiCanvas.width = aiImage.width;
    aiCanvas.height = aiImage.height;
    const aiCtx = aiCanvas.getContext("2d");
    aiCtx.putImageData(aiImage, 0, 0);
    setAiPreviewUrl(aiCanvas.toDataURL("image/png"));

    // Convert user future image to data URL
    const ufCanvas = document.createElement("canvas");
    ufCanvas.width = userFutureImage.width;
    ufCanvas.height = userFutureImage.height;
    const ufCtx = ufCanvas.getContext("2d");
    ufCtx.putImageData(userFutureImage, 0, 0);
    setUserFutureUrl(ufCanvas.toDataURL("image/png"));
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
        {aiPreviewUrl && (
          <div>
            <h4>AI Predicted Future</h4>
            <img
              src={aiPreviewUrl}
              alt="AI future"
              style={{ maxWidth: 300, borderRadius: 8 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
