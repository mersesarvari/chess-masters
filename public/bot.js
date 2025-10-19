let oldUrl = "";
let url = "";

// -----------------------------
// Helper functions
// -----------------------------

function checkIfBotActive() {
  chrome.storage.local.get(["active"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error getting data:", chrome.runtime.lastError);
      return;
    }
    console.log("Retrieved value:", result.active);
    if (result.active === "true") {
      StartCommand();
    }
  });
}

function getStartCommand() {
  if (!url) {
    console.log("No URL found, stopping");
    return "stop";
  }
  if (url.includes("lichess.org")) {
    console.log("You are playing on Lichess.org");
    return "startLichessOrg";
  } else if (url.includes("chess.com")) {
    console.log("You are playing on Chess.com");
    return "startChessCom";
  } else {
    console.log("Else, stopping");
    return "stop";
  }
}

async function login(email, password, sendResponse) {
  try {
    const response = await fetch("https://www.chesssolve.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      await chrome.storage.local.set({ email, password });
      console.log("Login successful");
      sendResponse({ status: "Login successful", success: true });
    } else {
      console.error("Login failed:", response);
      sendResponse({ status: "Login failed", success: false });
    }
  } catch (error) {
    console.error("Login error:", error);
    sendResponse({ status: `Login failed: ${error}`, success: false });
  }
}

function Stop() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: "stop" });
  });
}

function StartCommand() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) {
      console.log("[BACKGROUND]: No active tab URL yet, will retry in 200ms");
      setTimeout(StartCommand, 200);
      return;
    }

    url = tabs[0].url;
    if (oldUrl !== url) oldUrl = url;

    console.log("[BACKGROUND]: Preparing to start", url);
    Stop();

    // Wait 300ms before starting (adjust if needed)
    setTimeout(() => {
      console.log("[BACKGROUND]: Start command sent", url);
      chrome.tabs.sendMessage(tabs[0].id, { action: getStartCommand() });
    }, 300);
  });
}

// -----------------------------
// Initialization
// -----------------------------

checkIfBotActive();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.active) {
    const newValue = changes.active.newValue;
    console.log(`Active changed to: ${newValue}`);
    if (newValue === "true") {
      StartCommand();
    }
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete" && tab && tab.url) {
      url = tab.url;
      if (oldUrl !== url) {
        oldUrl = url;
        checkIfBotActive();
      }
    }
  } catch (error) {
    console.error("[BACKGROUND] Unexpected error:", error);
  }
});

// -----------------------------
// Message listener
// -----------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "start":
      chrome.storage.local.set({ active: "true" }, () => {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
        else console.log("[BOT]: active=true");
      });
      StartCommand();
      break;

    case "stop":
      chrome.storage.local.set({ active: "false" }, () => {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
        else console.log("[BOT]: active=false");
      });
      Stop();
      break;

    case "login":
      login(request.email, request.password, sendResponse);
      return true; // Keep async channel open

    case "getMove":
      if (!request.fen) {
        sendResponse({ success: false, error: "FEN not provided" });
        return;
      }

      const stockfishUrl = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(
        request.fen
      )}&depth=12`;

      fetch(stockfishUrl)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const bestMove = data.bestmove.split(" ")[1];
            sendResponse({
              success: true,
              bestmove: bestMove,
              evaluation: data.evaluation,
              mate: data.mate,
              continuation: data.continuation,
            });
          } else {
            sendResponse({
              success: false,
              error: "Stockfish API returned failure",
            });
          }
        })
        .catch((error) => {
          console.error("Error fetching Stockfish API:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep async channel open

    default:
      console.warn("Unknown action:", request.action);
  }
});
