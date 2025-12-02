// src/predictive_core.js

import { applyHdrnetLikeTone } from "./hdrnetLite";
import { scoreTonedImage } from "./aestheticHeuristic";
import { applyLut } from "./lutUtils";

// =========================
// Small helpers
// =========================

function clampByte(x) {
  return x < 0 ? 0 : x > 255 ? 255 : x;
}

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

// =========================
// Edit helpers
// =========================

export function makeEdit(type, params, ai_improvable = true) {
  return { type, params, ai_improvable };
}

// =========================
// Basic tone ops (for full-res application)
// =========================

export function applyBrightness(imageData, value) {
  const out = new ImageData(imageData.width, imageData.height);
  const data = imageData.data;
  const outData = out.data;

  const delta = value * 255;

  for (let i = 0; i < data.length; i += 4) {
    outData[i]     = clampByte(data[i]     + delta);
    outData[i + 1] = clampByte(data[i + 1] + delta);
    outData[i + 2] = clampByte(data[i + 2] + delta);
    outData[i + 3] = data[i + 3];
  }
  return out;
}

export function applyContrast(imageData, value) {
  const out = new ImageData(imageData.width, imageData.height);
  const data = imageData.data;
  const outData = out.data;

  const factor = 1 + value;

  for (let i = 0; i < data.length; i += 4) {
    outData[i]     = clampByte((data[i]     - 128) * factor + 128);
    outData[i + 1] = clampByte((data[i + 1] - 128) * factor + 128);
    outData[i + 2] = clampByte((data[i + 2] - 128) * factor + 128);
    outData[i + 3] = data[i + 3];
  }
  return out;
}

// =========================
// Apply edit sequence (full-res)
// =========================

export function applyEditsSequence(baseImage, edits) {
  let img = baseImage;
  
  // Loop over each edit in the sequence and apply it to the image
  edits.forEach(edit => {
    if (edit.brightness) {
      img = applyBrightness(img, edit.brightness);  // Apply brightness
    }
    if (edit.contrast) {
      img = applyContrast(img, edit.contrast);      // Apply contrast
    }
    if (edit.selectedLUT) {
      img = applyLut(img, edit.selectedLUT, 0.5);  // Apply LUT at 50% strength (for example)
    }
  });

  return img;  // Final processed image
}

// =========================
// History & branching
// =========================

export function makeHistory(baseImageData, edits = []) {
  return { baseImage: baseImageData, edits };
}

export function addEditToHistory(history, edit) {
  history.edits.push(edit);
}

export function renderSlideImage(history, slideIndex) {
  console.log("Rendering image at slideIndex:", slideIndex);
  console.log("History at slideIndex:", history[slideIndex]);

  const base = history[slideIndex]?.state?.baseImage; // Ensure baseImage is part of the state object

  if (!base) {
    console.error("No base image found for slide index:", slideIndex);
    return null; // Return null if base image is missing
  }

  return base;
}



export function getFutureEdits(history, slideIndex) {
  // Support two history shapes:
  // 1) { baseImage, edits: [...] }  (legacy)
  // 2) [ { state: {...} }, { state: {...} }, ... ] (UI-driven)
  if (!history) return [];

  // If history is an object with an edits array, use that
  if (!Array.isArray(history) && Array.isArray(history.edits)) {
    return history.edits.slice(slideIndex + 1);
  }

  // If history is an array, there's no edits array to slice — return empty by default
  if (Array.isArray(history)) {
    // Optionally, attempt to collect edits from entries if they exist
    // but by default return an empty future edits list to avoid crashes.
    console.warn("getFutureEdits: history is array-shaped; returning empty futureEdits");
    return [];
  }

  // Fallback: safe empty
  return [];
}

export function renderOriginalFutureBranch(history, slideIndex) {
  const imgAtSlide = renderSlideImage(history, slideIndex);
  const futureEdits = getFutureEdits(history, slideIndex);
  if (futureEdits.length === 0) {
    return { futureImage: imgAtSlide, futureEdits };
  }
  const futureImage = applyEditsSequence(imgAtSlide, futureEdits);
  return { futureImage, futureEdits };
}

// =========================
// Intent & low-res
// =========================

function extractToneState(edits) {
  if (!Array.isArray(edits)) {
    console.warn("Edits is not an array, defaulting to empty array.");
    edits = []; // Ensure edits is always an array
  }

  let brightness = 0;
  let contrast = 0;
  let lutId = null;
  let lutStrength = 0;

  for (const e of edits) {
    if (e.type === "brightness") {
      brightness = Number(e.params.value || 0);
    } else if (e.type === "contrast") {
      contrast = Number(e.params.value || 0);
    } else if (e.type === "lut") {
      lutId = e.params.id || lutId;
      lutStrength = Number(e.params.strength || 0);
    }
  }

  return { brightness, contrast, lutId, lutStrength };
}


function downscaleImageData(img, maxSize) {
  const src = document.createElement("canvas");
  src.width = img.width;
  src.height = img.height;
  const sctx = src.getContext("2d");
  sctx.putImageData(img, 0, 0);

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const dst = document.createElement("canvas");
  dst.width = w;
  dst.height = h;
  const dctx = dst.getContext("2d");
  dctx.drawImage(src, 0, 0, img.width, img.height, 0, 0, w, h);

  return dctx.getImageData(0, 0, w, h);
}

export function prepareAiInputs(history, slideIndex, lowResMaxSize = 256) {
  // Ensure history is an array and slideIndex is valid
  if (!Array.isArray(history) || history.length === 0) {
    console.error("History is empty or not an array!");
    return {}; // Return an empty object to avoid destructuring errors
  }

  if (slideIndex < 0 || slideIndex >= history.length) {
    console.error("Invalid slideIndex:", slideIndex);
    return {}; // Return an empty object to avoid destructuring errors
  }

  // Retrieve the image at the slideIndex
  const branchFull = renderSlideImage(history, slideIndex);

  if (!branchFull) {
    console.error("Failed to render branch image");
    return {}; // If rendering fails, return empty object
  }

  // Get the edits after the slideIndex (if any)
  const futureEdits = getFutureEdits(history, slideIndex);

  // Get state from history for before (stateS) and after (stateF)
  const stateS = history[slideIndex - 1]?.state || {}; // Before the slide
  const stateF = history[slideIndex]?.state || {}; // After the slide

  // Compute deltas for brightness, contrast, and LUT
  const dB = stateF.brightness - stateS.brightness;
  const dC = stateF.contrast - stateS.contrast;
  const dL = stateF.selectedLUT !== stateS.selectedLUT ? 1 : 0;

  // Downscale the image for low-res processing
  const branchLow = downscaleImageData(branchFull, lowResMaxSize);

  return {
    branchFull,
    branchLow,
    intentVector: [dB, dC, dL],
    futureEdits,
    lutId: stateF.selectedLUT || null,
  };
}




// =========================
// Candidate generation
// =========================

export function generateCandidates(intentVector) {
  const dB = Number(intentVector[0] || 0);
  const dC = Number(intentVector[1] || 0);
  const dL = Number(intentVector[2] || 0); // LUT strength delta

  const brightnessScales = [0.5, 0.75, 1.0, 1.25];
  const contrastScales = [0.5, 0.75, 1.0, 1.25];
  const lutScales = [0.5, 0.75, 1.0, 1.25]; // Modify LUT strength here

  const candidates = [];

  function sameSignOrZero(x, ref, eps = 1e-3) {
    if (Math.abs(ref) < eps) return x;
    if (ref > 0 && x < 0) return 0;
    if (ref < 0 && x > 0) return 0;
    return x;
  }

  for (const sb of brightnessScales) {
    for (const sc of contrastScales) {
      for (const sl of lutScales) {
        let candB = dB * sb;
        let candC = dC * sc;
        let candL = dL * sl;

        // Apply clamping based on LUT, brightness, and contrast constraints
        candB = clamp(candB, -0.5, 0.5);
        candC = clamp(candC, -0.5, 0.5);
        candL = clamp(candL, -0.5, 0.5);

        // Ensure LUT remains consistent with the user's intention (same sign or zero)
        candB = sameSignOrZero(candB, dB);
        candC = sameSignOrZero(candC, dC);
        candL = sameSignOrZero(candL, dL);

        candidates.push({
          brightness: candB,
          contrast: candC,
          lut_strength: candL,  // Now including LUT strength
        });
      }
    }
  }

  // De-duplicate candidates based on brightness, contrast, and LUT strength
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = `${c.brightness.toFixed(4)}_${c.contrast.toFixed(4)}_${c.lut_strength.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }

  return unique;
}

// =========================
// Main scoring – using hdrnetLite + aestheticHeuristic
// =========================

function scoreCandidate(lowresImageData, cand) {
  const { tonedImage, yCurved } = applyHdrnetLikeTone(
    lowresImageData,
    cand.brightness,
    cand.contrast
  );
  return scoreTonedImage(tonedImage, yCurved);
}

// =========================
// Apply chosen params and runPredictiveBranch
// =========================

function applyChosenParams(img, cand, lutId) {
  let out = applyBrightness(img, cand.brightness);
  out = applyContrast(out, cand.contrast);

  if (lutId) {
    const finalStrength = clamp(0.5 + cand.lut_strength, 0, 1);
    out = applyLut(out, lutId, finalStrength);
  }

  return out;
}

/**
 * High-level entry point (client-side):
 * Equivalent of Python run_predictive_branch
 */
export function runPredictiveBranch(history, slideIndex) {
  // provide safe defaults from prepareAiInputs to avoid runtime errors
  const {
    branchFull,
    branchLow,
    intentVector = [0, 0, 0],
    futureEdits = [],
    lutId = null,
  } = prepareAiInputs(history, slideIndex);

  // Guard if images weren't produced
  if (!branchFull || !branchLow) {
    console.error("Missing branch images in runPredictiveBranch");
    return { aiImage: null, aiParams: null, futureEdits: [], userFutureImage: null };
  }

  const dB = Number(intentVector[0] || 0);
  const dC = Number(intentVector[1] || 0);
  const dL = Number(intentVector[2] || 0);

  const userCand = {
    brightness: clamp(dB, -0.5, 0.5),
    contrast: clamp(dC, -0.5, 0.5),
    lut_strength: clamp(dL, -0.5, 0.5),
  };

  const neighbours = generateCandidates(intentVector);
  const candidates = [userCand, ...neighbours];

  let bestIdx = 0;
  let bestScore = -1e9;
  let userScore = null;

  candidates.forEach((cand, idx) => {
    const s = scoreCandidate(branchLow, cand);
    if (idx === 0) userScore = s;
    if (s > bestScore) {
      bestScore = s;
      bestIdx = idx;
    }
  });

  if (userScore === null) userScore = bestScore;

  const IMPROVEMENT_MARGIN = 0.1;
  let chosen = candidates[0];

  if (bestIdx !== 0 && bestScore >= userScore + IMPROVEMENT_MARGIN) {
    chosen = candidates[bestIdx];
  }

  const aiImage = applyChosenParams(branchFull, chosen, lutId);

  const { futureImage: userFutureImage } = renderOriginalFutureBranch(
    history,
    slideIndex
  );

  return {
    aiImage,
    aiParams: {
      brightness: chosen.brightness,
      contrast: chosen.contrast,
      lutStrengthDelta: chosen.lut_strength,
      lutId: lutId || null,
    },
    futureEdits,
    userFutureImage,
  };
}
