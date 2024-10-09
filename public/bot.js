// Listen for messages from the content script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log("Request received:", request.action);

  if (request.action === "sendFEN") {
    /*
    if (ws && ws.readyState === WebSocket.OPEN) {
       ws.send(
        JSON.stringify({
          fen: request.fen,
          variants: 1,
          depth: 14,
          maxThinkingTime: 80,
        })
      ); 
    } else {
      sendResponse({ status: "WebSocket not ready" });
    }
      */
    // 1. Create a handy function for sending requests:

    async function postChessApi(fen) {
      try {
        const response = await fetch("https://chess-api.com/v1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fen }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        console.error("Error sending FEN:", error);
        return null; // Return null or handle the error as needed
      }
    }
    const apiData = await postChessApi(request.fen);

    sendResponse({ status: "FEN sent" });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "drawMove",
        move: apiData,
      });
    });
  }

  return true; // Indicates that the response is sent asynchronously
});

async function fetchMoveComparison(fen1, fen2) {
  if (!fen1 || !fen2) {
    throw new Error("[fetchMoveComparison] fen1 or fen2 are required");
  }
  const url = `https://www.chessmaster.cloud/api/chess?action=compare&fen1=${encodeURIComponent(
    fen1
  )}&fen2=${encodeURIComponent(fen2)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("API Response:", data);
    return data; // Process the data as needed
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "login") {
    console.log(
      `[AUTH:js]: ${request.action} command received! Email:${request.email} Password:${request.password}`
    );
    login(request.email, request.password, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

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
