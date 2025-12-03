import * as ort from 'onnxruntime-web';

export const checkModelInputs = async () => {
  try {
    // Load the ONNX model
    const session = await ort.InferenceSession.create('/models/neurop_lite.onnx');  // Path to ONNX model in public

    // Log the input names
    console.log("Model inputs:", session.inputNames);
  } catch (error) {
    console.error("Error loading the ONNX model:", error);
  }
};
