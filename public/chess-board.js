// chess-board.js (content script)
console.log("ChessCom content script loaded");

const chessCom = {
  mycolor: "w",
  isActive: false,
  observer: null,
  moves: [],

  // ✅ One place to control arrow thickness for ALL arrows
  ARROW_WIDTH: 1.3,

  // --------------------
  // Main: request + draw
  // --------------------
  showMoves: async function (moves) {
    try {
      console.log("Asking for best move from the server...");
      chrome.runtime.sendMessage({ action: "getMove", moves }, (response) => {
        console.log("Response:", response);

        if (chrome.runtime.lastError) {
          console.error("Message failed:", chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success && Array.isArray(response.moves)) {
          chessCom.clearArrows();

          const coloredMoves = chessCom.colorizeMovesByEval(
            response.moves,
            response.fen
          );

          // ✅ always draw with same width (triangles match)
          coloredMoves.forEach((m) => {
            if (!m.from || !m.to) return;
            chessCom.drawArrow(m.from, m.to, m.color, chessCom.ARROW_WIDTH);
          });
        } else if (response && response.error?.includes("Daily limit")) {
          chessCom.showRateLimitPopup();
        }
      });
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

    chessCom.moves = chessCom.checkMoves().map((n) => n.moveText);

    chessCom.observer = new MutationObserver(async () => {
      const currentMoves = chessCom.checkMoves().map((n) => n.moveText);
      if (currentMoves.length > chessCom.moves.length) {
        const newMoves = currentMoves.slice(chessCom.moves.length);
        chessCom.moves.push(...newMoves);

        if (myTurn()) await chessCom.showMoves(chessCom.moves);
        else chessCom.clearArrows();
      }
    });

    chessCom.observer.observe(movesContainer, {
      childList: true,
      subtree: true,
    });

    if (myTurn()) await chessCom.showMoves(chessCom.moves);

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
      if (!resultEl) return;

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

  // --------------------
  // Eval -> color helpers
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
      return chessCom.rgb(
        chessCom.lerp(red[0], yellow[0], tt),
        chessCom.lerp(red[1], yellow[1], tt),
        chessCom.lerp(red[2], yellow[2], tt)
      );
    } else {
      const tt = (t - 0.5) / 0.5;
      return chessCom.rgb(
        chessCom.lerp(yellow[0], green[0], tt),
        chessCom.lerp(yellow[1], green[1], tt),
        chessCom.lerp(yellow[2], green[2], tt)
      );
    }
  },

  // ✅ Only sets COLOR now. Width is constant for all arrows.
  // ✅ Stable coloring based on LOSS from best move (centipawns)
  colorizeMovesByEval: function (moves, fen) {
    const side = chessCom.fenSideToMove(fen);

    // Extract numeric evals (assume eval is in pawns, e.g. 0.42)
    const evals = moves.map((m) => {
      const e = typeof m.eval === "number" ? m.eval : Number(m.eval);
      return Number.isFinite(e) ? e : null;
    });

    // If no evals at all, fallback to green-ish
    const numeric = evals.filter((x) => typeof x === "number");
    if (!numeric.length) {
      return moves.map((m) => ({ ...m, color: "rgb(150,190,70)" }));
    }

    // Best eval for the side to move
    const bestEval = side === "w" ? Math.max(...numeric) : Math.min(...numeric);

    // Convert loss from best into centipawns (always >= 0)
    // For white-to-move: loss = best - e
    // For black-to-move: loss = e - best (because more negative is "better" for black)
    const lossesCp = moves.map((m) => {
      const e = typeof m.eval === "number" ? m.eval : Number(m.eval);
      if (!Number.isFinite(e)) return null;

      const lossPawns = side === "w" ? bestEval - e : e - bestEval;
      return Math.max(0, Math.round(lossPawns * 100)); // centipawns
    });

    // Thresholds (tune these)
    const GREEN_CUTOFF = 15; // <= 0.15 pawn loss => basically equal
    const YELLOW_AT = 80; // around 0.80 pawn loss => yellow-ish
    const RED_AT = 250; // >= 2.5 pawn loss => red

    // Map loss cp -> t in [0..1] where 1 = green, 0 = red
    // We use a smooth curve so small losses stay green.
    function lossToT(lossCp) {
      if (lossCp <= GREEN_CUTOFF) return 1;

      // normalize between GREEN_CUTOFF..RED_AT
      const x = (lossCp - GREEN_CUTOFF) / (RED_AT - GREEN_CUTOFF);
      const clamped = chessCom.clamp01(x);

      // smoothstep curve: pushes "mostly green" range wider
      const smooth = clamped * clamped * (3 - 2 * clamped);

      // t: 1->0 as loss grows
      return 1 - smooth;
    }

    return moves.map((m, i) => {
      const lossCp = lossesCp[i];
      if (typeof lossCp !== "number") {
        return { ...m, color: chessCom.gradientRYG(0) };
      }

      // Optional: show "equal moves" as same green
      const t = lossToT(lossCp);

      // Optional: if you want more distinct mid colors, bias a bit:
      // const t = Math.pow(lossToT(lossCp), 0.9);

      return { ...m, color: chessCom.gradientRYG(t) };
    });
  },

  // --------------------
  // Drawing
  // --------------------
  chessNotationToMatrix: function (chessNotation) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const file = chessNotation.charAt(0);
    const rank = parseInt(chessNotation.charAt(1), 10);
    return { row: 8 - rank, col: files.indexOf(file) };
  },

  // ✅ Line + triangle head, triangle always matches constant width
  drawArrow: function (from, to, color = "rgb(150,190,70)", lineWidth = 2) {
    const svg = document.querySelector(".arrows");
    if (!svg) return;

    const fromCoord = chessCom.chessNotationToMatrix(from);
    const toCoord = chessCom.chessNotationToMatrix(to);

    const fromX = fromCoord.col * 12.5 + 6.25;
    const fromY = fromCoord.row * 12.5 + 6.25;
    const toX = toCoord.col * 12.5 + 6.25;
    const toY = toCoord.row * 12.5 + 6.25;

    const angle = Math.atan2(toY - fromY, toX - fromX);

    // ✅ fixed relation to width (NOT dependent on eval anymore)
    const headLen = 2.6 + lineWidth * 0.8;
    const headWid = headLen * 0.75;

    const endX = toX - Math.cos(angle) * headLen * 0.85;
    const endY = toY - Math.sin(angle) * headLen * 0.85;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(fromX));
    line.setAttribute("y1", String(fromY));
    line.setAttribute("x2", String(endX));
    line.setAttribute("y2", String(endY));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", String(lineWidth));
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "0.9");
    line.setAttribute("data-arrow", `${from}${to}`);
    svg.appendChild(line);

    const points = `0,0 ${-headLen},${headWid / 2} ${-headLen},${-headWid / 2}`;

    const head = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    head.setAttribute("points", points);
    head.setAttribute("fill", color);
    head.setAttribute("opacity", "0.9");
    head.setAttribute(
      "transform",
      `translate(${toX},${toY}) rotate(${(angle * 180) / Math.PI})`
    );
    head.setAttribute("data-arrow", `${from}${to}:head`);
    svg.appendChild(head);
  },

  clearArrows: function () {
    const svg = document.querySelector(".arrows");
    const arrows = svg?.querySelectorAll(
      "line[data-arrow], polygon[data-arrow], path[data-arrow]"
    );
    arrows?.forEach((arrow) => svg?.removeChild(arrow));
  },
};

chrome.runtime.onMessage.addListener(async (request) => {
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
