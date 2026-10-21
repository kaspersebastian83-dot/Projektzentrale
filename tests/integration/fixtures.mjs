// Raw input only. No LabelKit, FotoKit, PlanKit or BelegKit output is pre-generated.
export const fixture = {
  project: '26.9901 Auditstadt & Süd + 50% #Hof', control: '26.9902 Kontrollstadt',
  nr: '26.9901', object: 'Fiktives Testgebäude A', customer: 'Audit Versicherung – fiktiv',
  claim: 'TEST-9901', employee: 'ZZ', date: '2026-10-15',
  descriptions: ['TEST Übersicht P1', 'TEST Detail P2', 'TEST Material P3', 'TEST Ausschuss'],
};
export const expected = Object.freeze({
  sv1: { quantity: 1, price: 100, cents: 10000 }, km: { quantity: 10, price: .5, cents: 500 },
  'lab-pak': { quantity: 1, price: 10, cents: 1000 },
  'lab-chlorid-wisch': { quantity: 1, price: 20, cents: 2000 },
  asbest: { quantity: 1, price: 30, cents: 3000 },
  sv3: { quantity: .5, price: 80, cents: 4000 },
  neben: { quantity: 1, pages: 2, photos: 3, pagePrice: 1, photoPrice: .5, fixed: 0, cents: 350 },
});
export const expectedNetCents = 20850; // Independent oracle, never calculated by BelegKit.
export const planSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><path d="M20 20H780V580H20ZM400 20V580" fill="none" stroke="black" stroke-width="6"/><text x="60" y="120" font-size="32">TEST – FIKTIVER GRUNDRISS</text></svg>';

// Valid synthetic two-page report input, representing the report written outside Spektron.
// It is not a substitute for any Suite producer's export.
export function reportPdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...[1, 2].map(n => { const s = `BT /F1 24 Tf 50 750 Td (TEST - FIKTIVER BERICHT - SEITE ${n}) Tj ET\n`; return `<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`; }),
  ];
  let data = '%PDF-1.4\n', offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(data)); data += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const start = Buffer.byteLength(data);
  data += `xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return [...Buffer.from(data)];
}
