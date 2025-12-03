import React, { useEffect } from "react";
import PredictiveDemo from "./PredictiveDemo"; // Keep PredictiveDemo component
import { checkModelInputs } from './modelInspector';  // Import the function to inspect the model

function App() {
  // Call checkModelInputs to log the input names of the ONNX model
  useEffect(() => {
    checkModelInputs();  // Run the function to check input names when the app is loaded
  }, []);

  return (
    <div>
      <h1>My Predictive Image Editing App</h1>
      <PredictiveDemo /> {/* Keep PredictiveDemo component */}
    </div>
  );
}

export default App;
