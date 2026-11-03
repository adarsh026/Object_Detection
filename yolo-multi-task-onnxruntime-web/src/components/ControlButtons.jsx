import { memo } from "react";

const ControlButtons = memo(function ControlButtons({
  imgSrc,
  fileVideoRef,
  fileImageRef,
  handle_OpenVideo,
  handle_OpenImage,
  handle_ToggleCamera,
  activeFeature,
}) {
  const isBusy = activeFeature !== null;
  const buttonClass =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50";
  const primaryClass =
    "bg-violet-500 text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400";
  const secondaryClass =
    "border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800";

  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="file"
        accept="image/*"
        hidden
        ref={fileImageRef}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handle_OpenImage(URL.createObjectURL(file));
            event.target.value = "";
          }
        }}
      />

      <input
        type="file"
        accept="video/mp4"
        hidden
        ref={fileVideoRef}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handle_OpenVideo(file);
            event.target.value = "";
          }
        }}
      />

      <button
        type="button"
        className={`${buttonClass} ${primaryClass} sm:flex-1`}
        onClick={() =>
          imgSrc ? handle_OpenImage() : fileImageRef.current?.click()
        }
        disabled={isBusy && activeFeature !== "image"}
      >
        <span aria-hidden="true">{activeFeature === "image" ? "×" : "＋"}</span>
        {activeFeature === "image" ? "Clear image" : "Choose image"}
      </button>

      <button
        type="button"
        className={`${buttonClass} ${secondaryClass} sm:flex-1`}
        onClick={() => fileVideoRef.current?.click()}
        disabled={isBusy}
      >
        <span aria-hidden="true">▶</span>
        Choose MP4 video
      </button>

      <button
        type="button"
        className={`${buttonClass} ${secondaryClass} sm:flex-1 ${activeFeature === "camera" ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20" : ""}`}
        onClick={handle_ToggleCamera}
        disabled={isBusy && activeFeature !== "camera"}
      >
        <span aria-hidden="true">{activeFeature === "camera" ? "■" : "◉"}</span>
        {activeFeature === "camera" ? "Stop camera" : "Use camera"}
      </button>
    </section>
  );
});

export default ControlButtons;
