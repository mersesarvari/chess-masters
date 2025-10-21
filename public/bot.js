//bot.js (background script)

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
    const data = await response.json();

    if (response.ok && data.token) {
      // Store email + token instead of password
      //await chrome.storage.local.set({ email, token: data.token });
      console.log("Login successful");
      sendResponse({
        status: "Login successful",
        success: true,
        token: data.token,
      });
    } else {
      console.error("Login failed:", data.message);
      sendResponse({ status: `Login failed: ${data.message}`, success: false });
    }
  } catch (error) {
    console.error("Login error:", error);
    sendResponse({ status: `Login failed: ${error}`, success: false });
  }
}

function Stop() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return resolve(false);

      const tabId = tabs[0].id;

      const listener = (message, sender) => {
        if (
          sender.tab &&
          sender.tab.id === tabId &&
          message.action === "stoppedAck"
        ) {
          chrome.runtime.onMessage.removeListener(listener);
          resolve(true);
        }
      };

      chrome.runtime.onMessage.addListener(listener);
      chrome.tabs.sendMessage(tabId, { action: "stop" });

      // Fallback timeout if no ack within 500 ms
      setTimeout(() => resolve(false), 500);
    });
  });
}

async function StartCommand() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0] || !tabs[0].url) {
      console.log("[BACKGROUND]: No active tab URL yet, retrying...");
      setTimeout(StartCommand, 200);
      return;
    }

    url = tabs[0].url;
    if (oldUrl !== url) oldUrl = url;

    console.log("[BACKGROUND]: Preparing to start", url);
    await Stop(); // ✅ Wait until stop acknowledged

    console.log("[BACKGROUND]: Start command sent", url);
    chrome.tabs.sendMessage(tabs[0].id, { action: getStartCommand() });
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
      if (!Array.isArray(request.moves)) {
        sendResponse({
          success: false,
          error: "Moves not provided or invalid",
        });
        return;
      }

      chrome.storage.local.get(["token"], async (result) => {
        const token = result.token;
        if (!token) {
          sendResponse({ success: false, error: "Not authenticated" });
          return;
        }

        try {
          const res = await fetch("https://www.chesssolve.com/api/best", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ moves: request.moves }),
          });

          if (!res.ok) {
            if (res.status === 429) {
              // 1️⃣ Stop the bot
              await Stop();
              await chrome.storage.local.set({ active: "false" });

              // 2️⃣ Notify content script to show popup
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: "rateLimitHit",
                    });
                  }
                }
              );

              sendResponse({
                success: false,
                error: "Daily limit reached (20 requests/day)",
              });
            } else {
              sendResponse({
                success: false,
                error: `ChessSolve API returned status ${res.status}`,
              });
            }
            return;
          }

          const data = await res.json();

          if (data.bestmove) {
            sendResponse({
              success: true,
              fen: data.fen,
              bestmove: data.bestmove,
              from: data.from,
              to: data.to,
              evaluation: data.evaluation,
              dailyRequests: data.dailyRequests, // optional
              premium: data.premium, // optional
            });
          } else {
            sendResponse({
              success: false,
              error: data.message || "Invalid response from ChessSolve API",
            });
          }
        } catch (error) {
          console.error("Error calling ChessSolve API:", error);
          sendResponse({ success: false, error: error.message });
        }
      });

      return true; // Keep async channel open

    default:
      console.warn("Unknown action:", request.action);
  }
});
