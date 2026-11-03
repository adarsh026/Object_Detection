import { memo, useState } from "react";

const ImageDisplay = memo(function ImageDisplay({
  cameraRef,
  imgRef,
  overlayRef,
  imgSrc,
  onCameraLoad,
  onImageLoad,
  onImageDrop,
  onVideoDrop,
  activeFeature,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const isShowingMedia = activeFeature === "image" || activeFeature === "camera";

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (activeFeature && activeFeature !== "image") return;
    const imageFile = Array.from(event.dataTransfer.files).find((file) =>
      file.type.startsWith("image/"),
    );
    const videoFile = Array.from(event.dataTransfer.files).find(
      (file) => file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4"),
    );
    if (imageFile) onImageDrop(imageFile);
    else if (videoFile) onVideoDrop(videoFile);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-xl shadow-black/10 sm:p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-white">Preview</h2>
        {activeFeature === "camera" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-medium text-rose-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />
            Live camera
          </span>
        )}
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-slate-950/70 transition sm:min-h-[380px] ${isDragging ? "border-violet-300 bg-violet-400/10" : "border-slate-800"}`}
      >
        {isShowingMedia ? (
          <div className="relative flex max-h-[620px] min-h-[300px] w-full items-center justify-center sm:min-h-[380px]">
            <video
              ref={cameraRef}
              onLoadedMetadata={onCameraLoad}
              hidden={activeFeature !== "camera"}
              autoPlay
              playsInline
              muted
              className="max-h-[620px] w-full object-contain"
            />
            <img
              ref={imgRef}
              src={imgSrc}
              onLoad={onImageLoad}
              hidden={activeFeature !== "image"}
              className="max-h-[620px] w-full object-contain"
              alt="Selected input for object detection"
            />
            <canvas
              ref={overlayRef}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              aria-label="Model detection overlay"
            />
          </div>
        ) : activeFeature === "loading" ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-violet-400" />
            <h3 className="font-semibold text-white">Getting the model ready</h3>
            <p className="mt-1 text-sm text-slate-500">
              This can take a moment the first time.
            </p>
          </div>
        ) : activeFeature === "video" ? (
          <div className="px-6 py-12 text-center">
            <h3 className="font-semibold text-white">Processing video</h3>
            <p className="mt-1 text-sm text-slate-500">
              The processed MP4 will download when finished.
            </p>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-2xl text-violet-300">
              ↑
            </div>
            <h3 className="font-semibold text-white">
              {isDragging ? "Drop your media to start" : "Add an image or video to begin"}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Drag and drop an image or MP4 video here, or use the buttons above.
              Image detection and video processing both run in your browser.
            </p>
          </div>
        )}

        {isDragging && activeFeature !== "loading" && (
          <div className="pointer-events-none absolute inset-0 border-2 border-violet-300 bg-violet-400/10" />
        )}
      </div>
    </section>
  );
});

export default ImageDisplay;
