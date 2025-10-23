// == LICHESS CONTENT SCRIPT ==
console.log("Lichess content script loaded");

const lychessOrg = {
  mycolor: "w",
  isActive: false,
  intervalId: null,
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

    function boardHasChanged() {
      const currentMoves = lychessOrg.checkMoves();
      if (lychessOrg.moves.length < currentMoves.length) {
        lychessOrg.clearArrows();
        lychessOrg.moves = currentMoves;
        return true;
      } else {
        return false;
      }
    }

    const myTurn = (moves) => {
      if (lychessOrg.mycolor === "w" && moves.length % 2 === 0) return true;
      if (lychessOrg.mycolor === "b" && moves.length % 2 === 1) return true;
      return false;
    };

    if (lychessOrg.isActive) {
      console.log("Already active.");
      return;
    }

    lychessOrg.isActive = true;
    console.log("[ChessSolve]: Started");

    if (myTurn(lychessOrg.moves)) {
      console.log("Show moves because this is my turn!");
      await lychessOrg.showMoves(lychessOrg.moves);
    }

    lychessOrg.intervalId = setInterval(async function () {
      if (boardHasChanged() && myTurn(lychessOrg.moves)) {
        await lychessOrg.showMoves(lychessOrg.moves);
      }
    }, 100);

    // ✅ start monitoring game over
    lychessOrg.saveOnCheckMate();
  },

  Stop: function () {
    if (lychessOrg.intervalId) {
      clearInterval(lychessOrg.intervalId);
      lychessOrg.intervalId = null;
    }

    lychessOrg.moves = [];
    lychessOrg.isActive = false;
    lychessOrg.clearArrows();
    console.log("[ChessSolve]: Stopped");
    chrome.runtime.sendMessage({ action: "stoppedAck" });
  },

  saveOnCheckMate: function () {
    console.log("saveOnCheckMate called");

    if (!lychessOrg.isActive) {
      console.log("Lichess not active");
      lychessOrg.moves = [];
      return;
    }

    const checkInterval = setInterval(() => {
      const pageText = document.body.innerText || document.body.textContent;

      const blackWon = pageText?.includes("Black is victorious");
      const whiteWon = pageText?.includes("White is victorious");
      const gameAborted = pageText?.includes("Game aborted");
      const draw = pageText?.includes("Draw");

      const isGameOver = blackWon || whiteWon || gameAborted || draw;

      if (!isGameOver) return;

      // ✅ Clear arrows
      lychessOrg.clearArrows();

      // Determine winner
      let winColor = "-"; // default draw/aborted
      if (whiteWon) winColor = "w";
      else if (blackWon) winColor = "b";

      // Fetch email and send to background
      chrome.storage.local.get(["email"], (result) => {
        const email = result.email;
        if (!email) return;

        const gameObject = {
          moves: lychessOrg.moves,
          winColor,
          myColor: lychessOrg.mycolor,
          sourcee: "lichess.com",
          email,
        };

        console.log("Sending game to background for saving:", gameObject);

        chrome.runtime.sendMessage(
          { action: "saveGame", game: gameObject },
          (response) => {
            if (response?.success) {
              console.log("Background confirmed game saved!");
            } else {
              console.error("Background failed to save game");
            }
          }
        );
      });

      // ✅ Stop checking immediately after sending
      clearInterval(checkInterval);
      lychessOrg.moves = [];
    }, 500); // check twice a second
  },

  checkMoves: function () {
    const moveNodes = document.querySelectorAll("i5z");
    const moves = [];

    moveNodes.forEach((moveNode) => {
      const whiteMove = moveNode?.nextElementSibling?.textContent?.trim();
      const blackMove =
        moveNode?.nextElementSibling?.nextElementSibling?.textContent?.trim();

      if (whiteMove) moves.push(whiteMove);
      if (blackMove) moves.push(blackMove);
    });

    return moves;
  },

  getColor: function () {
    const board = document.querySelector(".cg-wrap");
    if (!board) {
      console.error("Chess board not found.");
      return;
    }
    if (board.className.includes("orientation-white")) {
      lychessOrg.mycolor = "w";
      console.log("You are with the white pieces.");
    } else {
      lychessOrg.mycolor = "b";
      console.log("You are with the black pieces.");
    }
  },

  chessNotationToMatrix: function (chessNotation) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const file = chessNotation.charAt(0);
    const rank = parseInt(chessNotation.charAt(1));
    const col = files.indexOf(file);
    const row = 8 - rank;
    return { row, col };
  },

  drawArrow: function (from, to) {
    const svg = document.querySelector(".cg-shapes");
    const fromCoord = lychessOrg.chessNotationToMatrix(from);
    const toCoord = lychessOrg.chessNotationToMatrix(to);

    const mapToSvg = (value) => -4 + (value / 7) * 8;
    const isFlipped = lychessOrg.mycolor === "b";
    const adjust = (v) => (isFlipped ? 7 - v : v);

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
    line.setAttribute("stroke", "rgb(16, 31, 163)");
    line.setAttribute("stroke-width", lineWidth);
    line.setAttribute("opacity", "1");
    line.setAttribute("data-arrow", `${from}${to}`);
    line.setAttribute("id", `line-${from}${to}`);
    svg?.appendChild(line);

    const arrowhead = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    const arrowheadPoints = `
      0,0 
      -${arrowHeadSize},${arrowHeadSize / 2} 
      -${arrowHeadSize},-${arrowHeadSize / 2}
    `;
    arrowhead.setAttribute("points", arrowheadPoints);
    arrowhead.setAttribute("fill", "rgb(16, 31, 163)");
    arrowhead.setAttribute("opacity", "1");
    arrowhead.setAttribute("data-arrowhead", `${from}${to}`);
    arrowhead.setAttribute("id", `arrowhead-${from}${to}`);
    arrowhead.setAttribute(
      "transform",
      `translate(${toX}, ${toY}) rotate(${angle * (180 / Math.PI)})`
    );
    svg?.appendChild(arrowhead);
  },

  clearArrows: function () {
    const svg = document.querySelector(".cg-shapes");
    const arrows = svg?.querySelectorAll("line, polygon");
    arrows?.forEach((arrow) => svg?.removeChild(arrow));
  },
};

// --------------------
// Popup function
// --------------------
lychessOrg.showRateLimitPopup = function () {
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
    fontFamily: "Arial, sans-serif",
    color: "#fff",
  });

  popup.innerHTML = `
    <h2 style="margin-bottom:10px; color:#7fa650;">Daily Limit Reached</h2>
    <p style="margin-bottom:15px; color:#ccc;">
      You have reached your daily limit.<br>
      Only <strong>monthly supporters</strong> get unlimited suggestions.
    </p>
    <a href="https://ko-fi.com/nazmox" target="_blank" style="
      display:inline-block;
      padding:10px 20px;
      background:#13C3FF;
      color:#fff;
      border-radius:5px;
      text-decoration:none;
      font-weight:600;
      margin-bottom:10px;
    ">Support on Ko-fi</a><br/>
    <button id="chess-limit-popup-close" style="
      padding:6px 12px;
      border:none;
      background:#7fa650;
      color:#fff;
      border-radius:5px;
      cursor:pointer;
      margin-top:10px;
      font-weight:600;
    ">Close</button>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  document
    .getElementById("chess-limit-popup-close")
    .addEventListener("click", () => document.body.removeChild(overlay));
};

// --------------------
// Chrome listeners
// --------------------
chrome.runtime.onMessage.addListener(async (request) => {
  switch (request.action) {
    case "startLichessOrg":
      console.log("[LYCHESS]: Start command received");
      await lychessOrg.Start();
      break;
    case "stop":
      console.log("[LYCHESS]: Stop command received");
      lychessOrg.Stop();
      break;
  }
});
