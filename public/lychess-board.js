// lychess-board.js — lichess.org content script (config only)
console.log("Lichess content script loaded");

const lichessBot = createChessBot({
  startAction: "startLichessOrg",
  source: "lichess.com",
  arrowWidth: 0.12,
  arrowOpacity: "1",
  svgSelector: ".cg-shapes",

  getColor(bot) {
    const board = document.querySelector(".cg-wrap");
    if (!board) return console.error("Chess board not found.");
    bot.mycolor = board.className.includes("orientation-white") ? "w" : "b";
    console.log(
      `You are playing ${bot.mycolor === "w" ? "white" : "black"} pieces.`
    );
  },

  checkMoves() {
    const moveNodes = document.querySelectorAll("l4x > kwdb");
    return Array.from(moveNodes).map((node) => node.textContent.trim());
  },

  async findMovesContainer() {
    return document.querySelector("l4x") || null;
  },

  detectGameResult() {
    const pageText = document.body.innerText || document.body.textContent;
    const blackWon = pageText?.includes("Black is victorious");
    const whiteWon = pageText?.includes("White is victorious");
    const gameAborted = pageText?.includes("Game aborted");
    const draw = pageText?.includes("Draw");

    if (!(blackWon || whiteWon || gameAborted || draw)) return null;

    let winColor = "-";
    if (whiteWon) winColor = "w";
    else if (blackWon) winColor = "b";

    return { finished: true, winColor };
  },

  squareToXY(square) {
    const { row, col } = lichessBot.chessNotationToMatrix(square);
    const mapToSvg = (value) => -4 + (value / 7) * 8;
    const adjust = (v) => (lichessBot.mycolor === "b" ? 7 - v : v);
    return { x: mapToSvg(adjust(col)), y: mapToSvg(adjust(row)) };
  },

  headSize(lineWidth) {
    const headLen = 0.35 + lineWidth * 1.8;
    return { headLen, headWid: headLen * 0.75 };
  },
});
