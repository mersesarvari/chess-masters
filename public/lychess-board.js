// == LICHESS CONTENT SCRIPT ==
console.log("Lichess content script loaded");

const lychessOrg = {
  mycolor: "w",
  isActive: false,
  observer: null,
  moves: [],

  // ✅ Same idea as chess.com: constant width everywhere
  ARROW_WIDTH: 0.12, // tune: 0.10–0.18 usually looks good

  // --------------------
  // Main: request + draw
  // --------------------
  showMoves: async function (moves) {
    try {
      console.log("Asking for best move from the server...");
      chrome.runtime.sendMessage({ action: "getMove", moves }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message failed:", chrome.runtime.lastError.message);
          return;
        }

        // ✅ UPDATED: support multi-move response like chess.com
        if (response && response.success && Array.isArray(response.moves)) {
          lychessOrg.clearArrows();

          const coloredMoves = lychessOrg.colorizeMovesByEval(
            response.moves,
            response.fen
          );

          coloredMoves.forEach((m) => {
            if (!m.from || !m.to) return;
            lychessOrg.drawArrow(m.from, m.to, m.color, lychessOrg.ARROW_WIDTH);
          });

          return;
        }

        // Backwards-compat: old API that returns {from,to}
        if (response && response.success && response.from && response.to) {
          lychessOrg.clearArrows();
          lychessOrg.drawArrow(
            response.from,
            response.to,
            "rgb(150,190,70)",
            lychessOrg.ARROW_WIDTH
          );
          return;
        }

        if (response && response.error?.includes("Daily limit")) {
          lychessOrg.showRateLimitPopup();
          return;
        }

        console.warn("Invalid move response:", response);
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

        if (myTurn()) lychessOrg.showMoves(lychessOrg.moves);
        else lychessOrg.clearArrows();
      }
    });

    lychessOrg.observer.observe(movesContainer, {
      childList: true,
      subtree: true,
    });

    if (myTurn()) await lychessOrg.showMoves(lychessOrg.moves);

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

  // --------------------
  // Eval -> color helpers (same logic as chess.com)
  // --------------------
  fenSideToMove: function (fen) {
    const parts = String(fen || "").split(" ");
    return parts[1] === "b" ? "b" : "w";
  },

  clamp01: function (x) {
    return Math.max(0, Math.min(1, x));
  },

  lerp: function (a, b, t) {
    return a + (b - a) * t;
  },

  rgb: function (r, g, b) {
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  },

  gradientRYG: function (t) {
    const red = [220, 60, 60];
    const yellow = [240, 200, 70];
    const green = [60, 200, 90];

    if (t <= 0.5) {
      const tt = t / 0.5;
      return lychessOrg.rgb(
        lychessOrg.lerp(red[0], yellow[0], tt),
        lychessOrg.lerp(red[1], yellow[1], tt),
        lychessOrg.lerp(red[2], yellow[2], tt)
      );
    } else {
      const tt = (t - 0.5) / 0.5;
      return lychessOrg.rgb(
        lychessOrg.lerp(yellow[0], green[0], tt),
        lychessOrg.lerp(yellow[1], green[1], tt),
        lychessOrg.lerp(yellow[2], green[2], tt)
      );
    }
  },

  colorizeMovesByEval: function (moves, fen) {
    const side = lychessOrg.fenSideToMove(fen);

    const numeric = moves
      .map((m) => (typeof m.eval === "number" ? m.eval : Number(m.eval)))
      .filter((e) => typeof e === "number" && !Number.isNaN(e));

    if (!numeric.length) {
      return moves.map((m) => ({ ...m, color: "rgb(150,190,70)" }));
    }

    const best = side === "w" ? Math.max(...numeric) : Math.min(...numeric);
    const worst = side === "w" ? Math.min(...numeric) : Math.max(...numeric);
    const span = Math.max(0.001, Math.abs(best - worst));

    return moves.map((m) => {
      const e = typeof m.eval === "number" ? m.eval : Number(m.eval);

      if (!Number.isFinite(e)) {
        return { ...m, color: lychessOrg.gradientRYG(0) };
      }

      const tRaw = side === "w" ? (e - worst) / span : (worst - e) / span;
      const t = lychessOrg.clamp01(tRaw);

      return { ...m, color: lychessOrg.gradientRYG(t) };
    });
  },

  // --------------------
  // Drawing (line + triangle head, like chess.com)
  // --------------------
  chessNotationToMatrix: function (chessNotation) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const file = chessNotation.charAt(0);
    const rank = parseInt(chessNotation.charAt(1), 10);
    return { row: 8 - rank, col: files.indexOf(file) };
  },

  // Convert board coords to lichess SVG coords (-4..4). Lichess flips by orientation.
  boardToSvgXY: function (square) {
    const { row, col } = lychessOrg.chessNotationToMatrix(square);

    const mapToSvg = (value) => -4 + (value / 7) * 8; // 0..7 -> -4..4
    const adjust = (v) => (lychessOrg.mycolor === "b" ? 7 - v : v);

    const x = mapToSvg(adjust(col));
    const y = mapToSvg(adjust(row));
    return { x, y };
  },

  drawArrow: function (from, to, color = "rgb(150,190,70)", lineWidth = 0.12) {
    const svg = document.querySelector(".cg-shapes");
    if (!svg) return;

    const a = lychessOrg.boardToSvgXY(from);
    const b = lychessOrg.boardToSvgXY(to);

    const fromX = a.x;
    const fromY = a.y;
    const toX = b.x;
    const toY = b.y;

    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Triangle sizing: tied only to lineWidth so everything matches
    // NOTE: lichess SVG units are small. Keep head tiny.
    const headLen = 0.35 + lineWidth * 1.8;
    const headWid = headLen * 0.75;

    // Shorten line so it doesn't go under triangle
    const endX = toX - Math.cos(angle) * headLen * 0.85;
    const endY = toY - Math.sin(angle) * headLen * 0.85;

    // LINE
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(fromX));
    line.setAttribute("y1", String(fromY));
    line.setAttribute("x2", String(endX));
    line.setAttribute("y2", String(endY));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", String(lineWidth));
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "1");
    line.setAttribute("data-arrow", `${from}${to}`);
    svg.appendChild(line);

    // TRIANGLE HEAD
    const points = `0,0 ${-headLen},${headWid / 2} ${-headLen},${-headWid / 2}`;

    const head = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    head.setAttribute("points", points);
    head.setAttribute("fill", color);
    head.setAttribute("opacity", "1");
    head.setAttribute(
      "transform",
      `translate(${toX},${toY}) rotate(${(angle * 180) / Math.PI})`
    );
    head.setAttribute("data-arrow", `${from}${to}:head`);
    svg.appendChild(head);
  },

  clearArrows: function () {
    const svg = document.querySelector(".cg-shapes");
    const arrows = svg?.querySelectorAll(
      "line[data-arrow], polygon[data-arrow], path[data-arrow], line, polygon"
    );

    // Keep it safe: remove our own first (data-arrow). If none, it still clears.
    arrows?.forEach((a) => {
      // If it's not inside svg anymore, skip
      try {
        svg.removeChild(a);
      } catch {}
    });
  },

  // --------------------
  // Popup
  // --------------------
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
