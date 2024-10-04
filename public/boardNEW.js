let mycolor = "w";
let isActive = false;
let intervalId = null;
let moves = [];

async function Start() {
  getColor();
  function boardHasChanged() {
    const moveNodes = checkMoves();
    const currentMoves = moveNodes.map((node) => node.moveText);
    if (moves.length < currentMoves.length) {
      clearArrows();
      moves = currentMoves;
      return true;
    } else {
      return false;
    }
  }

  function myTurn(moves) {
    if (mycolor === "w" && moves.length % 2 === 0) {
      return true;
    }
    return false;
  }
  async function showMoves(moves) {
    // Fetch POST request to the specified endpoint
    async function fetchFen() {
      try {
        const response = await fetch(
          "https://chess-master-webpage.vercel.app/api/chess",
          {
            // Replace with your actual endpoint
            method: "POST",
            headers: {
              "Content-Type": "application/json", // Specify content type as JSON
            },
            body: JSON.stringify({ moves }), // Send moves as JSON body
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Fetch error:", error); // Handle any errors that occur during fetch
      }
    }

    const { fen } = await fetchFen();
    console.log("[API-Response-FEN]:", fen);
    //Sending FEN to bot.js
    /* chrome.runtime.sendMessage(
      {
        action: "sendFEN",
        fen: fen,
      },
      (response) => {
        console.log(response.status);
      }
    ); */
    async function postChessApi(fen) {
      try {
        const response = await fetch("https://chess-api.com/v1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fen }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        console.error("Error sending FEN:", error);
        return null; // Return null or handle the error as needed
      }
    }
    const apiData = await postChessApi(fen);
    console.log("API DATA: ", apiData);
    //Draw move
    drawArrow(apiData.from, apiData.to);
  }
  if (isActive) {
    console.log("Already active.");
    return;
  }
  isActive = true;

  //Showing move if no move happened and it is my turn (Im white)
  if (myTurn(moves) === true) {
    await showMoves(moves);
  }
  //Showing moves if a move happened and it is my turn!
  intervalId = setInterval(async function () {
    if (boardHasChanged() === true && myTurn(moves) === true) {
      await showMoves(moves);
    }
  }, 100);
  console.log("FEN change check started.");
}

function stopFENChangeCheck() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("FEN change check stopped.");
  }

  isActive = false;
  clearArrows();
}

function stopOnCheckmate() {
  const checkInterval = setInterval(() => {
    const checkmateElement = document.querySelector(
      "#game-over-modal > div > div:nth-child(2) > section > div.modal-game-over-bg"
    );

    if (isActive && checkmateElement) {
      console.log("Stopped on checkmate");
      isActive = false;
      clearArrows();
      stopFENChangeCheck();
      clearInterval(checkInterval);
    }
  }, 100);
}
function checkMoves() {
  // Select all div elements with class 'node'
  const moves = document.querySelectorAll(".node");

  // Create an array to store the extracted moves
  const extractedMoves = [];

  // Loop through the selected div elements
  moves.forEach((move) => {
    // Extract the data-node attribute and the move text inside the span
    const dataNode = move.getAttribute("data-node");
    const moveText = move.querySelector("span")?.textContent.trim();

    // If move text is available, store the result
    if (moveText) {
      extractedMoves.push({ dataNode, moveText });
    }
  });
  return extractedMoves;
}

function getColor() {
  const board =
    document.querySelector("#board-play-computer") ||
    document.querySelector("#board-single");
  if (!board) {
    console.error("Chess board not found.");
    return;
  }
  if (board.className.includes("flipped")) {
    mycolor = "b";
    console.log("You are with the black pieces.");
  } else {
    mycolor = "w";
    console.log("You are with the white pieces.");
  }
}

function chessNotationToMatrix(chessNotation) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  // Extract the file and rank from the chess notation
  const file = chessNotation.charAt(0); // First character (file)
  const rank = parseInt(chessNotation.charAt(1)); // Second character (rank)

  // Calculate the column index (0-7)
  const col = files.indexOf(file);

  // Calculate the row index (0-7) based on the rank
  const row = 8 - rank; // Convert rank to 0-based index (8 -> 0, 1 -> 7, etc.)

  return { row, col }; // Return as an object
}

function drawArrow(from, to) {
  const svg = document.querySelector(".arrows"); // Get the SVG container

  // Convert chess squares to matrix coordinates
  const fromCoord = chessNotationToMatrix(from);
  const toCoord = chessNotationToMatrix(to);

  // Define SVG coordinates based on the matrix coordinates
  const fromX = fromCoord.col * 12.5 + 6.25; // Center of the square in x
  const fromY = fromCoord.row * 12.5 + 6.25; // Center of the square in y
  const toX = toCoord.col * 12.5 + 6.25; // Center of the square in x
  const toY = toCoord.row * 12.5 + 6.25; // Center of the square in y

  // Calculate angle for the arrow
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Define the arrowhead size and line width
  const arrowHeadSize = 3; // Smaller size of the arrowhead
  const lineWidth = 1; // Thinner line width
  const lineLengthAdjustment = arrowHeadSize * 0.75; // Adjust this value as needed for line length

  // Calculate adjusted end points for the line
  const adjustedToX = toX - lineLengthAdjustment * Math.cos(angle);
  const adjustedToY = toY - lineLengthAdjustment * Math.sin(angle);

  // Create a new <line> element for the arrow
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

  // Set the attributes for the line
  line.setAttribute("x1", fromX.toString());
  line.setAttribute("y1", fromY.toString());
  line.setAttribute("x2", adjustedToX.toString());
  line.setAttribute("y2", adjustedToY.toString());
  line.setAttribute("stroke", "rgb(150, 190, 70)"); // Line color
  line.setAttribute("stroke-width", lineWidth.toString()); // Line width
  line.setAttribute("opacity", "0.9"); // Line opacity
  line.setAttribute("data-arrow", `${from}${to}`);
  line.setAttribute("id", `line-${from}${to}`); // Use 'line' in ID

  // Append the line to the SVG container
  svg.appendChild(line);

  // Create a new <polygon> element for the arrowhead
  const arrowhead = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polygon"
  );

  // Define points for the arrowhead
  const arrowheadPoints = `
          0,0 
          -${arrowHeadSize},${arrowHeadSize / 2} 
          -${arrowHeadSize},-${arrowHeadSize / 2}
      `;

  // Set the attributes for the arrowhead
  arrowhead.setAttribute("points", arrowheadPoints);
  arrowhead.setAttribute("fill", "rgb(150, 190, 70)"); // Color of the arrowhead
  arrowhead.setAttribute("opacity", "0.9"); // Arrowhead opacity
  arrowhead.setAttribute("data-arrowhead", `${from}${to}`);
  arrowhead.setAttribute("id", `arrowhead-${from}${to}`); // Use 'arrowhead' in ID

  // Position the arrowhead at the end of the line
  arrowhead.setAttribute(
    "transform",
    `translate(${toX}, ${toY}) rotate(${angle * (180 / Math.PI)})`
  );

  // Append the arrowhead to the SVG container
  svg.appendChild(arrowhead);
}
function clearArrows() {
  const svg = document.querySelector(".arrows"); // Get the SVG container
  const arrows = svg.querySelectorAll("line, polygon"); // Select all lines and polygons (arrows)

  arrows.forEach((arrow) => {
    svg.removeChild(arrow); // Remove each arrow from the SVG container
  });
}
// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "drawMove") {
    if (request.move.type === "move") {
      //console.log("Stockfish move:", message);
      drawArrow(request.move.from, request.move.to);
    }
  }
});

// Initialize the extension
await Start();
stopOnCheckmate();
