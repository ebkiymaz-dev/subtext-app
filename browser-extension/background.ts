const API = "https://neonjungletools.com/subtext/api";
const hosts = new Set(["web.whatsapp.com", "www.instagram.com", "www.messenger.com", "www.facebook.com", "mail.google.com", "outlook.live.com", "outlook.office.com"]);
chrome.action.onClicked.addListener(async tab => {
  if (tab.id === undefined) return;
  try {
    if (!tab.url || !hosts.has(new URL(tab.url).hostname)) throw new Error("Unsupported page");
    const result = await chrome.tabs.sendMessage(tab.id, { type: "SUBTEXT_OPEN" }, { frameId: 0 });
    if (!result?.ok) throw new Error("Open a conversation first");
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    await chrome.action.setTitle({ tabId: tab.id, title: "Use Subtext to analyze text" });
  } catch {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    await chrome.action.setTitle({ tabId: tab.id, title: "Open a supported web chat or email, reload the page, then click Subtext." });
  }
});
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
let sessionFlight: Promise<unknown> | null = null;
async function post(path: string, data: object) {
  const response = await fetch(`${API}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store", signal: AbortSignal.timeout(150000) });
  return response.json();
}
async function session() {
  const stored = await chrome.storage.local.get("answeraceToken");
  const result = await post("answer-ace-session", { token: stored.answeraceToken });
  if (result.ok && result.token) await chrome.storage.local.set({ answeraceToken: result.token });
  return result;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url || sender.tab?.id === undefined) return;
  const senderUrl = new URL(sender.url);
  if (`${senderUrl.protocol}//${senderUrl.host}${senderUrl.pathname}` !== chrome.runtime.getURL("panel.html")) return;
  const nonce = senderUrl.searchParams.get("session");
  if (!nonce || !/^[a-f0-9-]{36}$/.test(nonce)) return;
  const tabId = sender.tab.id;
  const task = async () => {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !hosts.has(new URL(tab.url).hostname)) throw new Error("Unsupported tab");
    const authorized = await chrome.tabs.sendMessage(tabId, { type: "SUBTEXT_PANEL_AUTH", nonce }, { frameId: 0 });
    if (!authorized?.ok) throw new Error("Inactive panel");
    if (message.type === "DISCLOSURE") {
      const response = await fetch(`${API}/capabilities/`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      return (await response.json()).coachProvider;
    }
    if (message.type === "SCAN") return chrome.tabs.sendMessage(tabId, { type: "SUBTEXT_CAPTURE" }, { frameId: 0 });
    if (message.type === "CLOSE") return chrome.tabs.sendMessage(tabId, { type: "SUBTEXT_CLOSE" }, { frameId: 0 });
    if (message.type === "SESSION") {
      if (!sessionFlight) sessionFlight = session().finally(() => { sessionFlight = null; });
      return sessionFlight;
    }
    throw new Error("Unsupported request");
  };
  task().then(respond, () => respond({ ok: false, reason: "Subtext could not complete that action. Try again." }));
  return true;
});
