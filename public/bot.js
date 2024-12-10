let url = "";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "login") {
    login(request.email, request.password, sendResponse);
    return true;
  }
});

//Start listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    console.log("[BACKGROUND]: Start command recieved");
    console.log("[BACKGROUND]: ", url);
    chrome.tabs?.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs?.sendMessage(tabs[0].id, {
        action: getStartCommand(),
      });
    });
    return true;
  }
});

//Stop listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "stop") {
    console.log("[BACKGROUND]: Stop command recieved");
    chrome.tabs?.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs?.sendMessage(tabs[0].id, {
        action: "stop",
      });
    });
    return true;
  }
});

//Getting the current url
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    // Check if tab and tab.url exist before using includes
    if (changeInfo.status === "complete" && tab && tab.url) {
      url = tab.url;
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
