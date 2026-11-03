import React, { memo } from "react";

const ResultsTable = memo(function ResultsTable({ details, currentClasses }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Detections</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Objects found in the current image or video
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
          {details.length} {details.length === 1 ? "object" : "objects"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
        {details.length === 0 ? (
          <div className="px-4 py-7 text-center text-sm text-slate-500">
            No detections yet. Add an image or video to see results here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-semibold">Object</th>
                  <th className="w-56 px-4 py-3 font-semibold">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {details.map((item, index) => (
                  <tr key={index} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {currentClasses[item.classIdx] ||
                        (item.keypoints ? "Person pose" : `Class ${item.classIdx}`)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-violet-400"
                            style={{ width: `${item.score * 100}%` }}
                          ></div>
                        </div>
                        <span className="w-12 text-right font-mono text-xs text-slate-400">
                          {(item.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
});

export default ResultsTable;
