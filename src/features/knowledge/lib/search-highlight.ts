// Sentinel markers wrapped around matched terms by Postgres `ts_headline`. We
// use private-use-area code points so they can never collide with real note
// content, then split on them client-side to render <mark> spans — this avoids
// injecting raw HTML from user content (no dangerouslySetInnerHTML / XSS).
export const HIGHLIGHT_START = "\uE000";
export const HIGHLIGHT_END = "\uE001";

export type HighlightSegment = { text: string; match: boolean; start: number };

/** Splits a `ts_headline` string into plain / matched segments for rendering.
 * `start` is the segment's offset in the marker-free text, usable as a stable
 * React key. */
export const parseHighlights = (value: string): HighlightSegment[] => {
  const segments: HighlightSegment[] = [];
  const regex = new RegExp(`${HIGHLIGHT_START}([\\s\\S]*?)${HIGHLIGHT_END}`, "g");

  let lastIndex = 0;
  let cleanOffset = 0;
  let match: RegExpExecArray | null = regex.exec(value);
  while (match !== null) {
    if (match.index > lastIndex) {
      const text = value.slice(lastIndex, match.index);
      segments.push({ text, match: false, start: cleanOffset });
      cleanOffset += text.length;
    }
    segments.push({ text: match[1], match: true, start: cleanOffset });
    cleanOffset += match[1].length;
    lastIndex = match.index + match[0].length;
    match = regex.exec(value);
  }

  if (lastIndex < value.length) {
    segments.push({ text: value.slice(lastIndex), match: false, start: cleanOffset });
  }

  return segments;
};
