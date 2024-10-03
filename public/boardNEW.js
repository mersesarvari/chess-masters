let mycolor = "w";
let isActive = false;
let intervalId = null;
let activeColor = "w";
let turnCounter = 0;

//FENS
let previousBoardFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
let currentBoardFEN = previousBoardFEN;

function Start() {
  /* if (isActive) {
    console.log("Already active.");
    return;
  }

  isActive = true;
  //intervalId = setInterval(checkFENChange, 100);
  console.log("FEN change check started."); */
  setTimeout(async function () {
    const moveNodes = checkMoves();
    const moves = moveNodes.map((node) => node.moveText);
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
        console.log("Response from server:", data);
        return data;
      } catch (error) {
        console.error("Fetch error:", error); // Handle any errors that occur during fetch
      }
    }

    const fen = await fetchFen(); // Call the fetch function
    //Sending FEN to bot.js
    chrome.runtime.sendMessage(
      {
        action: "sendFEN",
        fen: fen,
      },
      (response) => {
        console.log(response.status);
      }
    );
  }, 4000);
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

/* function checkFENChange() {
  currentBoardFEN = getCurrentFEN();
  //Checking if the board changed
  if (previousBoardFEN === currentBoardFEN) {
    return;
  } else {
    //Setting up current and previous FEN
    const currentFEN = currentBoardFEN;
    const previousFEN = currentBoardFEN;

    //Setting previous and current
    turnCounter++;
    let apiResponse = null;

    //Comparing previous move to current move to get what we moved and who is the active
    chrome.runtime.sendMessage(
      {
        action: "compareMoves",
        fen1: previousBoardFEN,
        fen2: currentBoardFEN,
      },
      (response) => {
        console.log(response.status, response.data);
        if (response?.data) {
          apiResponse = response.data;
          //Setting the active color:
          activeColor = apiResponse.after.split(" ")[1];
        }
      }
    );

    //Clearing arrows
    clearArrows();

    //Sending data after movement to analyze
    chrome.runtime.sendMessage(
      {
        action: "sendFEN",
        fen: currentFEN,
      },
      (response) => {
        console.log(response.status);
      }
    );
    previousFEN = currentFEN;
    console.log("TurnCounter", turnCounter);
    console.log("Previous fen:", previousFEN);
    console.log("Current fen:", currentFEN);
  }
} */

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

  // Log or return the result
  console.log(extractedMoves);
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

function rotateMatrix(matrix, degrees) {
  // Helper function to rotate 90 degrees clockwise
  function rotate90(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotatedMatrix = Array.from({ length: cols }, () =>
      Array(rows).fill(null)
    );

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        rotatedMatrix[col][rows - 1 - row] = matrix[row][col];
      }
    }
    return rotatedMatrix;
  }

  // Normalize degrees to be within 0-360
  degrees = degrees % 360;

  if (degrees === 0) {
    return matrix; // No rotation needed
  } else if (degrees === 90) {
    return rotate90(matrix); // Rotate 90 degrees
  } else if (degrees === 180) {
    return rotate90(rotate90(matrix)); // Rotate 180 degrees
  } else if (degrees === 270) {
    return rotate90(rotate90(rotate90(matrix))); // Rotate 270 degrees
  } else {
    throw new Error(
      "Invalid rotation value. Acceptable values are 0, 90, 180, 270."
    );
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

// Listen for messages from the popup or background script
/* chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "stopBot") {
    console.log("[BOT]: Stop command received");
    stopFENChangeCheck();
    sendResponse({ status: "stopped" });
  } else if (request.action === "startBot") {
    console.log("[BOT]: Start command received");
    stopFENChangeCheck();
    setTimeout(function () {
      stopOnCheckmate();
      getColor();
      startFENChangeCheck();
    }, 5000);
    sendResponse({ status: "started" });
  }
}); */

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
getColor();
Start();
stopOnCheckmate();
