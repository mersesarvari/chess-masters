// == LICHESS CONTENT SCRIPT ==
console.log("Lichess content script loaded");

const lychessOrg = {
  mycolor: "w",
  isActive: false,
  observer: null,
  moves: [],

  showMoves: async function (moves) {
    try {
      console.log("Asking for best move from the server...");
      chrome.runtime.sendMessage({ action: "getMove", moves }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message failed:", chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success && response.from && response.to) {
          lychessOrg.drawArrow(response.from, response.to);
        } else if (response && response.error?.includes("Daily limit")) {
          lychessOrg.showRateLimitPopup();
        } else {
          console.warn("Invalid move response:", response);
        }
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  },

  Start: async function () {
    lychessOrg.getColor();

    if (lychessOrg.isActive) {
      console.log("Already active.");
      return;
    }

    lychessOrg.isActive = true;
    console.log("[ChessSolve]: Started");

    const myTurn = () =>
      (lychessOrg.mycolor === "w" && lychessOrg.moves.length % 2 === 0) ||
      (lychessOrg.mycolor === "b" && lychessOrg.moves.length % 2 === 1);

    // Select the real move container
    const movesContainer = document.querySelector("l4x");
    if (!movesContainer) {
      console.warn("Move list container not found!");
      return;
    }

    // Initial capture of moves
    lychessOrg.moves = lychessOrg.checkMoves();

    // Setup MutationObserver for live move tracking
    lychessOrg.observer = new MutationObserver(() => {
      const currentMoves = lychessOrg.checkMoves();
      if (currentMoves.length > lychessOrg.moves.length) {
        const newMoves = currentMoves.slice(lychessOrg.moves.length);
        lychessOrg.moves.push(...newMoves);
        lychessOrg.clearArrows();

        if (myTurn()) lychessOrg.showMoves(lychessOrg.moves);
      }
    });

    lychessOrg.observer.observe(movesContainer, {
      childList: true,
      subtree: true,
    });

    // Immediately show move if it's our turn
    if (myTurn()) await lychessOrg.showMoves(lychessOrg.moves);

    // Start monitoring game over
    lychessOrg.saveOnCheckMate();
  },

  Stop: function () {
    if (lychessOrg.observer) {
      lychessOrg.observer.disconnect();
      lychessOrg.observer = null;
    }

    lychessOrg.moves = [];
    lychessOrg.isActive = false;
    lychessOrg.clearArrows();
    console.log("[ChessSolve]: Stopped");
    chrome.runtime.sendMessage({ action: "stoppedAck" });
  },

  saveOnCheckMate: function () {
    if (!lychessOrg.isActive) return;

    const checkInterval = setInterval(() => {
      const pageText = document.body.innerText || document.body.textContent;
      const blackWon = pageText?.includes("Black is victorious");
      const whiteWon = pageText?.includes("White is victorious");
      const gameAborted = pageText?.includes("Game aborted");
      const draw = pageText?.includes("Draw");

      if (!(blackWon || whiteWon || gameAborted || draw)) return;

      lychessOrg.clearArrows();

      let winColor = "-";
      if (whiteWon) winColor = "w";
      else if (blackWon) winColor = "b";

      // Use live captured moves
      const finalMoves = [...lychessOrg.moves];

      chrome.storage.local.get(["email"], (result) => {
        const email = result.email;
        if (!email) return;

        const gameObject = {
          moves: finalMoves,
          winColor,
          myColor: lychessOrg.mycolor,
          source: "lichess.com",
          email,
        };

        console.log("Sending game to background for saving:", gameObject);

        chrome.runtime.sendMessage(
          { action: "saveGame", game: gameObject },
          (response) => {
            if (response?.success) console.log("Game saved successfully!");
            else console.error("Failed to save game");
          }
        );
      });

      clearInterval(checkInterval);
      lychessOrg.moves = [];
    }, 500);
  },

  checkMoves: function () {
    const moveNodes = document.querySelectorAll("l4x > kwdb");
    return Array.from(moveNodes).map((node) => node.textContent.trim());
  },

  getColor: function () {
    const board = document.querySelector(".cg-wrap");
    if (!board) return console.error("Chess board not found.");
    lychessOrg.mycolor = board.className.includes("orientation-white")
      ? "w"
      : "b";
    console.log(
      `You are playing ${
        lychessOrg.mycolor === "w" ? "white" : "black"
      } pieces.`
    );
  },

  chessNotationToMatrix: function (chessNotation) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const file = chessNotation.charAt(0);
    const rank = parseInt(chessNotation.charAt(1));
    return { row: 8 - rank, col: files.indexOf(file) };
  },

  drawArrow: function (from, to) {
    const svg = document.querySelector(".cg-shapes");
    const fromCoord = lychessOrg.chessNotationToMatrix(from);
    const toCoord = lychessOrg.chessNotationToMatrix(to);

    const mapToSvg = (value) => -4 + (value / 7) * 8;
    const adjust = (v) => (lychessOrg.mycolor === "b" ? 7 - v : v);

    const fromX = mapToSvg(adjust(fromCoord.col));
    const fromY = mapToSvg(adjust(fromCoord.row));
    const toX = mapToSvg(adjust(toCoord.col));
    const toY = mapToSvg(adjust(toCoord.row));

    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowHeadSize = 0.3;
    const lineWidth = 0.1;
    const lineLengthAdjustment = arrowHeadSize * 0.75;

    const adjustedToX = toX - lineLengthAdjustment * Math.cos(angle);
    const adjustedToY = toY - lineLengthAdjustment * Math.sin(angle);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromX);
    line.setAttribute("y1", fromY);
    line.setAttribute("x2", adjustedToX);
    line.setAttribute("y2", adjustedToY);
    line.setAttribute("stroke", "rgb(16,31,163)");
    line.setAttribute("stroke-width", lineWidth);
    line.setAttribute("opacity", "1");
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
    arrowhead.setAttribute("fill", "rgb(16,31,163)");
    arrowhead.setAttribute("opacity", "1");
    arrowhead.setAttribute(
      "transform",
      `translate(${toX},${toY}) rotate(${angle * (180 / Math.PI)})`
    );
    svg?.appendChild(arrowhead);
  },

  clearArrows: function () {
    const svg = document.querySelector(".cg-shapes");
    const arrows = svg?.querySelectorAll("line, polygon");
    arrows?.forEach((a) => svg?.removeChild(a));
  },

  showRateLimitPopup: function () {
    if (document.querySelector("#chess-limit-popup")) return;

    const overlay = document.createElement("div");
    overlay.id = "chess-limit-popup-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.5)",
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    });

    const popup = document.createElement("div");
    popup.id = "chess-limit-popup";
    Object.assign(popup.style, {
      background: "#2f3437",
      padding: "20px",
      borderRadius: "10px",
      boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
      maxWidth: "400px",
      width: "90%",
      textAlign: "center",
      fontFamily: "Arial,sans-serif",
      color: "#fff",
    });

    popup.innerHTML = `
      <h2 style="margin-bottom:10px; color:#7fa650;">Daily Limit Reached</h2>
      <p style="margin-bottom:15px; color:#ccc;">
        You have reached your daily limit.<br>
        Only <strong>monthly supporters</strong> get unlimited suggestions.
      </p>
      <a href="https://ko-fi.com/nazmox" target="_blank" style="
        display:inline-block; padding:10px 20px; background:#13C3FF; color:#fff;
        border-radius:5px; text-decoration:none; font-weight:600; margin-bottom:10px;">Support on Ko-fi</a><br/>
      <button id="chess-limit-popup-close" style="
        padding:6px 12px; border:none; background:#7fa650; color:#fff; border-radius:5px;
        cursor:pointer; margin-top:10px; font-weight:600;">Close</button>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document
      .getElementById("chess-limit-popup-close")
      .addEventListener("click", () => overlay.remove());
  },
};

// --------------------
// Chrome listeners
// --------------------
chrome.runtime.onMessage.addListener(async (request) => {
  if (request.action === "startLichessOrg") await lychessOrg.Start();
  if (request.action === "stop") lychessOrg.Stop();
});
