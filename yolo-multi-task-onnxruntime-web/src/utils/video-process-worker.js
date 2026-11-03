import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { inferencePipeline } from "./inference-pipeline.js";
import { MP4Demuxer } from "./demuxer.js";
import { modelLoader } from "./model-loader.js";
import { renderOverlay } from "./render-overlay.js";

let jobActive = false;

self.onmessage = (event) => {
  if (jobActive) {
    self.postMessage({
      type: "ERROR",
      statusMsg: "Another video is already being processed.",
    });
    return;
  }

  jobActive = true;
  processVideo(event.data).finally(() => {
    jobActive = false;
  });
};

async function processVideo({ file, modelConfig }) {
  let decoder;
  let encoder;
  let muxer;
  let demuxer;
  let inputCanvas;
  let inputContext;
  let resultCanvas;
  let resultContext;
  let session;
  let frameCount = 0;
  let totalFrames = 0;
  let frameQueue = [];
  let drainPromise = null;
  let demuxerPaused = false;
  let failed = false;
  let completed = false;
  let finalizing = false;
  let resolveJob;

  const jobFinished = new Promise((resolve) => {
    resolveJob = resolve;
  });

  const postStatus = (statusMsg) => {
    self.postMessage({ type: "STATUS", statusMsg });
  };

  const closeCodec = (codec) => {
    try {
      if (codec && codec.state !== "closed") codec.close();
    } catch {
      // Codec may already be closed by the browser after an error.
    }
  };

  const fail = (error) => {
    if (failed || completed) return;
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error("Video processing error:", error);
    closeCodec(decoder);
    closeCodec(encoder);
    for (const frame of frameQueue) frame.close();
    frameQueue = [];
    self.postMessage({
      type: "ERROR",
      statusMsg: `Video error: ${message}`,
    });
    resolveJob();
  };

  const maybeResumeDemuxer = () => {
    if (
      demuxerPaused &&
      !failed &&
      !completed &&
      !finalizing &&
      frameQueue.length <= 2 &&
      (decoder?.decodeQueueSize ?? 0) <= 4
    ) {
      demuxerPaused = false;
      demuxer?.resume();
    }
  };

  const processFrame = async (frame) => {
    try {
      inputContext.drawImage(frame, 0, 0, inputCanvas.width, inputCanvas.height);
      resultContext.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
      resultContext.drawImage(frame, 0, 0, inputCanvas.width, inputCanvas.height);

      const imageData = inputContext.getImageData(
        0,
        0,
        inputCanvas.width,
        inputCanvas.height,
      );
      const frameConfig = {
        ...modelConfig,
        overlaySize: [inputCanvas.width, inputCanvas.height],
      };
      const { results, maskImageData, inferenceTime } = await inferencePipeline(
        imageData,
        session,
        frameConfig,
      );

      await renderOverlay(
        results,
        maskImageData,
        resultContext,
        modelConfig.task,
        modelConfig.classes,
      );

      const outputFrameOptions = { timestamp: frame.timestamp };
      if (frame.duration !== null) outputFrameOptions.duration = frame.duration;
      const outputFrame = new VideoFrame(resultCanvas, outputFrameOptions);
      try {
        encoder.encode(outputFrame);
      } finally {
        outputFrame.close();
      }

      frameCount += 1;
      if (
        frameCount === 1 ||
        frameCount % 10 === 0 ||
        (totalFrames > 0 && frameCount >= totalFrames)
      ) {
        const progress =
          totalFrames > 0
            ? ` · ${Math.min(100, Math.round((frameCount / totalFrames) * 100))}%`
            : "";
        postStatus(
          `Processing video · ${frameCount}${totalFrames ? `/${totalFrames}` : ""} frames${progress} · ${inferenceTime} ms/frame`,
        );
      }
    } finally {
      frame.close();
      maybeResumeDemuxer();
    }
  };

  const drainFrameQueue = () => {
    if (drainPromise) return drainPromise;

    drainPromise = (async () => {
      while (frameQueue.length > 0 && !failed) {
        await processFrame(frameQueue.shift());
      }
    })()
      .catch(fail)
      .finally(() => {
        drainPromise = null;
        if (frameQueue.length > 0 && !failed) void drainFrameQueue();
      });

    return drainPromise;
  };

  const finalizeVideo = async () => {
    if (finalizing || failed || completed) return;
    finalizing = true;
    postStatus("Finishing video encoding…");

    try {
      if (decoder?.state === "configured") await decoder.flush();

      while (drainPromise || frameQueue.length > 0) {
        if (drainPromise) await drainPromise;
        else await drainFrameQueue();
        if (failed) return;
      }

      if (decoder?.state === "configured") decoder.close();
      if (encoder?.state === "configured") await encoder.flush();
      if (encoder?.state === "configured") encoder.close();

      if (!muxer) throw new Error("The MP4 encoder did not initialize.");
      muxer.finalize();
      const outputBuffer = muxer.target.buffer;
      if (!outputBuffer || outputBuffer.byteLength === 0) {
        throw new Error("The processed video is empty.");
      }

      completed = true;
      postStatus("Video complete · preparing download");
      self.postMessage({
        type: "COMPLETE",
        processedVideo: new Blob([outputBuffer], { type: "video/mp4" }),
      });
      resolveJob();
    } catch (error) {
      fail(error);
    }
  };

  try {
    if (!file) throw new Error("Choose an MP4 video first.");
    if (!modelConfig?.modelPath) {
      throw new Error("The model path is missing. Reload the model and try again.");
    }
    if (typeof VideoDecoder === "undefined" || typeof VideoEncoder === "undefined") {
      throw new Error("This browser does not support WebCodecs video processing. Use a current Chrome or Edge browser.");
    }

    postStatus("Loading model for video…");
    session = await modelLoader(
      modelConfig.modelPath,
      modelConfig.backend,
      modelConfig.numThreads,
    );

    postStatus(`Reading ${file.name || "video"}…`);
    demuxer = new MP4Demuxer(
      file,
      (config) => {
        try {
          totalFrames = config.nb_frames || 0;
          const width = config.codedWidth;
          const height = config.codedHeight;
          const outputWidth = width + (width % 2);
          const outputHeight = height + (height % 2);

          inputCanvas = new OffscreenCanvas(width, height);
          resultCanvas = new OffscreenCanvas(outputWidth, outputHeight);
          inputContext = inputCanvas.getContext("2d", {
            willReadFrequently: true,
          });
          resultContext = resultCanvas.getContext("2d");
          if (!inputContext || !resultContext) {
            throw new Error("Could not create video processing canvases.");
          }

          muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: {
              codec: "avc",
              width: outputWidth,
              height: outputHeight,
            },
            fastStart: "in-memory",
            firstTimestampBehavior: "offset",
          });

          encoder = new VideoEncoder({
            output: (chunk, metadata) => {
              try {
                muxer.addVideoChunk(chunk, metadata);
              } catch (error) {
                fail(error);
              }
            },
            error: fail,
          });
          encoder.configure({
            codec: "avc1.640028",
            width: outputWidth,
            height: outputHeight,
            bitrate: config.bitrate || 2_000_000,
            framerate: 30,
          });

          decoder = new VideoDecoder({
            output: (frame) => {
              frameQueue.push(frame);
              void drainFrameQueue();
            },
            error: fail,
          });
          decoder.configure({
            codec: config.codec,
            codedWidth: width,
            codedHeight: height,
            description: config.description,
          });

          postStatus(
            `Video ready · ${width}×${height}${totalFrames ? ` · ${totalFrames} frames` : ""}`,
          );
        } catch (error) {
          fail(error);
        }
      },
      (chunk) => {
        if (failed || !decoder || decoder.state !== "configured") return;
        try {
          decoder.decode(chunk);
          if (decoder.decodeQueueSize >= 16 && !demuxerPaused) {
            demuxerPaused = true;
            demuxer?.pause();
          }
        } catch (error) {
          fail(error);
        }
      },
      () => {
        if (!failed) void finalizeVideo();
      },
      fail,
    );
  } catch (error) {
    fail(error);
  }

  await jobFinished;
}
