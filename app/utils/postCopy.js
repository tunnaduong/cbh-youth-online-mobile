/**
 * Utility functions for extracting clean plain text from post HTML
 * and preparing formatted copyable text (Title + Caption).
 */

export function cleanHtmlToPlainText(html) {
  if (!html) return "";
  let text = String(html);

  // Normalize line-breaking tags to newlines
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");

  // Clean consecutive spaces and more than 2 consecutive newlines
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

export function getPostCopyableText(post) {
  if (!post) return "";
  const title = (post.title || "").trim();
  const content = cleanHtmlToPlainText(post.content || "");

  if (title && content) {
    return `${title}\n\n${content}`;
  }
  return title || content;
}
