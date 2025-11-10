import slugify from "@sindresorhus/slugify";

/**
 * Generate a URL-friendly slug from a Vietnamese title
 * @param {string} title - The title to convert to a slug
 * @param {Object} options - Optional configuration for slug generation
 * @returns {string} The generated slug
 */
export const generateSlug = (title) => {
  if (!title) return "untitled";

  const slug = slugify(title, {
    customReplacements: [
      ["đ", "d"],
      ["Đ", "D"],
      // Add more Vietnamese-specific replacements if needed
    ],
    lowercase: true,
    strict: true,
  });

  // If slug is empty or only contains dashes, return "untitled"
  if (!slug || slug.replace(/-/g, "") === "") {
    return "untitled";
  }

  return slug;
};

/**
 * Generate a full post URL slug with ID
 * @param {string} id - The post ID
 * @param {string} title - The post title
 * @returns {string} The generated slug with ID
 */
export const generatePostSlug = (id, title) => {
  return `${id}-${generateSlug(title)}`;
};
