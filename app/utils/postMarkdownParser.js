// Live syntax highlighting for the post editor's MarkdownTextInput.
//
// The input's built-in parser targets Expensify's own dialect (single-char
// *bold*, ~strike~ ...), which isn't what the server renders - posts go
// through CommonMark. This one marks the CommonMark subset the toolbar emits
// (**bold**, _italic_, ~~strike~~, `code`, fences, # headings, > quotes,
// lists, [links](url), ![images](url)) plus @mentions.
//
// It runs on the live-markdown worklet runtime, so it must be one
// self-contained function: no imports or outer-scope helpers are visible there.
//
// Range convention (same as the library's own parser): the styled range
// covers the inner text, and the markers around it get their own "syntax"
// ranges so they can be dimmed.

export function postMarkdownParser(input) {
  "worklet";
  try {
    const ranges = [];
    const add = (type, start, length) => {
      if (length > 0) ranges.push({ type, start, length });
    };

    const lines = input.split("\n");
    let offset = 0;
    let inFence = false;
    let fenceStart = 0;
    let quote = null;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineStart = offset;
      const lineEnd = lineStart + line.length;
      offset = lineEnd + 1;

      if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) {
        add("syntax", lineStart, line.length);
        if (!inFence) {
          inFence = true;
          fenceStart = lineStart;
        } else {
          inFence = false;
          add("pre", fenceStart, lineEnd - fenceStart);
        }
        quote = null;
        continue;
      }
      if (inFence) continue;

      // ---- block level ----
      const heading = /^(#{1,6})(\s+)/.exec(line);
      if (heading) {
        add("h1", lineStart, line.length);
        add("syntax", lineStart, heading[0].length);
      }

      const quoteMatch = /^(\s{0,3}>\s?)/.exec(line);
      if (quoteMatch) {
        add("syntax", lineStart, quoteMatch[1].length);
        if (quote) {
          quote.length = lineEnd - quote.start;
        } else {
          quote = { type: "blockquote", start: lineStart, length: line.length };
          ranges.push(quote);
        }
      } else {
        quote = null;
        const list = /^(\s*)([-*+]|\d{1,9}[.)])\s/.exec(line);
        if (list) add("syntax", lineStart + list[1].length, list[2].length);
      }

      // ---- inline level ----
      // `work` mirrors the line with already-claimed spans blanked out so a
      // later rule can't re-match inside (a `_` in a URL, `*` in code ...).
      let work = line;
      const claim = (from, to) => {
        work = work.slice(0, from) + "\u0000".repeat(to - from) + work.slice(to);
      };

      let m;

      const codeRe = /`([^`\n]+)`/g;
      while ((m = codeRe.exec(work)) !== null) {
        add("syntax", lineStart + m.index, 1);
        add("code", lineStart + m.index + 1, m[1].length);
        add("syntax", lineStart + m.index + 1 + m[1].length, 1);
        claim(m.index, m.index + m[0].length);
      }

      const linkRe = /(!?)\[([^\]\n]*)\]\(([^)\s]*)\)/g;
      while ((m = linkRe.exec(work)) !== null) {
        const open = m[1].length + 1;
        add("syntax", lineStart + m.index, open);
        add("link", lineStart + m.index + open, m[2].length);
        add("syntax", lineStart + m.index + open + m[2].length, m[0].length - open - m[2].length);
        claim(m.index, m.index + m[0].length);
      }

      const urlRe = /https?:\/\/[^\s<>()]+/g;
      while ((m = urlRe.exec(work)) !== null) {
        add("link", lineStart + m.index, m[0].length);
        claim(m.index, m.index + m[0].length);
      }

      const mentionRe = /@[\p{L}\p{N}\p{M}_.-]+/gu;
      while ((m = mentionRe.exec(work)) !== null) {
        add("mention-user", lineStart + m.index, m[0].length);
        claim(m.index, m.index + m[0].length);
      }

      // `pattern` is the marker as regex source, `size` its literal length.
      const pairRe = (pattern, size, type) => {
        const re = new RegExp(pattern + "(\\S(?:.*?\\S)?)" + pattern, "g");
        let hit;
        while ((hit = re.exec(work)) !== null) {
          add("syntax", lineStart + hit.index, size);
          add(type, lineStart + hit.index + size, hit[1].length);
          add("syntax", lineStart + hit.index + size + hit[1].length, size);
          // Blank only the markers: the inside stays visible so nested
          // emphasis (**_x_**) still gets matched.
          claim(hit.index, hit.index + size);
          claim(hit.index + size + hit[1].length, hit.index + 2 * size + hit[1].length);
        }
      };
      pairRe("\\*\\*", 2, "bold");
      pairRe("~~", 2, "strikethrough");

      const italicRe = /(^|[^\w])_(?!_)(\S(?:[^_]*?\S)?)_(?!\w)/g;
      while ((m = italicRe.exec(work)) !== null) {
        const start = lineStart + m.index + m[1].length;
        add("syntax", start, 1);
        add("italic", start + 1, m[2].length);
        add("syntax", start + 1 + m[2].length, 1);
      }
    }

    // Unterminated fence: style through the end, like GitHub does.
    if (inFence) add("pre", fenceStart, input.length - fenceStart);

    // Outer ranges first so inner styling is layered on top of them.
    ranges.sort((a, b) => a.start - b.start || b.length - a.length);
    return ranges;
  } catch (e) {
    return [];
  }
}
