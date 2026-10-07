// The HTML renderer collapses the line breaks and indentation inside
// <pre> (a fenced code block came out as one long line), so they are turned
// into what it does keep: <br> and non-breaking spaces.
export function preserveCodeBlocks(html) {
  if (!html || html.indexOf("<pre") === -1) return html;

  return html.replace(/(<pre\b[^>]*>)([\s\S]*?)(<\/pre>)/gi, (match, open, body, close) => {
    const kept = body
      .replace(/\r\n?/g, "\n")
      // The newline Markdown leaves before </code></pre> is not a line.
      .replace(/\n(<\/code>)?\s*$/, "$1")
      .replace(/\t/g, "  ")
      .replace(/(^|\n) +| {2,}/g, (run) => run.replace(/ /g, "&nbsp;"))
      .replace(/\n/g, "<br>");
    return open + kept + close;
  });
}

// Replace @username in post/comment HTML text nodes with clickable profile
// links, matching the web client's src/utils/mentionRender.js.
//
// validMentions: Set of lowercase usernames confirmed valid by the server
// (post.mentions / comment.mentions). When null, falls back to linking all
// @username patterns (backward compat).
//
// allowBroadcastMention: comments/chat support "@all" as a special "notify
// everyone" broadcast tag that's always highlighted even though no account
// can actually be named "all". Posts don't have that feature, so "@all" in
// a post is just an ordinary (never-valid) mention there and renders as
// plain text like any other nonexistent username.
export function linkifyMentionsInHtml(html, validMentions = null, { allowBroadcastMention = false } = {}) {
  if (!html) return html;
  // New format: server already rendered [@Profile Name](/username) as <a href="/username">@Profile Name</a>
  let result = html.replace(
    /<a href="\/all">(@[^<]+)<\/a>/g,
    allowBroadcastMention ? '<span class="mention-tag">$1</span>' : "$1"
  );
  result = result.replace(
    /<a href="(\/[\w.-]{2,})">(@[^<]+)<\/a>/g,
    '<a href="$1" class="mention-tag">$2</a>'
  );
  // Old plain format: @username in text nodes
  result = result.replace(/(<[^>]+>)|(@([\w.-]{2,}))/g, (match, tag, _mention, username) => {
    if (tag) return tag;
    if (username.toLowerCase() === "all") {
      return allowBroadcastMention ? `<span class="mention-tag">@${username}</span>` : match;
    }
    if (validMentions == null || !validMentions.has(username.toLowerCase())) return match;
    return `<a href="/${username}" class="mention-tag">@${username}</a>`;
  });
  return preserveCodeBlocks(result);
}
