/**
 * Converts LLM output for Telegram display:
 * - Markdown tables → bullet lists (Telegram does not render tables)
 * - Normalize asterisk-wrapped text to *text* (Telegram legacy Markdown uses single * for bold, not **)
 */
export function formatForTelegram(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line starts a markdown table (has | delimiters)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [trimmed];
      let j = i + 1;

      // Collect consecutive table lines
      while (j < lines.length) {
        const next = lines[j].trim();
        if (next.startsWith("|") && next.endsWith("|")) {
          tableLines.push(next);
          j++;
        } else {
          break;
        }
      }

      // Parse table: first line is header, second may be separator (|---|), rest are data
      const isSeparator = (s: string) => !/[a-zA-Z0-9]/.test(s) && s.includes("|");
      const headerLine = tableLines[0];
      const dataStart = tableLines.length > 1 && isSeparator(tableLines[1]) ? 2 : 1;

      for (let k = dataStart; k < tableLines.length; k++) {
        const row = tableLines[k];
        const cells = row
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
        if (cells.length > 0) {
          result.push("• " + cells.join(" – "));
        }
      }

      i = j;
    } else {
      result.push(line);
      i++;
    }
  }

  let output = result.join("\n");

  // Telegram legacy Markdown uses * for bold (not **). Normalize any asterisk-wrapped text to *text*.
  output = output.replace(/\*+([^*]+)\*+/g, "*$1*");

  return output;
}
