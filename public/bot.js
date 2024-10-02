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
    setTimeout(initWebSocket, 1000);
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Request received:", request.action);

  if (request.action === "sendFEN") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          fen: request.fen,
          variants: 1,
          depth: 14,
          maxThinkingTime: 80,
        })
      );
      sendResponse({ status: "FEN sent" });
    } else {
      sendResponse({ status: "WebSocket not ready" });
    }
  }

  return true; // Indicates that the response is sent asynchronously
});
