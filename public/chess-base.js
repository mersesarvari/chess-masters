// chess-base.js — shared factory for chess bot content scripts
//
// Usage:
//   const bot = createChessBot({ startAction, source, arrowWidth, ... });
//
// Config shape:
//   startAction       "startChessCom" | "startLichessOrg"
//   source            "chess.com" | "lichess.com"
//   arrowWidth        default line width (1.3 for chess.com, 0.12 for lichess)
//   arrowOpacity      "0.9" | "1"
//   svgSelector       CSS selector for the SVG arrows container
//   getColor(bot)     detect player color from DOM, set bot.mycolor
//   checkMoves()      parse move list from DOM, return string[]
//   findMovesContainer()  return the DOM node to observe for new moves
//   detectGameResult()    return { finished, winColor } or null
//   squareToXY(square)    convert "e4" -> { x, y } in site's SVG coords
//   headSize(lineWidth)   return { headLen, headWid } for arrow triangles

function createChessBot(config) {
  const bot = {
    mycolor: "w",
    isActive: false,
    observer: null,
    moves: [],

    // ----------------------------
    // Main: request + draw
    // ----------------------------
    showMoves: async function (moves) {
      try {
        console.log("Asking for best move from the server...");
        chrome.runtime.sendMessage({ action: "getMove", moves }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message failed:", chrome.runtime.lastError.message);
            return;
          }

          if (response && response.success && Array.isArray(response.moves)) {
            bot.clearArrows();

            const coloredMoves = bot.colorizeMovesByEval(
              response.moves,
              response.fen
            );

            coloredMoves.forEach((m) => {
              if (!m.from || !m.to) return;
              bot.drawArrow(m.from, m.to, m.color, config.arrowWidth);
            });
          } else if (response && response.error?.includes("Daily limit")) {
            bot.showRateLimitPopup();
          }
        });
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    },

    // ----------------------------
    // Lifecycle
    // ----------------------------
    Start: async function () {
      config.getColor(bot);

      if (bot.isActive) {
        console.log("Already active.");
        return;
      }

      bot.isActive = true;
      console.log("[ChessSolve]: Started");

      const myTurn = () =>
        (bot.mycolor === "w" && bot.moves.length % 2 === 0) ||
        (bot.mycolor === "b" && bot.moves.length % 2 === 1);

      const movesContainer = await config.findMovesContainer();
      if (!movesContainer) {
        console.warn("Move list container not found!");
        return;
      }

      bot.moves = config.checkMoves();

      bot.observer = new MutationObserver(async () => {
        const currentMoves = config.checkMoves();
        if (currentMoves.length > bot.moves.length) {
          const newMoves = currentMoves.slice(bot.moves.length);
          bot.moves.push(...newMoves);

          if (myTurn()) await bot.showMoves(bot.moves);
          else bot.clearArrows();
        }
      });

      bot.observer.observe(movesContainer, {
        childList: true,
        subtree: true,
      });

      if (myTurn()) await bot.showMoves(bot.moves);

      bot.saveOnCheckMate();
    },

    Stop: function () {
      if (bot.observer) {
        bot.observer.disconnect();
        bot.observer = null;
      }
      bot.moves = [];
      bot.isActive = false;
      bot.clearArrows();
      console.log("[ChessSolve]: Stopped");
      chrome.runtime.sendMessage({ action: "stoppedAck" });
    },

    saveOnCheckMate: function () {
      if (!bot.isActive) return;

      const interval = setInterval(() => {
        const result = config.detectGameResult();
        if (!result || !result.finished) return;

        bot.clearArrows();

        const finalMoves = [...bot.moves];

        chrome.storage.local.get(["email"], (stored) => {
          const email = stored.email;
          if (!email) return;

          const gameObject = {
            moves: finalMoves,
            winColor: result.winColor,
            myColor: bot.mycolor,
            email,
            source: config.source,
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
        bot.moves = [];
      }, 500);
    },

    // ----------------------------
    // Eval -> color helpers
    // ----------------------------
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
        return bot.rgb(
          bot.lerp(red[0], yellow[0], tt),
          bot.lerp(red[1], yellow[1], tt),
          bot.lerp(red[2], yellow[2], tt)
        );
      } else {
        const tt = (t - 0.5) / 0.5;
        return bot.rgb(
          bot.lerp(yellow[0], green[0], tt),
          bot.lerp(yellow[1], green[1], tt),
          bot.lerp(yellow[2], green[2], tt)
        );
      }
    },

    colorizeMovesByEval: function (moves, fen) {
      const side = bot.fenSideToMove(fen);

      const evals = moves.map((m) => {
        const e = typeof m.eval === "number" ? m.eval : Number(m.eval);
        return Number.isFinite(e) ? e : null;
      });

      const numeric = evals.filter((x) => typeof x === "number");
      if (!numeric.length) {
        return moves.map((m) => ({ ...m, color: "rgb(150,190,70)" }));
      }

      const bestEval =
        side === "w" ? Math.max(...numeric) : Math.min(...numeric);
      const worstEval =
        side === "w" ? Math.min(...numeric) : Math.max(...numeric);

      const lossesCp = moves.map((m) => {
        const e = typeof m.eval === "number" ? m.eval : Number(m.eval);
        if (!Number.isFinite(e)) return null;

        const lossPawns = side === "w" ? bestEval - e : e - bestEval;
        return Math.max(0, Math.round(lossPawns * 100));
      });

      // Tuning knobs
      const GREEN_CUTOFF = 15;
      const MIN_SPREAD_CP = 70;
      const MAX_SPREAD_CP = 300;
      const GAMMA = 1.8;

      let spreadCp = Math.round(Math.abs(bestEval - worstEval) * 100);
      spreadCp = Math.max(MIN_SPREAD_CP, Math.min(MAX_SPREAD_CP, spreadCp));

      function lossToT(lossCp) {
        if (lossCp <= GREEN_CUTOFF) return 1;
        const x = (lossCp - GREEN_CUTOFF) / (spreadCp - GREEN_CUTOFF);
        const clamped = bot.clamp01(x);
        return 1 - Math.pow(clamped, GAMMA);
      }

      return moves.map((m, i) => {
        const lossCp = lossesCp[i];
        if (typeof lossCp !== "number") {
          return { ...m, color: bot.gradientRYG(0) };
        }
        const t = lossToT(lossCp);
        return { ...m, color: bot.gradientRYG(t) };
      });
    },

    // ----------------------------
    // Drawing
    // ----------------------------
    chessNotationToMatrix: function (chessNotation) {
      const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const file = chessNotation.charAt(0);
      const rank = parseInt(chessNotation.charAt(1), 10);
      return { row: 8 - rank, col: files.indexOf(file) };
    },

    drawArrow: function (from, to, color = "rgb(150,190,70)", lineWidth = 2) {
      const svg = document.querySelector(config.svgSelector);
      if (!svg) return;

      const fromPt = config.squareToXY(from);
      const toPt = config.squareToXY(to);

      const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);

      const { headLen, headWid } = config.headSize(lineWidth);

      const endX = toPt.x - Math.cos(angle) * headLen * 0.85;
      const endY = toPt.y - Math.sin(angle) * headLen * 0.85;

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", String(fromPt.x));
      line.setAttribute("y1", String(fromPt.y));
      line.setAttribute("x2", String(endX));
      line.setAttribute("y2", String(endY));
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", String(lineWidth));
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("opacity", config.arrowOpacity);
      line.setAttribute("data-arrow", `${from}${to}`);
      svg.appendChild(line);

      const points = `0,0 ${-headLen},${headWid / 2} ${-headLen},${
        -headWid / 2
      }`;

      const head = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon"
      );
      head.setAttribute("points", points);
      head.setAttribute("fill", color);
      head.setAttribute("opacity", config.arrowOpacity);
      head.setAttribute(
        "transform",
        `translate(${toPt.x},${toPt.y}) rotate(${(angle * 180) / Math.PI})`
      );
      head.setAttribute("data-arrow", `${from}${to}:head`);
      svg.appendChild(head);
    },

    clearArrows: function () {
      const svg = document.querySelector(config.svgSelector);
      const arrows = svg?.querySelectorAll(
        "line[data-arrow], polygon[data-arrow], path[data-arrow]"
      );
      arrows?.forEach((a) => {
        try {
          svg.removeChild(a);
        } catch {}
      });
    },

    // ----------------------------
    // Rate-limit popup
    // ----------------------------
    showRateLimitPopup: function () {
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
    },
  };

  // ----------------------------
  // Chrome message listener
  // ----------------------------
  chrome.runtime.onMessage.addListener(async (request) => {
    if (request.action === config.startAction) {
      console.log(`[${config.source}]: Start command received`);
      await bot.Start();
    } else if (request.action === "stop") {
      console.log(`[${config.source}]: Stop command received`);
      bot.Stop();
    }
  });

  return bot;
}
