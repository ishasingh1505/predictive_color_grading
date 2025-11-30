from src.history import EditHistory
from src.edits import Edit, BRIGHTNESS, CONTRAST
from src.predictive_branch import run_predictive_branch
from src.apply_edits import save_image


def build_history():
    hist = EditHistory(base_image_path="example.jpg")
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.2}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.3}))
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.1}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.15}))
    return hist


def main():
    hist = build_history()

    # user selects edit index 1
    slide_index = 1

    ai_full, ai_params, future = run_predictive_branch(hist, slide_index)

    save_image(ai_full, f"ai_from_slide_{slide_index}.jpg")

    print("AI Params:", ai_params)
    print("Future edits:", future)


if __name__ == "__main__":
    main()
