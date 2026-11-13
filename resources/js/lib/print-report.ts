/**
 * Opens one report as a clean A4 table in a new window and starts printing,
 * where "Save as PDF" turns it into a PDF. No PDF library: the browser lays
 * out Bangla text correctly and the file stays small.
 */
export function printReport(opts: {
    title: string;
    company: string;
    /** e.g. "Printed 14 Nov 2026, 10:30" */
    meta: string;
    header: string[];
    rows: (string | number)[][];
    /** Column indexes that hold numbers (right-aligned). */
    numeric?: number[];
    format?: (value: string | number, column: number) => string;
}): boolean {
    const win = window.open('', '_blank');

    if (!win) {
        return false; // popup blocked
    }

    const esc = (v: unknown) =>
        String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    const numeric = new Set(opts.numeric ?? []);
    const cell = (v: string | number, i: number) =>
        `<td${numeric.has(i) ? ' class="n"' : ''}>${esc(opts.format ? opts.format(v, i) : v)}</td>`;
    const label = (h: string) =>
        h.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

    win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(opts.title)} — ${esc(opts.company)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.45 system-ui, -apple-system, "Segoe UI", "Noto Sans Bengali", sans-serif; color: #111827; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0a8a6c; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 17px; margin: 0; }
  .company { font-weight: 600; color: #0a8a6c; }
  .meta { color: #6b7280; text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; font-weight: 600; color: #374151; background: #f3f4f6; padding: 6px 8px; border-bottom: 1px solid #d1d5db; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  tr { break-inside: avoid; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  th.n { text-align: right; }
  footer { margin-top: 10px; color: #6b7280; }
</style></head><body>
<header>
  <div><div class="company">${esc(opts.company)}</div><h1>${esc(opts.title)}</h1></div>
  <div class="meta">${esc(opts.meta)}<br>${opts.rows.length} rows</div>
</header>
<table>
  <thead><tr>${opts.header.map((h, i) => `<th${numeric.has(i) ? ' class="n"' : ''}>${esc(label(h))}</th>`).join('')}</tr></thead>
  <tbody>${opts.rows.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody>
</table>
<footer>Onukrom</footer>
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body></html>`);
    win.document.close();

    return true;
}
