// Checks on rendered HTML that every send platform would otherwise catch late
// (or not at all). Pure: HTML in, problems out.

/** Gmail clips messages over 102KB, hiding the footer and unsubscribe link. */
export const MAX_HTML_BYTES = 102 * 1024;

export function htmlProblems(html: string, unsubscribeUrl: string): string[] {
  const problems: string[] = [];
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) problems.push(`HTML is ${bytes} bytes; Gmail clips above ${MAX_HTML_BYTES}`);
  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt="[^"]+"/i.test(img)) problems.push(`image without alt text: ${img.slice(0, 120)}`);
    const src = img.match(/\bsrc="([^"]*)"/i)?.[1] ?? "";
    if (!src.startsWith("https://")) problems.push(`image src is not https: ${src || "(empty)"}`);
  }
  for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    if (!href!.startsWith("https://") && href !== unsubscribeUrl && !/^(\{\{.+\}\}|%%.+%%)$/.test(href!)) problems.push(`link is not https or a merge tag: ${href}`);
  }
  if (!html.includes(`href="${unsubscribeUrl}"`)) problems.push(`the unsubscribe link (${unsubscribeUrl}) is missing`);
  if (/figma\.com|amazonaws\.com\/figma/i.test(html)) problems.push("the HTML references Figma-hosted assets, which expire");
  return problems;
}
