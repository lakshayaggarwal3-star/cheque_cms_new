# YOLO Detector Standalone UI

This is a standalone React application for real-time object detection using YOLOv8/v11 TFLite models.

## Prerequisites
- Node.js installed

## How to Run
1. Open a terminal in this directory (`yolo_detect`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:3000`.

## Model Information
The application is pre-configured to load the local TFLite models:
- `yolo26n-seg_float16.tflite` (Optimized for speed)
- `yolo26n-seg_float32.tflite` (Optimized for accuracy)

## Fixes Applied
- **TFLite Support**: Switched from `tf.loadGraphModel` to `@tensorflow/tfjs-tflite` which is required for `.tflite` files.
- **WASM Path**: Configured the TFLite runtime to load necessary WASM binaries from a CDN.
- **Inference Logic**: Updated the output parsing to handle YOLOv8/v11's specific output format (transposed tensors).
- **Standalone Setup**: Added `package.json`, `vite.config.js`, `index.html`, and `main.jsx` to make it a complete runnable project.
- **UI Enhancement**: Improved the design with a premium "YOLO Vision Pro" aesthetic, live webcam support, and confidence controls.
