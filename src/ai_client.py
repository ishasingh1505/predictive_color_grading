import os
import base64
import json
from typing import Dict

import numpy as np
import requests  # you can stub this out in tests if needed


def _encode_image_to_base64(img: np.ndarray) -> str:
    """
    img: float32 in [0,1], shape (H, W, 3)
    returns: base64-encoded PNG string
    """
    from PIL import Image
    import io

    img_u8 = (np.clip(img, 0.0, 1.0) * 255).astype("uint8")
    pil_img = Image.fromarray(img_u8, mode="RGB")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def optimise_tone_colour(lowres_image: np.ndarray,
                         intent_vector: np.ndarray) -> Dict[str, float]:
    """
    Core AI call wrapper.

    Input:
      - lowres_image: np.ndarray float32 [0,1], (H, W, 3)
      - intent_vector: np.ndarray float32, e.g. [Δbrightness, Δcontrast]

    Output (contract is FIXED):
      {
        "brightness": float,   # recommended brightness delta or value
        "contrast": float,     # recommended contrast delta or value
      }

    For now, this can be a STUB that just echoes intent or does something simple.
    Later, you point this to Modal.com or any other server by just changing URL.
    """
    # --- STUB IMPLEMENTATION (no real server yet) ---
    # For now, just echo the user intent as-is:
    d_brightness = float(intent_vector[0])
    d_contrast   = float(intent_vector[1])

    return {
        "brightness": d_brightness,
        "contrast":   d_contrast,
    }

    # ------------- REAL IMPLEMENTATION LATER -------------
    # Example shape for future:
    #
    # api_url = os.environ.get("AI_API_URL")
    # api_key = os.environ.get("AI_API_KEY")
    #
    # payload = {
    #     "image_base64": _encode_image_to_base64(lowres_image),
    #     "intent_vector": intent_vector.tolist(),
    # }
    #
    # headers = {
    #     "Authorization": f"Bearer {api_key}",
    #     "Content-Type": "application/json",
    # }
    #
    # resp = requests.post(api_url, headers=headers, data=json.dumps(payload), timeout=10)
    # resp.raise_for_status()
    # data = resp.json()
    #
    # return {
    #     "brightness": float(data["brightness"]),
    #     "contrast":   float(data["contrast"]),
    # }
