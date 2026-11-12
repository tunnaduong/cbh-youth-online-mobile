import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";

// Long posts used to be handed to RenderHTML in one piece: expanding one froze
// the feed while the whole tree was built. The HTML is cut into chunks at its
// top-level blocks and the next chunk is only mounted once the reader has
// scrolled close to the end of what is already on screen.

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);
const TARGET_CHUNK_CHARS = 1200;
const LOOKAHEAD_PX = 700; // start loading the next chunk this far below the screen
const POLL_MS = 250;

// Split at depth 0 into top-level blocks, then group them into chunks of about
// TARGET_CHUNK_CHARS. Anything unbalanced -> one chunk (same as before).
export function splitHtmlIntoChunks(html) {
  if (!html || html.length <= TARGET_CHUNK_CHARS) return [html || ""];
  const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  const blocks = [];
  let depth = 0;
  let blockStart = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    if (m[0].startsWith("<!--")) continue;
    const name = m[1].toLowerCase();
    const isClose = m[0][1] === "/";
    const selfClosing = m[2] === "/" || VOID_TAGS.has(name);
    if (isClose) {
      depth -= 1;
      if (depth < 0) return [html];
    } else if (!selfClosing) {
      depth += 1;
    }
    if (depth === 0) {
      const end = m.index + m[0].length;
      blocks.push(html.slice(blockStart, end));
      blockStart = end;
    }
  }
  if (depth !== 0) return [html];
  if (blockStart < html.length) blocks.push(html.slice(blockStart));
  if (blocks.length < 2) return [html];

  const chunks = [];
  let cur = "";
  for (const b of blocks) {
    cur += b;
    if (cur.length >= TARGET_CHUNK_CHARS) {
      chunks.push(cur);
      cur = "";
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function ChunkedHtml({ html, expanded, htmlProps }) {
  const chunks = useMemo(() => splitHtmlIntoChunks(html), [html]);
  const [count, setCount] = useState(1);
  const sentinelRef = useRef(null);
  const total = chunks.length;

  // Collapsed: only the first chunk is ever mounted (the rest is clipped away).
  const wanted = expanded ? Math.min(count, total) : 1;
  const hasMore = expanded && wanted < total;

  // Reader-driven loading: while more chunks are waiting, check where the
  // sentinel under the last mounted chunk is and mount the next one when it is
  // near the screen. Stops by itself when everything is loaded / collapsed.
  useEffect(() => {
    if (!hasMore) return undefined;
    const timer = setInterval(() => {
      const node = sentinelRef.current;
      if (!node || !node.measureInWindow) return;
      node.measureInWindow((x, y, w, h) => {
        if (y === 0 && h === 0) return; // not laid out / off-screen container
        if (y < Dimensions.get("window").height + LOOKAHEAD_PX) {
          setCount((c) => Math.min(c + 1, total));
        }
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [hasMore, wanted, total]);

  // Content changed (edit / translation): start again from the first chunk.
  useEffect(() => {
    setCount(1);
  }, [html]);

  return (
    <View>
      {chunks.slice(0, wanted).map((chunk, i) => (
        <RenderHTML key={i} source={{ html: chunk }} {...htmlProps} />
      ))}
      {hasMore ? <View ref={sentinelRef} collapsable={false} style={{ height: 1 }} /> : null}
    </View>
  );
}

export default memo(ChunkedHtml);
