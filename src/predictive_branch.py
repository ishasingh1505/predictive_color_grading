import numpy as np
from typing import Dict

from .intent import prepare_ai_inputs
from .ai_client import optimise_tone_colour
from .apply_edits import apply_brightness, apply_contrast


def apply_ai_params_fullres(img, ai_params):
    out = img.copy()
    out = apply_brightness(out, ai_params["brightness"])
    out = apply_contrast(out, ai_params["contrast"])

    # You will integrate real LUT model later.
    # For now, LUT does nothing but code path is ready.
    _ = ai_params.get("lut_strength", 0.0)

    return out



def run_predictive_branch(history, slide_index: int):
    """
    Main pipeline:
       1. Build full-res + low-res + intent
       2. Call AI
       3. Apply AI params to full-res
       4. Return:
          - ai_image_full
          - ai_params
          - future_edits (original user edits after the branch)
    """

    # 1) Prepare inputs
    branch_full, lowres, intent_vec, future_edits, state_S, state_F = prepare_ai_inputs(
        history, slide_index
    )

    # 2) Call AI (stub or real API)
    ai_params = optimise_tone_colour(lowres, intent_vec)

    # 3) Apply AI params to FULL-RES
    ai_image_full = apply_ai_params_fullres(branch_full, ai_params)

    return ai_image_full, ai_params, future_edits
