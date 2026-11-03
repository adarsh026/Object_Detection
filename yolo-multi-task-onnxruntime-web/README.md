# YOLO Multi-Task Web App

A browser-based app for running YOLO ONNX models on images, videos, and a live camera. Inference runs in your browser using ONNX Runtime Web.

## Run on Windows with VS Code

You need Node.js 20.19+ or 22.12+.

1. In VS Code, open the project folder that contains `package.json`. In this workspace, it is `object_detection/yolo-multi-task-onnxruntime-web`.
2. Open **Terminal → New Terminal**.
3. If the terminal is in the outer `object_detection` folder, enter the project folder:

   ```powershell
   cd .\yolo-multi-task-onnxruntime-web
   ```

4. Install dependencies once:

   ```powershell
   corepack yarn@1.22.22 install --frozen-lockfile
   ```

5. Start the app:

   ```powershell
   corepack yarn@1.22.22 dev
   ```

6. Open the **Local** URL printed in the terminal. Keep the terminal open while using the app. Press **Ctrl+C** to stop it.

The folder shortcut `START_PROJECT.bat` can also install missing dependencies and start the app on Windows.

## What the app does

- Detects objects, estimates poses, and creates instance segmentation masks with supported models.
- Accepts JPG and PNG images, MP4 videos, and a live camera.
- Runs locally in the browser. WASM (CPU) is the broadly compatible backend; WebGPU can be used when supported by the browser and device.



## License

The application source is under the MIT License in `LICENSE`. Model files have their own license in `public/models/LICENSE.txt`.
