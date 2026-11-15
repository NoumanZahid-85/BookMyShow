const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Draws the ticket as a PNG and downloads it, so it works offline at the gate.
 * Built as one SVG (text + the server's QR) and rasterized on a canvas. No network needed.
 */
export async function downloadTicketImage(opts: { fileName: string; title: string; lines: [string, string][]; qrSvg: string }) {
  const W = 900;
  const H = 420;
  const qr = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(opts.qrSvg)}`;
  const rows = opts.lines
    .map(
      ([label, value], i) =>
        `<text x="40" y="${130 + i * 46}" font-size="13" fill="#8b8b94">${esc(label.toUpperCase())}</text>` +
        `<text x="40" y="${150 + i * 46}" font-size="18" fill="#ededef">${esc(value)}</text>`
    )
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial, sans-serif">` +
    `<rect width="${W}" height="${H}" rx="24" fill="#151518"/>` +
    `<text x="40" y="70" font-size="30" font-weight="700" fill="#ededef">${esc(opts.title)}</text>` +
    rows +
    `<line x1="560" y1="30" x2="560" y2="${H - 30}" stroke="#3a3a42" stroke-dasharray="6 8"/>` +
    `<rect x="610" y="80" width="250" height="250" rx="16" fill="#fff"/>` +
    `<image href="${qr}" x="625" y="95" width="220" height="220"/>` +
    `<text x="735" y="362" font-size="13" fill="#8b8b94" text-anchor="middle">Show this code at the gate</text>` +
    `</svg>`;

  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = W * 2; // 2x for sharp QR edges
  canvas.height = H * 2;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

  const link = document.createElement("a");
  link.download = opts.fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
