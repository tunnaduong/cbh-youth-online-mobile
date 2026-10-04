// Pure text transforms behind the post editor's formatting toolbar.
//
// Every function takes an edit state { text, start, end } (start/end are the
// selection offsets, start <= end) and returns a new one - no React, no refs -
// so the behaviour can be reasoned about (and tested) in isolation from the
// TextInput that applies it.

const isSpace = (ch) => ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
const WORD_CHAR = /[\p{L}\p{N}_]/u;

const normalize = ({ text, start, end }) => ({
  text,
  start: Math.max(0, Math.min(start, end)),
  end: Math.min(text.length, Math.max(start, end)),
});

// Wrapping padding whitespace ("** word **") makes invalid Markdown, so pull
// the selection in to the first/last non-space character. With only a caret,
// grab the word under it instead, so tapping Bold inside "hello" bolds it.
const tightenSelection = ({ text, start, end }) => {
  if (start === end) {
    let s = start;
    let e = end;
    while (s > 0 && WORD_CHAR.test(text[s - 1])) s--;
    while (e < text.length && WORD_CHAR.test(text[e])) e++;
    return { text, start: s, end: e };
  }
  let s = start;
  let e = end;
  while (s < e && isSpace(text[s])) s++;
  while (e > s && isSpace(text[e - 1])) e--;
  return { text, start: s, end: e };
};

// Bold / italic / strikethrough / inline code. Toggles: applying it again to
// text that is already wrapped removes the markers.
export function wrapSelection(rawState, before, after = before) {
  const state = tightenSelection(normalize(rawState));
  const { text, start, end } = state;
  const selected = text.slice(start, end);

  // Markers sit just outside the selection -> unwrap.
  if (
    start >= before.length &&
    text.slice(start - before.length, start) === before &&
    text.slice(end, end + after.length) === after
  ) {
    return {
      text: text.slice(0, start - before.length) + selected + text.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    };
  }

  // Markers are part of the selection -> unwrap.
  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length,
    };
  }

  // Nothing to wrap (caret in whitespace): drop an empty pair, caret inside.
  return {
    text: text.slice(0, start) + before + selected + after + text.slice(end),
    start: start + before.length,
    end: end + before.length,
  };
}

// Span of the lines a selection touches. A selection that ends exactly on the
// start of the next line (triple-tap selects "line\n") doesn't include it.
const lineSpan = (text, start, end) => {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const probe = end > start && text[end - 1] === "\n" ? end - 1 : end;
  let to = text.indexOf("\n", probe);
  if (to === -1) to = text.length;
  return { from, to };
};

const LINE_KINDS = {
  bullet: { detect: /^[-*+] /, family: /^(?:[-*+] |\d+[.)] )/, make: () => "- " },
  ordered: { detect: /^\d+[.)] /, family: /^(?:[-*+] |\d+[.)] )/, make: (i) => `${i + 1}. ` },
  heading: { detect: /^#{1,6} /, family: /^#{1,6} /, make: () => "### " },
  quote: { detect: /^> ?/, family: /^> ?/, make: () => "> " },
};

// Prefixes every line in the selection with a list/heading/quote marker, or
// strips it when every line already has that exact marker. A line carrying a
// different marker of the same family (e.g. "- " -> "1. ") is converted.
export function toggleLinePrefix(rawState, kindName) {
  const kind = LINE_KINDS[kindName];
  const { text, start, end } = normalize(rawState);
  const { from, to } = lineSpan(text, start, end);
  const lines = text.slice(from, to).split("\n");
  const single = lines.length === 1;

  const targets = lines.map((line, i) => (single || line.trim() !== "" ? i : -1)).filter((i) => i >= 0);
  const allMatch = targets.length > 0 && targets.every((i) => kind.detect.test(lines[i]));

  let counter = 0;
  const deltas = [];
  const next = lines.map((line, i) => {
    if (!targets.includes(i)) {
      deltas.push(0);
      return line;
    }
    const existing = kind.family.exec(line);
    const stripped = existing ? line.slice(existing[0].length) : line;
    if (allMatch) {
      deltas.push(stripped.length - line.length);
      return stripped;
    }
    const out = kind.make(counter++) + stripped;
    deltas.push(out.length - line.length);
    return out;
  });

  const block = next.join("\n");
  const result = text.slice(0, from) + block + text.slice(to);

  if (single) {
    // A selection that starts at the line's very beginning keeps doing so,
    // so the marker stays inside it and toggling again strips it cleanly.
    return {
      text: result,
      start: start !== end && start === from ? from : Math.max(from, start + deltas[0]),
      end: Math.max(from, end + deltas[0]),
    };
  }
  return { text: result, start: from, end: from + block.length };
}

const URL_RE = /^https?:\/\/\S+$/i;

// [text](url) around the selection, leaving "url" selected so the next
// keystroke replaces it. A selected URL goes in the parens instead and the
// caret lands in the empty label (as it does with no selection at all).
export function insertLink(rawState) {
  const { text, start, end } = normalize(rawState);
  const selected = text.slice(start, end);

  if (URL_RE.test(selected.trim())) {
    const url = selected.trim();
    return {
      text: text.slice(0, start) + `[](${url})` + text.slice(end),
      start: start + 1,
      end: start + 1,
    };
  }

  // Nothing selected: label first, so the caret goes inside the brackets.
  if (selected === "") {
    return {
      text: text.slice(0, start) + "[](url)" + text.slice(end),
      start: start + 1,
      end: start + 1,
    };
  }

  const urlStart = start + selected.length + 3; // "[" + selected + "](" -> url
  return {
    text: text.slice(0, start) + `[${selected}](url)` + text.slice(end),
    start: urlStart,
    end: urlStart + 3,
  };
}

// ``` fence around the selection, on its own lines.
export function insertCodeBlock(rawState) {
  const { text, start, end } = normalize(rawState);
  const selected = text.slice(start, end);
  const lead = start > 0 && text[start - 1] !== "\n" ? "\n" : "";
  const trail = end < text.length && text[end] !== "\n" ? "\n" : "";
  const block = `${lead}\`\`\`\n${selected}\n\`\`\`${trail}`;
  const innerStart = start + lead.length + 4;
  return {
    text: text.slice(0, start) + block + text.slice(end),
    start: innerStart,
    end: innerStart + selected.length,
  };
}

// Backticks for a single line, a fenced block once the selection spans lines.
export function toggleInlineCode(rawState) {
  const { text, start, end } = normalize(rawState);
  if (text.slice(start, end).includes("\n")) return insertCodeBlock(rawState);
  return wrapSelection(rawState, "`");
}

// Drops `str` at the caret (replacing any selection), caret ends after it.
export function insertAtCursor(rawState, str) {
  const { text, start, end } = normalize(rawState);
  return {
    text: text.slice(0, start) + str + text.slice(end),
    start: start + str.length,
    end: start + str.length,
  };
}

// "@" for a mention - padded with a space when it would otherwise be glued to
// the previous word (which would turn it into part of an email-like token).
export function insertMentionTrigger(rawState) {
  const { text, start } = normalize(rawState);
  const needsSpace = start > 0 && !isSpace(text[start - 1]);
  return insertAtCursor(rawState, needsSpace ? " @" : "@");
}

// ---- Inline image upload placeholders -------------------------------------
//
// While a photo uploads, the editor holds a `![Uploading 18232409...]()`
// placeholder where the image will go (same convention as GitHub's editor).
// When the upload settles the placeholder is swapped for the real
// `![image](url)` - located by its text, not its offset, since the user may
// well have kept typing in the meantime.

export const UPLOAD_TOKEN_RE = /!\[Uploading [^\]\n]*\.\.\.\]\(\)/;

export const createUploadToken = (text = "") => {
  let token;
  do {
    const id = Math.floor(10000000 + Math.random() * 89999999);
    token = `![Uploading ${id}...]()`;
  } while (text.includes(token));
  return token;
};

export const hasPendingUploads = (text) => UPLOAD_TOKEN_RE.test(text || "");

// Puts the tokens at the caret, each on its own line, caret after the last.
export function insertImageTokens(rawState, tokens) {
  const { text, start, end } = normalize(rawState);
  const lead = start > 0 && text[start - 1] !== "\n" ? "\n" : "";
  const insert = `${lead}${tokens.join("\n")}\n`;
  return {
    text: text.slice(0, start) + insert + text.slice(end),
    start: start + insert.length,
    end: start + insert.length,
  };
}

// Swaps `token` for `replacement` (an empty replacement removes the token and
// the line break it owned), keeping the selection pointing at the same text.
// A token the user already deleted is simply gone - the state comes back
// untouched.
export function replaceToken(rawState, token, replacement) {
  const { text, start, end } = normalize(rawState);
  const index = text.indexOf(token);
  if (index === -1) return { text, start, end };

  let removeLength = token.length;
  if (replacement === "" && text[index + token.length] === "\n") removeLength += 1;

  const next = text.slice(0, index) + replacement + text.slice(index + removeLength);
  const delta = replacement.length - removeLength;
  const tokenEnd = index + removeLength;

  const shift = (offset) => {
    if (offset >= tokenEnd) return offset + delta;
    if (offset > index) return index + replacement.length;
    return offset;
  };

  return { text: next, start: shift(start), end: shift(end) };
}

// Undo can bring back a snapshot taken while an upload was in flight. If that
// upload has since finished, its placeholder would be resurrected with nothing
// left to ever replace it (and it blocks publishing) - so drop every
// placeholder that isn't one of the uploads still running.
export function stripStaleUploadTokens(text, activeTokens) {
  return text.replace(/!\[Uploading [^\]\n]*\.\.\.\]\(\)\n?/g, (match) =>
    activeTokens.has(match.replace(/\n$/, "")) ? match : "",
  );
}

// ---- Enter inside a list / quote ------------------------------------------

const CONTINUABLE_LINE = /^(\s*)(?:([-*+])|(\d{1,9})([.)])|(>))\s(.*)$/;

// GitHub behaviour: Enter on a list item starts the next item ("1." -> "2.",
// "> " stays "> "), and Enter on an *empty* item ends the list instead.
//
// Works from the before/after text of a change (all a TextInput reports), so
// it recognises "exactly one newline was inserted at p" and nothing else -
// pasted text, deletions and edits elsewhere come back null (= leave alone).
// Returns { text, caret } to apply instead, or null.
export function continueListOnEnter(prev, next) {
  if (next.length !== prev.length + 1) return null;
  let p = 0;
  while (p < prev.length && prev[p] === next[p]) p++;
  if (next[p] !== "\n" || next.slice(0, p) + next.slice(p + 1) !== prev) return null;

  const lineStart = prev.lastIndexOf("\n", p - 1) + 1;
  let lineEnd = prev.indexOf("\n", p);
  if (lineEnd === -1) lineEnd = prev.length;

  // Inside a ``` fence a "- " line is code, not a list.
  const fences = prev.slice(0, lineStart).match(/^\s{0,3}```/gm);
  if (fences && fences.length % 2 === 1) return null;

  const before = prev.slice(lineStart, p);
  const rest = prev.slice(p, lineEnd);
  const match = CONTINUABLE_LINE.exec(before);
  if (!match) return null;

  const [, indent, bullet, number, sep, quote, content] = match;
  if (content.trim() === "") {
    if (rest !== "") return null; // Enter with the caret in the marker: plain newline
    const text = prev.slice(0, lineStart) + prev.slice(p);
    return { text, caret: lineStart };
  }

  const marker = quote
    ? `${indent}> `
    : bullet
      ? `${indent}${bullet} `
      : `${indent}${Number(number) + 1}${sep} `;
  const text = next.slice(0, p + 1) + marker + next.slice(p + 1);
  return { text, caret: p + 1 + marker.length };
}
