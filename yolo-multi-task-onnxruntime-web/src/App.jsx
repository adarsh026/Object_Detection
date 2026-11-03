import { useEffect, useRef, useState, useCallback } from "react";
import classes from "./utils/yolo_classes.json";
import { renderOverlay } from "./utils/render-overlay";

// Hooks
import { useInferenceWorker } from "./hooks/useInferenceWorker";
import { useWebcam } from "./hooks/useWebcam";
import { useVideoProcessWorker } from "./hooks/useVideoProcessWorker";

// Components
import SettingsPanel from "./components/SettingsPanel";
import ImageDisplay from "./components/ImageDisplay";
import ControlButtons from "./components/ControlButtons";
import ModelStatus from "./components/ModelStatus";
import ResultsTable from "./components/ResultsTable";

const DEFAULT_MODEL_CONFIG = {
  inputShape: [1, 3, 640, 640],
  overlaySize: [640, 640],
  iouThreshold: 0.35,
  scoreThreshold: 0.45,
  backend: "wasm",
  numThreads: 1,
  enableNMS: true,
  model: "yolo11n",
  modelPath: "",
  task: "detect",
  imgszType: "dynamic",
  classes: classes,
};

function App() {
  // --- State ---
  const [processingStatus, setProcessingStatus] = useState({
    warnUpTime: 0,
    inferenceTime: 0,
    statusMsg: "Model not loaded",
    statusColor: "inherit",
  });

  const [customModels, setCustomModels] = useState([]);
  const [customClasses, setCustomClasses] = useState([]);
  const [imgSrc, setImgSrc] = useState(null);
  const [details, setDetails] = useState([]);
  const [activeFeature, setActiveFeature] = useState(null); // null, 'video', 'image', 'camera', 'loading'

  // --- Refs ---
  const modelConfigRef = useRef(DEFAULT_MODEL_CONFIG);
  const cameraSelectorRef = useRef(null);

  const imgRef = useRef(null);
  const overlayRef = useRef(null);
  const cameraRef = useRef(null);
  const fileImageRef = useRef(null);
  const fileVideoRef = useRef(null);
  const activeFeatureRef = useRef(activeFeature);
  const isProcessingRef = useRef(false);

  // Sync activeFeatureRef
  useEffect(() => {
    activeFeatureRef.current = activeFeature;
  }, [activeFeature]);

  // --- Callbacks for Workers ---

  const handleInferenceResult = useCallback((data) => {
    // Determine context for drawing
    const overlayCtx = overlayRef.current?.getContext("2d");
    if (!overlayCtx) return;

    // Clear and draw
    overlayCtx.clearRect(
      0,
      0,
      overlayCtx.canvas.width,
      overlayCtx.canvas.height,
    );

    renderOverlay(
      data.results,
      data.maskImageData,
      overlayCtx,
      DEFAULT_MODEL_CONFIG.task,
      DEFAULT_MODEL_CONFIG.classes,
    );

    setDetails(data.results);
    setProcessingStatus((prev) => ({
      ...prev,
      inferenceTime: data.inferenceTime,
      statusMsg: "Inference complete",
      statusColor: "green",
    }));

    // Mark processing as done so loop can continue
    isProcessingRef.current = false;
  }, []);

  const handleModelLoaded = useCallback((data) => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: data.msg,
      statusColor: "green",
      warnUpTime: data.loadTime,
    }));
    setActiveFeature(null);
  }, []);

  const handleModelLoadError = useCallback((data) => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: data.msg,
      statusColor: "red",
    }));
    setActiveFeature(null);
  }, []);

  const handleVideoStatusKey = useCallback((msg) => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: msg,
      statusColor: "blue",
    }));
  }, []);

  const handleVideoComplete = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "processed_video.mp4";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: "Video complete · download started",
      statusColor: "green",
    }));
    setActiveFeature(null);
  }, []);

  const handleVideoError = useCallback((message) => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: message,
      statusColor: "red",
    }));
    setActiveFeature(null);
  }, []);

  // --- Hooks ---

  const { postMessage: postInferenceMessage } = useInferenceWorker({
    onModelLoaded: handleModelLoaded,
    onResult: handleInferenceResult,
    onError: handleModelLoadError,
  });

  const { cameras, getCameras, openCamera, closeCamera, cameraStatus } =
    useWebcam(cameraRef);

  // Sync camera status to processing status
  useEffect(() => {
    if (cameraStatus.msg) {
      setProcessingStatus((prev) => ({
        ...prev,
        statusMsg: cameraStatus.msg,
        statusColor: cameraStatus.color,
      }));
    }
  }, [cameraStatus]);

  const { processVideo } = useVideoProcessWorker({
    onStatusUpdate: handleVideoStatusKey,
    onComplete: handleVideoComplete,
    onError: handleVideoError,
  });

  // --- Logic ---

  const loadModel = useCallback(async () => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: "Loading model...",
      statusColor: "blue",
    }));
    setActiveFeature("loading");

    const customModel = customModels.find(
      (model) => model.url === DEFAULT_MODEL_CONFIG.model,
    );

    const modelPath = customModel
      ? customModel.url
      : `${import.meta.env.BASE_URL}models/${DEFAULT_MODEL_CONFIG.model}-${DEFAULT_MODEL_CONFIG.task}.onnx`;

    DEFAULT_MODEL_CONFIG.modelPath = modelPath;

    postInferenceMessage({
      type: "LOAD_MODEL",
      config: DEFAULT_MODEL_CONFIG,
    });
  }, [customModels, postInferenceMessage]);

  const imageLoad = useCallback(async () => {
    if (!imgRef.current) return;
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: "Processing image...",
      statusColor: "blue",
    }));
    overlayRef.current.width = imgRef.current.naturalWidth;
    overlayRef.current.height = imgRef.current.naturalHeight;

    DEFAULT_MODEL_CONFIG.overlaySize = [
      overlayRef.current.width,
      overlayRef.current.height,
    ];

    const bitmap = await createImageBitmap(imgRef.current);
    postInferenceMessage(
      {
        type: "INFERENCE",
        config: DEFAULT_MODEL_CONFIG,
        bitmap: bitmap,
      },
      [bitmap],
    );
  }, [postInferenceMessage]);

  // Initial load
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Camera Loop
  const startCameraLoop = useCallback(() => {
    const loop = async () => {
      if (activeFeatureRef.current !== "camera") return;

      if (
        !isProcessingRef.current &&
        cameraRef.current &&
        cameraRef.current.readyState >= 2
      ) {
        isProcessingRef.current = true;

        // Create bitmap from camera
        try {
          const bitmap = await createImageBitmap(cameraRef.current);

          // Adjust overlay size if needed
          if (
            overlayRef.current.width !== cameraRef.current.videoWidth ||
            overlayRef.current.height !== cameraRef.current.videoHeight
          ) {
            overlayRef.current.width = cameraRef.current.videoWidth;
            overlayRef.current.height = cameraRef.current.videoHeight;
          }

          DEFAULT_MODEL_CONFIG.overlaySize = [
            overlayRef.current.width,
            overlayRef.current.height,
          ];

          postInferenceMessage(
            {
              type: "INFERENCE",
              config: DEFAULT_MODEL_CONFIG,
              bitmap: bitmap,
            },
            [bitmap],
          );
        } catch (e) {
          console.error("Frame capture error:", e);
          isProcessingRef.current = false;
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }, [postInferenceMessage]);

  // Handlers
  const handleAddModel = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const fileName = file.name.replace(".onnx", "");
      const fileUrl = URL.createObjectURL(file);
      setCustomModels((prev) => [...prev, { name: fileName, url: fileUrl }]);
    }
  }, []);

  const handleAddClassesFile = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        const fileName = file.name.replace(/\.json$/i, "");
        setCustomClasses((prev) => [
          ...prev,
          { name: fileName, data: jsonData },
        ]);
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: `Classes file "${fileName}" loaded successfully`,
          statusColor: "green",
        }));
      } catch (error) {
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: error.message || "Error parsing JSON file",
          statusColor: "red",
        }));
      }
    };
    reader.readAsText(file);
  }, []);

  const handleOpenImage = useCallback(
    (imgUrl = null) => {
      if (imgUrl) {
        if (imgSrc?.startsWith("blob:") && imgSrc !== imgUrl) {
          URL.revokeObjectURL(imgSrc);
        }
        setImgSrc(imgUrl);
        setDetails([]);
        setActiveFeature("image");
      } else if (imgSrc) {
        if (imgSrc.startsWith("blob:")) {
          URL.revokeObjectURL(imgSrc);
        }
        if (overlayRef.current) {
          overlayRef.current.width = 0;
          overlayRef.current.height = 0;
        }
        setImgSrc(null);
        setDetails([]);
        setActiveFeature(null);
      }
    },
    [imgSrc],
  );

  const handleImageDrop = useCallback(
    (file) => {
      if (file?.type.startsWith("image/")) {
        handleOpenImage(URL.createObjectURL(file));
      }
    },
    [handleOpenImage],
  );

  const toggleCamera = useCallback(async () => {
    if (activeFeature === "camera") {
      closeCamera();
      if (overlayRef.current) {
        overlayRef.current.width = 0;
        overlayRef.current.height = 0;
      }
      setActiveFeature(null);
      setDetails([]);
    } else {
      const camerasList = await getCameras();
      if (camerasList.length > 0) {
        const selectedDeviceId = cameraSelectorRef.current
          ? cameraSelectorRef.current.value
          : camerasList[0].deviceId;
        const success = await openCamera(selectedDeviceId);
        if (success) {
          setActiveFeature("camera");
        }
      } else {
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: "No cameras found",
          statusColor: "red",
        }));
      }
    }
  }, [activeFeature, closeCamera, getCameras, openCamera]);

  const handleCameraLoad = useCallback(() => {
    startCameraLoop();
  }, [startCameraLoop]);

  const handleOpenVideo = useCallback(
    (file) => {
      if (file) {
        setDetails([]);
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: `Preparing ${file.name || "video"}…`,
          statusColor: "blue",
        }));
        setActiveFeature("video");
        if (!processVideo(file, DEFAULT_MODEL_CONFIG)) {
          handleVideoError("Video worker is not ready. Reload the page and try again.");
        }
      }
    },
    [handleVideoError, processVideo],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Runs privately in your browser
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            YOLO Vision
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400 sm:text-base">
            Choose a task, add an image or video, and see the detections.
          </p>
        </div>
        <p className="text-xs text-slate-500">Images are processed on this device</p>
      </header>

      <SettingsPanel
        cameraSelectorRef={cameraSelectorRef}
        modelConfigRef={modelConfigRef}
        customClasses={customClasses}
        cameras={cameras}
        customModels={customModels}
        activeFeature={activeFeature}
        defaultClasses={classes}
        loadModel={loadModel}
        handleAddModel={handleAddModel}
        handleAddClassesFile={handleAddClassesFile}
      />

      <ControlButtons
        imgSrc={imgSrc}
        fileVideoRef={fileVideoRef}
        fileImageRef={fileImageRef}
        handle_OpenVideo={handleOpenVideo}
        handle_OpenImage={handleOpenImage}
        handle_ToggleCamera={toggleCamera}
        activeFeature={activeFeature}
      />

      <ImageDisplay
        cameraRef={cameraRef}
        imgRef={imgRef}
        overlayRef={overlayRef}
        imgSrc={imgSrc}
        onCameraLoad={handleCameraLoad}
        onImageLoad={imageLoad}
        onImageDrop={handleImageDrop}
        onVideoDrop={handleOpenVideo}
        activeFeature={activeFeature}
      />

      <ModelStatus
        warnUpTime={processingStatus.warnUpTime}
        inferenceTime={processingStatus.inferenceTime}
        statusMsg={processingStatus.statusMsg}
        statusColor={processingStatus.statusColor}
      />

      <ResultsTable
        details={details}
        currentClasses={DEFAULT_MODEL_CONFIG.classes.classes}
      />

      <footer className="pb-3 text-center text-xs text-slate-600">
        YOLO models run locally with ONNX Runtime Web.
      </footer>
    </main>
  );
}

export default App;
