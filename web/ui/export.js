/**
 * Export: the oriented part plus the fins/pad, as STL or 3MF.
 */
import { writeBinarySTL, download } from '../stl.js';
import { writeThreeMF } from '../threemf.js';
import { el } from './dom.js';
import {
  part, topology, lastResult, rotM3, partName, activeAdded, partHasImportedColors,
  partPaintColors, partFilamentPalette,
} from '../app.js';

/**
 * Export the part AS ORIENTED, seated on the plate, with the fins as extra
 * solids in the same file. The whole promise of the tool is that the STL prints
 * the same way for whoever opens it, so the orientation has to be baked in --
 * exporting the original frame and hoping the user re-rotates defeats the point.
 */
/**
 * The part geometry AS ORIENTED and seated on the plate, plus the fins, kept in
 * two separate lists. STL flattens them into one solid; 3MF keeps them distinct.
 * Returns null when there is nothing to export.
 */
export function buildExportGeometry() {
  if (!part || !topology || !lastResult) return null;
  const rot = rotM3.elements;
  const dz = lastResult.offset.z;
  const dx = lastResult.offset.x, dy = lastResult.offset.y;
  const { pos, nFaces } = topology;

  const partTris = new Array(nFaces * 3);
  const partColors = partHasImportedColors ? new Float32Array(nFaces * 3) : null;
  const sourceColors = partHasImportedColors ? part.geometry.getAttribute('sourceColor').array : null;
  for (let f = 0; f < nFaces; f++) {
    if (partColors) {
      const c = f * 9, color = f * 3;
      partColors[color] = sourceColors[c];
      partColors[color + 1] = sourceColors[c + 1];
      partColors[color + 2] = sourceColors[c + 2];
    }
    for (let i = 0; i < 3; i++) {
      const o = f * 9 + i * 3;
      const x = pos[o], y = pos[o + 1], z = pos[o + 2];
      partTris[f * 3 + i] = [
        rot[0] * x + rot[3] * y + rot[6] * z + dx,
        rot[1] * x + rot[4] * y + rot[7] * z + dy,
        rot[2] * x + rot[5] * y + rot[8] * z + dz,
      ];
    }
  }
  // whichever walls the live mode contributes -- hand-drawn in Draw, suggested
  // in Suggest -- plus the pad, all already in print space
  const finTris = [...activeAdded()];
  const base = partName.replace(/\.(stl|3mf|step|stp)$/i, '') || 'part';
  return { partTris, finTris, partColors, partPaintColors, partFilamentPalette, base };
}

/**
 * Export the part AS ORIENTED, seated on the plate, with the fins as extra
 * solids in the same file. The whole promise of the tool is that the file prints
 * the same way for whoever opens it, so the orientation has to be baked in --
 * exporting the original frame and hoping the user re-rotates defeats the point.
 */
el('export').addEventListener('click', () => {
  const g = buildExportGeometry();
  if (!g) return;
  const tris = [...g.partTris, ...g.finTris];
  let colors = null;
  if (g.partColors) {
    colors = new Float32Array((tris.length / 3) * 3);
    colors.set(g.partColors);
    const supportColor = [0.1, 0.65, 0.38];
    for (let i = g.partColors.length; i < colors.length; i += 3) {
      colors[i] = supportColor[0];
      colors[i + 1] = supportColor[1];
      colors[i + 2] = supportColor[2];
    }
  }
  download(writeBinarySTL(tris, g.base, colors), `${g.base}-fins.stl`);
});

// 3MF keeps the fins as a separate object and states millimeters, so the file
// opens correctly oriented and support-free in Bambu Studio, OrcaSlicer, or
// PrusaSlicer without a re-scale or a re-rotate.
el('export-3mf').addEventListener('click', () => {
  const g = buildExportGeometry();
  if (!g) return;
  const finColor = g.partColors ? [0.1, 0.65, 0.38] : null;
  download(writeThreeMF(g.partTris, g.finTris, g.base, g.partColors, finColor,
    g.partPaintColors, g.partFilamentPalette), `${g.base}-fins.3mf`);
});
