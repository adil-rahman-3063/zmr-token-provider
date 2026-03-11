"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bgutils_js_1 = require("bgutils-js");
const jsdom_1 = require("jsdom");
const youtubei_js_1 = require("youtubei.js");
const http_1 = __importDefault(require("http"));
// --- Configuration ---
const PORT = process.env.PORT || 3000;
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
// --- Global State ---
let usage = 0;
// --- JSDOM Setup ---
// Set up a simulated DOM environment once at startup, as youtubei.js requires it.
const dom = new jsdom_1.JSDOM();
Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
});
// --- Route Handlers ---
/**
 * Handles requests to the /data endpoint.
 * A new Innertube instance is created for each request to ensure a fresh poToken is generated.
 */
async function handleDataRequest(res) {
    usage++;
    try {
        // Create a new Innertube instance on each call to get fresh visitor data.
        const innertube = await youtubei_js_1.Innertube.create({ retrieve_player: false });
        const visitorData = innertube.session.context.client.visitorData;
        if (!visitorData) {
            throw new Error("Could not retrieve visitor data from Innertube session.");
        }
        const bgConfig = {
            fetch: (input, init) => fetch(input, init),
            globalObj: globalThis,
            identifier: visitorData,
            requestKey: REQUEST_KEY,
        };
        const bgChallenge = await bgutils_js_1.BG.Challenge.create(bgConfig);
        if (!bgChallenge) {
            throw new Error("Could not create BG Challenge.");
        }
        const interpreterJs = bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
        if (interpreterJs) {
            new Function(interpreterJs)();
        }
        else {
            throw new Error("Could not load the VM from the BG Challenge.");
        }
        const poTokenResult = await bgutils_js_1.BG.PoToken.generate({
            program: bgChallenge.program,
            globalName: bgChallenge.globalName,
            bgConfig,
        });
        const responseBody = JSON.stringify({
            visitorData,
            poToken: poTokenResult.poToken,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(responseBody);
    }
    catch (error) {
        console.error("[/data] Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message || "An unexpected error occurred." }));
    }
}
/**
 * Handles requests to the /usage endpoint.
 */
function handleUsageRequest(res) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`${usage} requests made`);
}
/**
 * Handles all other requests with a simple "I'm Alive" message.
 */
function handleNotFound(res) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("I'm Alive");
}
// --- Server Initialization ---
function main() {
    const server = http_1.default.createServer((req, res) => {
        switch (req.url) {
            case "/data":
                handleDataRequest(res);
                break;
            case "/usage":
                handleUsageRequest(res);
                break;
            default:
                handleNotFound(res);
                break;
        }
    });
    server.listen(Number(PORT), "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}
main();
