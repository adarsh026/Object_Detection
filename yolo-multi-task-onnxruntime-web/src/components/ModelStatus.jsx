import { memo } from "react";

const ModelStatus = memo(function ModelStatus({
  warnUpTime,
  inferenceTime,
  statusMsg,
  statusColor,
}) {
  const statusClasses =
    statusColor === "green"
      ? "bg-emerald-300"
      : statusColor === "red"
        ? "bg-rose-300"
        : statusColor === "blue"
          ? "animate-pulse bg-violet-300"
          : "bg-slate-500";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusClasses}`} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Model status
          </p>
          <p
            className={`truncate text-sm font-medium ${statusColor === "red" ? "text-rose-200" : "text-slate-200"}`}
            title={statusMsg}
          >
            {statusMsg || "Waiting for model"}
          </p>
        </div>
      </div>

      <div className="flex gap-5 pl-5 text-xs text-slate-500 sm:pl-0">
        <span>
          Load <strong className="font-semibold text-slate-300">{warnUpTime} ms</strong>
        </span>
        <span>
          Inference <strong className="font-semibold text-slate-300">{inferenceTime} ms</strong>
        </span>
      </div>
    </section>
  );
});

export default ModelStatus;
