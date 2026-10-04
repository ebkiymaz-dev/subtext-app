import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

await build({
  entryPoints: ["lib/walletConnect.ts"],
  outfile: ".eval-out/wallet-connect.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "react-dom/server", "next/*"],
});

const wallet = (await import(pathToFileURL(`${process.cwd()}/.eval-out/wallet-connect.cjs`))).default;

const page = "https://neonjungletools.com/subtext/plans/?wallet=phantom";
const phantomUrl = wallet.walletBrowseUrl("phantom", page);
assert.equal(
  phantomUrl,
  `https://phantom.com/ul/browse/${encodeURIComponent(page)}?ref=${encodeURIComponent("https://neonjungletools.com")}`,
);

const solflareUrl = wallet.walletBrowseUrl("solflare", page.replace("phantom", "solflare"));
assert.equal(
  solflareUrl,
  `https://solflare.com/ul/v1/browse/${encodeURIComponent(page.replace("phantom", "solflare"))}?ref=${encodeURIComponent("https://neonjungletools.com")}`,
);

let phantomCalls = 0;
const phantom = {
  isPhantom: true,
  publicKey: null,
  async connect() {
    phantomCalls += 1;
    this.publicKey = { toString: () => "Phantom111111111111111111111111111111111" };
    return { publicKey: this.publicKey };
  },
};
const phantomResult = await wallet.connectInjectedWallet("phantom", { phantom: { solana: phantom } });
assert.deepEqual(phantomResult, { status: "connected", address: "Phantom111111111111111111111111111111111" });
assert.equal(phantomCalls, 1);

let solflareCalls = 0;
const solflare = {
  isSolflare: true,
  publicKey: null,
  async connect() {
    solflareCalls += 1;
    this.publicKey = { toString: () => "Solflare11111111111111111111111111111111" };
    return { publicKey: this.publicKey };
  },
};
const solflareResult = await wallet.connectInjectedWallet("solflare", { solflare });
assert.deepEqual(solflareResult, { status: "connected", address: "Solflare11111111111111111111111111111111" });
assert.equal(solflareCalls, 1);

assert.deepEqual(await wallet.connectInjectedWallet("phantom", {}), { status: "unavailable" });
assert.deepEqual(await wallet.connectInjectedWallet("solflare", {}), { status: "unavailable" });

await assert.rejects(
  () => wallet.connectInjectedWallet("phantom", { phantom: { solana: { connect: async () => { throw new Error("User rejected"); } } } }),
  /User rejected/,
);

console.log("PASS: Phantom and Solflare browser connection plus official mobile browse handoff URLs");

await build({
  entryPoints: ["app/plans/page.tsx"],
  outfile: ".eval-out/wallet-plans.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "react-dom/server", "next/*"],
});
const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const plansModule = (await import(pathToFileURL(`${process.cwd()}/.eval-out/wallet-plans.cjs`))).default;
const PlansPage = plansModule.default;
const plansHtml = renderToStaticMarkup(React.createElement(PlansPage));
assert.match(plansHtml, />Connect Phantom</);
assert.match(plansHtml, />Connect Solflare</);
assert.doesNotMatch(plansHtml, /Create Solana payment/);
console.log("PASS: wallet connection controls render independently while payment remains hidden");
