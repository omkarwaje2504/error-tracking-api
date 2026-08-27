// ─────────────────────────────────────────────
//  lib/export.js  — turn the current design into a downloadable file
// ─────────────────────────────────────────────

/**
 * Renders just the true canvas area (excluding the surrounding bleed/
 * pasteboard) to a PNG and triggers a browser download.
 *
 * @param {import("konva/lib/Stage").Stage} stage  live Konva stage instance
 * @param {{x:number,y:number,width:number,height:number}} cropBox  the true
 *   canvas rect in stage-space (i.e. offset by CANVAS_BLEED)
 * @param {string} [filename]
 */
export function exportStagePng(stage, cropBox, filename = "design.png") {
  if (!stage) return;

  const dataUrl = stage.toDataURL({ ...cropBox, pixelRatio: 2, mimeType: "image/png" });

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
