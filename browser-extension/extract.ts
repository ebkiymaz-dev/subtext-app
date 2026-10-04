/** Called only after a user's Scan action. Never inspect hidden inbox history. */
export function visible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && !element.closest('[aria-hidden="true"], [hidden]');
}
export function visibleText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,noscript,input,textarea,[contenteditable="true"],button,nav,aside') || !visible(parent)) continue;
    const value = node.textContent?.trim();
    if (value) parts.push(value);
  }
  return parts.join("\n").slice(0, 12000);
}
export function captureVisible(host: string, selection: string): { text: string; source: string } {
  if (selection.trim()) return { text: selection.trim().slice(0, 12000), source: "Selected text — review names and order" };
  if (host === "web.whatsapp.com") {
    const messages = [...document.querySelectorAll('#main [data-pre-plain-text]')].filter(visible);
    if (messages.length) return {
      text: messages.map(el => {
        // WhatsApp Web metadata orders time/date differently from exports.
        // Preserve the explicit name, not an alternating-speaker guess.
        const label = (el.getAttribute("data-pre-plain-text") || "").replace(/^\[[^\]]{1,100}\]\s*/u, "").trim();
        return `${label.endsWith(":") ? label : "Unassigned:"} ${visibleText(el)}`;
      }).join("\n").slice(0, 12000),
      source: "WhatsApp — visible messages only, up to 12,000 characters",
    };
  }
  // A single visible email body / conversation log is unambiguous. Multiple
  // matches are never combined: that could mix people or separate emails.
  const selector = host === "mail.google.com" ? ".a3s" : '[role="log"]';
  const areas = [...document.querySelectorAll(selector)].filter(visible);
  if (areas.length === 1) return { text: visibleText(areas[0]), source: host === "mail.google.com" ? "Gmail — visible email; select single-email mode" : "Visible conversation — review names and order" };
  return { text: "", source: "Highlight the conversation or email text, then tap Subtext again. This page does not expose one clearly identifiable conversation." };
}
