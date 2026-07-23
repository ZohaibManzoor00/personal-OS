// Turns inline citation markers like `[1]` in an assistant answer into link
// nodes the markdown renderer can style as clickable source chips. The model is
// prompted to cite its notes with bracketed numbers that match the retrieved
// `sources` order (see chat/server/router.ts), so `[1]` always points at the
// first source.
//
// Implemented as a tiny mdast transformer rather than a regex over the raw
// string: walking the syntax tree means we only touch prose `text` nodes and
// never mangle `[1]` that appears inside inline code or fenced code blocks
// (those are distinct node types with no `text` children).

// A structurally-typed subset of mdast — enough to walk and rewrite without
// pulling in @types/mdast just for this.
type MdastNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MdastNode[];
};

// We encode the target as a hash link (`#cite-3`) rather than a custom scheme so
// react-markdown's default URL sanitizer leaves it intact; the renderer swaps in
// the real note href when it recognizes the prefix.
export const CITATION_HREF_PREFIX = "#cite-";

const CITATION_PATTERN = /\[(\d+)\]/g;

/**
 * Splits a text node on `[n]` markers, replacing each valid one with a citation
 * link node. Returns the original node untouched when it contains no citations.
 */
const splitTextNode = (node: MdastNode, valid: Set<number>): MdastNode[] => {
  const value = node.value ?? "";
  const parts: MdastNode[] = [];
  let lastIndex = 0;

  CITATION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = CITATION_PATTERN.exec(value);
  while (match !== null) {
    const number = Number(match[1]);
    if (valid.has(number)) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: value.slice(lastIndex, match.index) });
      }
      parts.push({
        type: "link",
        url: `${CITATION_HREF_PREFIX}${number}`,
        children: [{ type: "text", value: String(number) }],
      });
      lastIndex = match.index + match[0].length;
    }
    match = CITATION_PATTERN.exec(value);
  }

  if (parts.length === 0) return [node];
  if (lastIndex < value.length) parts.push({ type: "text", value: value.slice(lastIndex) });
  return parts;
};

const walk = (node: MdastNode, valid: Set<number>) => {
  if (!node.children) return;

  const next: MdastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text") {
      next.push(...splitTextNode(child, valid));
      continue;
    }
    // Don't descend into existing links — nesting a citation link inside another
    // link would produce invalid markup.
    if (child.type !== "link" && child.type !== "linkReference") walk(child, valid);
    next.push(child);
  }
  node.children = next;
};

/**
 * Remark plugin (tuple form: `[remarkCitations, validNumbers]`). Only markers
 * whose number is in `valid` are linkified, so a stray `[7]` with no matching
 * source stays literal text.
 */
export function remarkCitations(valid: Set<number>) {
  return (tree: MdastNode) => {
    if (valid.size > 0) walk(tree, valid);
  };
}
