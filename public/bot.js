// WebSocket connection
let ws = new WebSocket("wss://chess-api.com/v1");

// Initialize WebSocket connection
function initWebSocket() {
  try {
    ws = new WebSocket("wss://chess-api.com/v1");
  } catch (error) {
    console.error("Error closing WebSocket:", error);
  }

  ws.onopen = () => {
    console.log("WebSocket connection established");
  };

  ws.onclose = (event) => {
    console.log("WebSocket connection closed:", event);
    // Attempt to reconnect after a delay
    setTimeout(initWebSocket, 200);
  };

  ws.onmessage = (event) => {
    try {
      const chessApiMessage = JSON.parse(event.data);
      console.log("Received message from chess API:", chessApiMessage);
      // Forward the message to the content script
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "drawMove",
          move: chessApiMessage,
        });
      });
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  };
}

// Initialize WebSocket on extension load
initWebSocket();
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
  const url = `https://chess-master-webpage.vercel.app/api/chess?action=compare&fen1=${encodeURIComponent(
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
