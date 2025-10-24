// chess-board.js (content script)
console.log("ChessCom content script loaded");

const chessCom = {
  mycolor: "w",
  isActive: false,
  observer: null,
  moves: [],

  showMoves: async function (moves) {
    try {
      console.log("Asking for best move from the server...");
      chrome.runtime.sendMessage(
        { action: "getMove", moves: moves },
        (response) => {
          console.log("Response:", response);

          if (chrome.runtime.lastError) {
            console.error("Message failed:", chrome.runtime.lastError.message);
            return;
          }

          if (response && response.success && response.from && response.to) {
            chessCom.drawArrow(response.from, response.to);
          } else if (response && response.error?.includes("Daily limit")) {
            chessCom.showRateLimitPopup();
          }
        }
      );
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  },

  Start: async function () {
    chessCom.getColor();

    if (chessCom.isActive) {
      console.log("Already active.");
      return;
    }

    chessCom.isActive = true;
    console.log("[ChessSolve]: Started");

    const myTurn = () =>
      (chessCom.mycolor === "w" && chessCom.moves.length % 2 === 0) ||
      (chessCom.mycolor === "b" && chessCom.moves.length % 2 === 1);

    // Wait for <wc-simple-move-list> to load
    const waitForMoveList = async () => {
      for (let i = 0; i < 20; i++) {
        const el = document.querySelector("wc-simple-move-list");
        if (el) return el;
        await new Promise((res) => setTimeout(res, 500));
      }
      return null;
    };

    const moveListElement = await waitForMoveList();
    if (!moveListElement) {
      console.warn("Move list component not found!");
      return;
    }

    const shadowRoot = moveListElement.shadowRoot || moveListElement;
    const movesContainer = shadowRoot.querySelector("div");
    if (!movesContainer) {
      console.warn("No move container inside move list!");
      return;
    }

    // Initial capture
    chessCom.moves = chessCom.checkMoves().map((n) => n.moveText);

    // Observe shadow DOM changes to capture moves live
    chessCom.observer = new MutationObserver(async () => {
      const currentMoves = chessCom.checkMoves().map((n) => n.moveText);
      if (currentMoves.length > chessCom.moves.length) {
        const newMoves = currentMoves.slice(chessCom.moves.length);
        chessCom.moves.push(...newMoves);
        chessCom.clearArrows();
        if (myTurn()) await chessCom.showMoves(chessCom.moves);
      }
    });

    chessCom.observer.observe(movesContainer, {
      childList: true,
      subtree: true,
    });

    if (myTurn()) await chessCom.showMoves(chessCom.moves);

    // Start monitoring for game over
    chessCom.saveOnCheckMate();
  },

  Stop: function () {
    if (chessCom.observer) {
      chessCom.observer.disconnect();
      chessCom.observer = null;
    }
    chessCom.moves = [];
    chessCom.isActive = false;
    chessCom.clearArrows();
    console.log("[ChessSolve]: Stopped");
    chrome.runtime.sendMessage({ action: "stoppedAck" });
  },

  saveOnCheckMate: function () {
    if (!chessCom.isActive) return;

    const interval = setInterval(() => {
      const resultEl = document.querySelector(
        ".main-line-row.move-list-row.result-row .game-result"
      );
      if (!resultEl) return; // Game not finished yet

      const resultText = resultEl.textContent.trim();
      chessCom.clearArrows();

      let winColor = "-";
      if (resultText === "1-0") winColor = "w";
      else if (resultText === "0-1") winColor = "b";
      else if (resultText === "½-½") winColor = "draw";

      const finalMoves = [...chessCom.moves];

      chrome.storage.local.get(["email"], (result) => {
        const email = result.email;
        if (!email) return;

        const gameObject = {
          moves: finalMoves,
          winColor,
          myColor: chessCom.mycolor,
          email,
          source: "chess.com",
        };

        console.log("Sending game to background for saving:", gameObject);
        chrome.runtime.sendMessage(
          { action: "saveGame", game: gameObject },
          (res) => {
            if (res?.success) console.log("Game saved successfully!");
            else console.error("Failed to save game.");
          }
        );
      });

      clearInterval(interval);
      chessCom.moves = [];
    }, 500);
  },

  getWinner: function () {
    const winnerElement = document.querySelector(".header-title-component");
    return winnerElement
      ? winnerElement.textContent.trim()
      : "Winner not found";
  },

  checkMoves: function () {
    try {
      const nodes = document.querySelectorAll(".node");
      const result = [];
      nodes.forEach((move) => {
        let moveText = "";
        const dataNode = move.getAttribute("data-node");
        const pieceIcon = move?.querySelector("span[data-figurine]");
        if (!pieceIcon) {
          moveText = move?.querySelector("span")?.textContent?.trim();
        } else {
          const iconValue = pieceIcon.getAttribute("data-figurine");
          moveText = `${iconValue}${move
            .querySelector("span")
            ?.textContent?.trim()}`;
        }
        if (moveText) result.push({ dataNode, moveText });
      });
      return result;
    } catch (err) {
      console.error("checkMoves failed:", err);
      return [];
    }
  },

  getColor: function () {
    const board =
      document.querySelector("#board-play-computer") ||
      document.querySelector("#board-single");
    if (!board) return console.error("Chess board not found.");
    chessCom.mycolor = board.className.includes("flipped") ? "b" : "w";
    console.log(
      "You are with the",
      chessCom.mycolor === "w" ? "white" : "black",
      "pieces."
    );
  },

  chessNotationToMatrix: function (chessNotation) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const file = chessNotation.charAt(0);
    const rank = parseInt(chessNotation.charAt(1));
    return { row: 8 - rank, col: files.indexOf(file) };
  },

  drawArrow: function (from, to) {
    const svg = document.querySelector(".arrows");
    const fromCoord = chessCom.chessNotationToMatrix(from);
    const toCoord = chessCom.chessNotationToMatrix(to);
    const fromX = fromCoord.col * 12.5 + 6.25;
    const fromY = fromCoord.row * 12.5 + 6.25;
    const toX = toCoord.col * 12.5 + 6.25;
    const toY = toCoord.row * 12.5 + 6.25;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowHeadSize = 3;
    const lineWidth = 1;
    const lineLengthAdjustment = arrowHeadSize * 0.75;
    const adjustedToX = toX - lineLengthAdjustment * Math.cos(angle);
    const adjustedToY = toY - lineLengthAdjustment * Math.sin(angle);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromX);
    line.setAttribute("y1", fromY);
    line.setAttribute("x2", adjustedToX);
    line.setAttribute("y2", adjustedToY);
    line.setAttribute("stroke", "rgb(150,190,70)");
    line.setAttribute("stroke-width", lineWidth);
    line.setAttribute("opacity", "0.9");
    line.setAttribute("data-arrow", `${from}${to}`);
    svg?.appendChild(line);

    const arrowhead = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    arrowhead.setAttribute(
      "points",
      `0,0 -${arrowHeadSize},${arrowHeadSize / 2} -${arrowHeadSize},-${
        arrowHeadSize / 2
      }`
    );
    arrowhead.setAttribute("fill", "rgb(150,190,70)");
    arrowhead.setAttribute("opacity", "0.9");
    arrowhead.setAttribute(
      "transform",
      `translate(${toX},${toY}) rotate(${angle * (180 / Math.PI)})`
    );
    svg?.appendChild(arrowhead);
  },

  clearArrows: function () {
    const svg = document.querySelector(".arrows");
    const arrows = svg?.querySelectorAll("line, polygon");
    arrows?.forEach((arrow) => svg?.removeChild(arrow));
  },
};

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  switch (request.action) {
    case "startChessCom":
      console.log("[CHESS.COM]: Start command received");
      await chessCom.Start();
      break;
    case "stop":
      console.log("[CHESS.COM]: Stop command received");
      chessCom.Stop();
      break;
  }
});

// --------------------
// Popup
// --------------------
chessCom.showRateLimitPopup = function () {
  if (document.querySelector("#chess-limit-popup")) return;
  const overlay = document.createElement("div");
  overlay.id = "chess-limit-popup-overlay";
  overlay.style =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:9999;display:flex;justify-content:center;align-items:center;";
  const popup = document.createElement("div");
  popup.id = "chess-limit-popup";
  popup.style =
    "background:#2f3437;padding:20px;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.5);max-width:400px;width:90%;text-align:center;font-family:Arial,sans-serif;color:#fff;";
  popup.innerHTML = `
    <h2 style="margin-bottom:10px;color:#7fa650;">Daily Limit Reached</h2>
    <p style="margin-bottom:15px;color:#ccc;">
      You have reached your daily limit.<br>
      Only <strong>monthly supporters</strong> get unlimited suggestions.
    </p>
    <a href="https://ko-fi.com/nazmox" target="_blank"
      style="display:inline-block;padding:10px 20px;background:#13C3FF;color:#fff;border-radius:5px;text-decoration:none;font-weight:600;margin-bottom:10px;">Support on Ko-fi</a><br/>
    <button id="chess-limit-popup-close"
      style="padding:6px 12px;border:none;background:#7fa650;color:#fff;border-radius:5px;cursor:pointer;margin-top:10px;font-weight:600;">Close</button>
  `;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  document
    .getElementById("chess-limit-popup-close")
    .addEventListener("click", () => overlay.remove());
};
