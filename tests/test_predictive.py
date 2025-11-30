import numpy as np
from src.history import EditHistory
from src.edits import Edit, BRIGHTNESS, CONTRAST
from src.predictive_branch import run_predictive_branch

def test_predictive_basic():
    hist = EditHistory(base_image_path="example.jpg")
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.2}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.3}))
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.1}))

    ai_img, ai_params, fut = run_predictive_branch(hist, 1)

    assert isinstance(ai_params, dict)
    assert "brightness" in ai_params
    assert "contrast" in ai_params

    assert ai_img is not None
    assert len(fut) >= 0
