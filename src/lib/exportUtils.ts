/**
 * Shared clipboard / file-download / CSV helpers.
 *
 * Centralises the ad-hoc clipboard writes and temp-anchor download dances that
 * were previously duplicated across components. Clipboard writes are awaited and
 * never throw to the caller (they return a boolean), and downloads use a Blob +
 * object URL rather than a `data:` URI.
 */

/**
 * Write text to the clipboard. Returns `true` on success, `false` on failure
 * (e.g. permission denied, insecure context, or no clipboard API). Never throws.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Trigger a browser download of `content` as a file named `filename` with the
 * given `mimeType`, via a Blob object URL and a temporary anchor element.
 */
export function downloadFile(filename: string, mimeType: string, content: string): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Serialise a 2D array of cells into a CSV string.
 *
 * - `null` / `undefined` cells become empty strings.
 * - Fields containing a comma, double quote, or newline are wrapped in double
 *   quotes, with inner double quotes escaped by doubling them.
 * - The first row may be a header row; it is treated like any other row.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
	return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
}

function escapeCsvField(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return '';
	const str = String(value);
	if (/[",\n\r]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}
