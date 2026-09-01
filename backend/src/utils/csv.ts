/**
 * Travelog MVP — CSV utilities
 *
 * Minimal RFC 4180-compliant CSV serialization for the trip export
 * (field separator `;`, Italian-locale friendly). Fields containing the
 * separator, double quotes or newlines are quoted, doubling the quotes.
 */

/**
 * Escape a single CSV field. Returns the raw value when it contains no
 * special characters, otherwise a quoted field with doubled quotes.
 */
export function escapeCsvField(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/**
 * Serialize rows (array of cell arrays) into a CSV document with an
 * `;` separator and a UTF-8 BOM, so accented characters open correctly
 * in Excel/Numbers with Italian locale.
 */
export function buildCsv(rows: string[][]): string {
  const lines = rows.map((cells) => cells.map(escapeCsvField).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
