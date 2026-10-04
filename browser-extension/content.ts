import { captureVisible } from "./extract";

const host = document.createElement("div");
host.style.cssText = "position:fixed;right:16px;top:64px;z-index:2147483647;";
const shadow = host.attachShadow({ mode: "closed" });
let frame: HTMLIFrameElement | null = null;
let selection = "";
let panelNonce = "";
let locationAtOpen = location.href;
let previousFocus: HTMLElement | null = null;

function supportedLocation() {
  if (location.hostname === "www.instagram.com") return location.pathname.startsWith("/direct/");
  if (location.hostname === "www.facebook.com") return location.pathname.startsWith("/messages/");
  if (location.hostname.startsWith("outlook.")) return location.pathname.startsWith("/mail/");
  return true;
}
function close() {
  frame?.remove(); frame = null; host.remove(); selection = ""; panelNonce = "";
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
}
function open() {
  if (!supportedLocation()) return false;
  if (frame) { close(); return true; }
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  selection = window.getSelection()?.toString() || "";
  frame = document.createElement("iframe");
  panelNonce = crypto.randomUUID();
  frame.src = chrome.runtime.getURL(`panel.html?session=${panelNonce}`);
  frame.title = "Subtext conversation assistant";
  frame.allow = "clipboard-write";
  frame.style.cssText = "width:min(420px,calc(100vw - 32px));height:min(740px,calc(100vh - 96px));border:1px solid #9c7c50;border-radius:18px;background:#f3e9d9;box-shadow:0 12px 50px #0005;";
  shadow.append(frame);
  document.documentElement.append(host);
  locationAtOpen = location.href;
  return true;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  // Open only through our extension broker; no floating control or idle reads.
  if (message.type === "SUBTEXT_OPEN") { respond({ ok: open() }); return; }
  if (!frame || location.href !== locationAtOpen) return;
  if (message.type === "SUBTEXT_PANEL_AUTH") { respond({ ok: message.nonce === panelNonce }); return; }
  if (message.type === "SUBTEXT_CAPTURE") { respond(captureVisible(location.hostname, selection)); selection = ""; }
  if (message.type === "SUBTEXT_CLOSE") { close(); respond({ ok: true }); }
});
document.addEventListener("keydown", event => { if (event.key === "Escape" && frame) close(); });
// Route changes clear the unsaved panel, never read the new conversation.
setInterval(() => { if (frame && location.href !== locationAtOpen) close(); }, 700);
