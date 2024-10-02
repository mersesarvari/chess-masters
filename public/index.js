document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded");

  const startButton = document.getElementById("startBot");
  const stopButton = document.getElementById("stopBot");
  const statusDiv = document.getElementById("status");

  if (!startButton) console.error("Start button not found");
  if (!stopButton) console.error("Stop button not found");
  if (!statusDiv) console.error("Status div not found");

  function sendMessage(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: action },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("Error:", chrome.runtime.lastError);
            if (statusDiv)
              statusDiv.textContent =
                "Error: " + chrome.runtime.lastError.message;
          } else {
            console.log("Response received:", response);
            if (statusDiv)
              statusDiv.textContent =
                `Bot ${action}ed: ` +
                (response ? response.status : "No status");
          }
        }
      );
    });
  }

  if (startButton) {
    startButton.addEventListener("click", function () {
      console.log("Start button clicked");
      sendMessage("startBot");
    });
  }

  if (stopButton) {
    stopButton.addEventListener("click", function () {
      console.log("Stop button clicked");
      sendMessage("stopBot");
    });
  }
});

console.log("popup.js loaded");
