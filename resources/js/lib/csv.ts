/**
 * Download rows as a CSV file (opens in Excel). A UTF-8 BOM is added so
 * Excel shows Bangla text correctly.
 */
export function downloadCsv(
    filename: string,
    header: string[],
    rows: (string | number)[][],
) {
    const escape = (v: string | number) => {
        const s = String(v);

        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const body = [header, ...rows]
        .map((r) => r.map(escape).join(','))
        .join('\r\n');
    const blob = new Blob(['﻿', body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Very small CSV parser for the shop import (no quoted newlines). */
export function parseCsv(text: string): string[][] {
    return text
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const cells: string[] = [];
            let cell = '';
            let quoted = false;

            for (let i = 0; i < line.length; i++) {
                const ch = line[i];

                if (ch === '"' && line[i + 1] === '"' && quoted) {
                    cell += '"';
                    i++;
                } else if (ch === '"') {
                    quoted = !quoted;
                } else if (ch === ',' && !quoted) {
                    cells.push(cell.trim());
                    cell = '';
                } else {
                    cell += ch;
                }
            }

            cells.push(cell.trim());

            return cells;
        });
}
