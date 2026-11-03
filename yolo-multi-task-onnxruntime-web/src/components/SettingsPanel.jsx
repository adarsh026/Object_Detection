import { memo, useRef, useState } from "react";

const SettingsPanel = memo(function SettingsPanel({
  cameraSelectorRef,
  modelConfigRef,
  customClasses,
  cameras,
  customModels,
  activeFeature,
  defaultClasses,
  loadModel,
  handleAddModel,
  handleAddClassesFile,
}) {
  const [nmsEnabled, setNmsEnabled] = useState(true);
  const [nmsLocked, setNmsLocked] = useState(true);
  const [selectedTask, setSelectedTask] = useState("detect");
  const [selectedModel, setSelectedModel] = useState("yolo11n");
  const threadTimeoutRef = useRef(null);
  const isBusy = activeFeature !== null;

  const fieldClass =
    "mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-sm font-medium text-slate-100 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60";

  const updateModelNms = (model) => {
    if (model.startsWith("yolo11") || model.startsWith("yolo12")) {
      setNmsEnabled(true);
      setNmsLocked(true);
      modelConfigRef.current.enableNMS = true;
    } else if (model.startsWith("yolo26")) {
      setNmsEnabled(false);
      setNmsLocked(true);
      modelConfigRef.current.enableNMS = false;
    } else {
      setNmsEnabled(true);
      setNmsLocked(false);
      modelConfigRef.current.enableNMS = true;
    }
  };

  const chooseFile = (accept, onChange) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = onChange;
    input.click();
  };

  const handleThreadChange = (event) => {
    const value = event.target.value;
    clearTimeout(threadTimeoutRef.current);
    threadTimeoutRef.current = setTimeout(() => {
      const numThreads = Number.parseInt(value, 10);
      if (Number.isInteger(numThreads) && numThreads > 0) {
        modelConfigRef.current.numThreads = numThreads;
        loadModel();
      }
    }, 700);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/10 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
            Quick setup
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Choose a task and model
          </h2>
        </div>
        {activeFeature === "loading" && (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
            Loading model
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Task
          <select
            value={selectedTask}
            onChange={(event) => {
              const task = event.target.value;
              setSelectedTask(task);
              modelConfigRef.current.task = task;
              if (task !== "detect" && modelConfigRef.current.model.startsWith("yolo12")) {
                modelConfigRef.current.model = "yolo11n";
                setSelectedModel("yolo11n");
                updateModelNms("yolo11n");
              }
              loadModel();
            }}
            disabled={isBusy}
            className={fieldClass}
          >
            <option value="detect">Object detection</option>
            <option value="pose">Pose estimation</option>
            <option value="seg">Segmentation</option>
          </select>
        </label>

        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Model
          <select
            value={selectedModel}
            onChange={(event) => {
              const model = event.target.value;
              setSelectedModel(model);
              modelConfigRef.current.model = model;
              updateModelNms(model);
              loadModel();
            }}
            disabled={isBusy}
            className={fieldClass}
          >
            <option value="yolo11n">YOLO11n · Nano</option>
            <option value="yolo11s">YOLO11s · Small</option>
            {selectedTask === "detect" && (
              <>
                <option value="yolo12n">YOLO12n · Nano</option>
                <option value="yolo12s">YOLO12s · Small</option>
              </>
            )}
            <option value="yolo26n">YOLO26n · Nano</option>
            <option value="yolo26s">YOLO26s · Small</option>
            {customModels.map((model, index) => (
              <option key={`${model.url}-${index}`} value={model.url}>
                {model.name} · Custom
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="group mt-4 border-t border-slate-800 pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-300 transition hover:text-white [&::-webkit-details-marker]:hidden">
          <span>Advanced settings</span>
          <span className="text-xs text-slate-500 group-open:hidden">
            Optional
          </span>
          <span className="hidden text-slate-400 group-open:inline" aria-hidden="true">
            −
          </span>
        </summary>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Class labels
            <select
              defaultValue="default"
              onChange={(event) => {
                if (event.target.value === "default") {
                  modelConfigRef.current.classes = defaultClasses;
                } else {
                  const index = Number.parseInt(event.target.value, 10);
                  modelConfigRef.current.classes = customClasses[index].data;
                }
              }}
              disabled={isBusy}
              className={fieldClass}
            >
              <option value="default">Default · COCO</option>
              {customClasses.map((classFile, index) => (
                <option key={`${classFile.name}-${index}`} value={index}>
                  {classFile.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Processing backend
            <select
              defaultValue="wasm"
              onChange={(event) => {
                modelConfigRef.current.backend = event.target.value;
                loadModel();
              }}
              disabled={isBusy}
              className={fieldClass}
            >
              <option value="wasm">WASM · CPU</option>
              <option value="webgpu">WebGPU · GPU</option>
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            CPU threads
            <input
              type="number"
              min="1"
              max={navigator.hardwareConcurrency || 1}
              defaultValue={1}
              onChange={handleThreadChange}
              disabled={isBusy}
              className={fieldClass}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Camera source
            <select
              ref={cameraSelectorRef}
              disabled={isBusy || cameras.length === 0}
              className={fieldClass}
            >
              {cameras.length === 0 ? (
                <option value="">No camera detected</option>
              ) : (
                cameras.map((camera, index) => (
                  <option key={camera.deviceId || index} value={camera.deviceId}>
                    {camera.label || `Camera ${index + 1}`}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Image resizing
            <select
              defaultValue="dynamic"
              onChange={(event) => {
                modelConfigRef.current.imgszType = event.target.value;
              }}
              disabled={isBusy}
              className={fieldClass}
            >
              <option value="dynamic">Dynamic resize</option>
              <option value="zeroPad">Square with padding</option>
            </select>
          </label>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Extra NMS</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {nmsLocked
                  ? nmsEnabled
                    ? "Required by this model"
                    : "Already handled by this model"
                  : "Optional for this custom model"}
              </p>
            </div>
            <input
              type="checkbox"
              checked={nmsEnabled}
              onChange={(event) => {
                setNmsEnabled(event.target.checked);
                modelConfigRef.current.enableNMS = event.target.checked;
              }}
              disabled={isBusy || nmsLocked}
              aria-label="Enable extra NMS"
              className="h-5 w-5 accent-violet-500 disabled:opacity-50"
            />
          </div>

          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Custom files · optional
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => chooseFile(".onnx", handleAddModel)}
                disabled={isBusy}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-violet-400/50 hover:bg-violet-400/10 hover:text-white disabled:opacity-50"
              >
                Add ONNX model
              </button>
              <button
                type="button"
                onClick={() => chooseFile(".json", handleAddClassesFile)}
                disabled={isBusy}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-violet-400/50 hover:bg-violet-400/10 hover:text-white disabled:opacity-50"
              >
                Add class labels
              </button>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
});

export default SettingsPanel;
