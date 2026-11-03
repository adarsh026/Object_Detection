import { useRef, useEffect, useCallback } from "react";

export const useVideoProcessWorker = ({ onStatusUpdate, onComplete, onError }) => {
  const workerRef = useRef(null);

  const callbacksRef = useRef({ onStatusUpdate, onComplete, onError });
  useEffect(() => {
    callbacksRef.current = { onStatusUpdate, onComplete, onError };
  }, [onStatusUpdate, onComplete, onError]);

  useEffect(() => {
    const worker = new Worker(
      new URL("../utils/video-process-worker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e) => {
      const { type, statusMsg, processedVideo } = e.data;
      if (type === "STATUS" || (!type && statusMsg)) {
        callbacksRef.current.onStatusUpdate?.(statusMsg);
      }
      if (type === "COMPLETE" || processedVideo) {
        callbacksRef.current.onComplete?.(processedVideo);
      }
      if (type === "ERROR") {
        callbacksRef.current.onError?.(statusMsg || "Video processing failed.");
      }
    };

    worker.onerror = (event) => {
      event.preventDefault();
      callbacksRef.current.onError?.(
        event.message || "The video worker stopped unexpectedly.",
      );
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const processVideo = useCallback((file, modelConfig) => {
    if (!workerRef.current) return false;
    workerRef.current.postMessage({
      file,
      modelConfig,
    });
    return true;
  }, []);

  return { processVideo };
};
