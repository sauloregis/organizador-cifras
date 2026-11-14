// Gera um PDF simples (fonte Helvetica padrão) para testes — sem dependências.

export interface PdfTextOp {
  text: string;
  x: number;
  y: number;
  size?: number;
}

export function makePdf(pages: PdfTextOp[][]): Uint8Array {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objs: string[] = [];
  const pageIds: number[] = [];
  // 1 catálogo, 2 páginas, 3 fonte; depois pares (página, conteúdo)
  pages.forEach((ops, i) => {
    const pageId = 4 + i * 2;
    pageIds.push(pageId);
    const content = ops
      .map((o) => `BT /F1 ${o.size ?? 12} Tf 1 0 0 1 ${o.x.toFixed(2)} ${o.y.toFixed(2)} Tm (${esc(o.text)}) Tj ET`)
      .join('\n');
    objs[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objs[pageId + 1] = `<< /Length ${latin1Length(content)} >>\nstream\n${content}\nendstream`;
  });
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = latin1Length(out);
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = latin1Length(out);
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(Array.from(out, (ch) => ch.charCodeAt(0) & 0xff));
}

function latin1Length(s: string) {
  return s.length;
}
