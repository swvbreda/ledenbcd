/**
 * Eigen kopie van PDF-bytes per laadpoging. pdf.js draagt de buffer over aan de
 * worker (transfer → detached); zo blijft de bron (props) altijd bruikbaar,
 * ook bij StrictMode-remounts of herladen. Respecteert byteOffset/length van subviews.
 */
export function copyPdfBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
}
