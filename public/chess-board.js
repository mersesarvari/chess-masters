// chess-board.js — chess.com content script (config only)
console.log("ChessCom content script loaded");

const chessCom = createChessBot({
  startAction: "startChessCom",
  source: "chess.com",
  arrowWidth: 1.3,
  arrowOpacity: "0.9",
  svgSelector: ".arrows",

  getColor(bot) {
    const board =
      document.querySelector("#board-play-computer") ||
      document.querySelector("#board-single");
    if (!board) return console.error("Chess board not found.");
    bot.mycolor = board.className.includes("flipped") ? "b" : "w";
    console.log(
      "You are with the",
      bot.mycolor === "w" ? "white" : "black",
      "pieces."
    );
  },

  checkMoves() {
    try {
      const nodes = document.querySelectorAll(".node");
      const result = [];
      nodes.forEach((move) => {
        let moveText = "";
        const pieceIcon = move?.querySelector("span[data-figurine]");
        if (!pieceIcon) {
          moveText = move?.querySelector("span")?.textContent?.trim();
        } else {
          const iconValue = pieceIcon.getAttribute("data-figurine");
          moveText = `${iconValue}${move
            .querySelector("span")
            ?.textContent?.trim()}`;
        }
        if (moveText) result.push(moveText);
      });
      return result;
    } catch (err) {
      console.error("checkMoves failed:", err);
      return [];
    }
  },

  async findMovesContainer() {
    const waitForMoveList = async () => {
      for (let i = 0; i < 20; i++) {
        const el = document.querySelector("wc-simple-move-list");
        if (el) return el;
        await new Promise((res) => setTimeout(res, 500));
      }
      return null;
    };

    const moveListElement = await waitForMoveList();
    if (!moveListElement) return null;

    const shadowRoot = moveListElement.shadowRoot || moveListElement;
    return shadowRoot.querySelector("div") || null;
  },

  detectGameResult() {
    const resultEl = document.querySelector(
      ".main-line-row.move-list-row.result-row .game-result"
    );
    if (!resultEl) return null;

    const resultText = resultEl.textContent.trim();
    let winColor = "-";
    if (resultText === "1-0") winColor = "w";
    else if (resultText === "0-1") winColor = "b";
    else if (resultText === "\u00BD\u2013\u00BD") winColor = "draw";

    return { finished: true, winColor };
  },

  squareToXY(square) {
    const { row, col } = chessCom.chessNotationToMatrix(square);
    return { x: col * 12.5 + 6.25, y: row * 12.5 + 6.25 };
  },

  headSize(lineWidth) {
    const headLen = 2.6 + lineWidth * 0.8;
    return { headLen, headWid: headLen * 0.75 };
  },
});
