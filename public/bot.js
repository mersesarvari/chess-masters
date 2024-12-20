let oldUrl = "";
let url = "";

// Checking if the chrome.storage.local "active" object is true
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

checkIfBotActive();

// Listen for changes in chrome.storage.local
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.active) {
    const newValue = changes.active.newValue;
    console.log(`Active changed to: ${newValue}`);
    if (newValue === "true") {
      StartCommand(); // Automatically send the start command when active is true
    }
  }
});

// Start listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    // Setting "active" in chrome.storage.local to true
    chrome.storage.local.set({ active: "true" }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error setting data:", chrome.runtime.lastError);
        return;
      }
      console.log("[BOT]: active=true");
    });

    StartCommand();
  }
  if (request.action === "stop") {
    chrome.storage.local.set({ active: "false" }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error setting data:", chrome.runtime.lastError);
        return;
      }
      console.log("[BOT]: active=false");
    });
    console.log("[BACKGROUND]: Stop command received");
    chrome.tabs?.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs?.sendMessage(tabs[0].id, {
        action: "stop",
      });
    });
    return true;
  }
  if (request.action === "login") {
    login(request.email, request.password, sendResponse);
    return true;
  }
});

// Getting the current URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    console.log("[BOT]: Updated tab URL: ", tab.url);
    // Check if tab and tab.url exist before using includes
    if (changeInfo.status === "complete" && tab && tab.url) {
      url = tab.url;
      if (oldUrl !== url) {
        oldUrl = url;
        //Checking if the bot has to start
        checkIfBotActive();
      }
    }
  } catch (error) {
    console.error("[BACKGROUND] Unexpected error:", error);
  }
});

function getStartCommand() {
  if (url.includes("lichess.org")) {
    console.log("You are playing on Lichess.org");
    return "startLychessOrg";
  } else if (url.includes("chess.com")) {
    console.log("You are playing on Chess.com");
    return "startChessCom";
  } else {
    return "stop";
  }
}

async function login(email, password, sendResponse) {
  try {
    const response = await fetch("https://www.chessmaster.cloud/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
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

async function StartCommand() {
  console.log("[BACKGROUND]: Start command received");
  console.log("[BACKGROUND]: ", url);
  chrome.tabs?.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs?.sendMessage(tabs[0].id, {
      action: getStartCommand(),
    });
  });
  return true;
}
