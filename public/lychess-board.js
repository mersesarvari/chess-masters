let mycolor = "w";
let isActive = false;
let intervalId = null;
let moves = [];
let isStopOnCheckmateActive = false;
let url = window.location.href;
console.log("Current URL:", url);

// !OK
async function Start() {
  getColor();
  function boardHasChanged() {
    const currentMoves = checkMoves();
    if (moves.length < currentMoves.length) {
      clearArrows();
      moves = currentMoves;
      console.log("[ MOVES ] : ", moves);
      return true;
    } else {
      return false;
    }
  }

  function myTurn(moves) {
    if (mycolor === "w" && moves.length % 2 === 0) {
      return true;
    }
    if (mycolor === "b" && moves.length % 2 === 1) {
      return true;
    }
    return false;
  }
  async function showMoves(moves) {
    // Make a POST request to the specified endpoint
    async function fetchFen() {
      try {
        const response = await fetch(
          "https://www.chessmaster.cloud/api/chess",
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
          throw new Error(`HTTP error! status: ${response}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Fetch error:", error); // Handle any errors that occur during fetch
      }
    }

    const { fen } = await fetchFen();

    async function postChessApi(fen) {
      console.log(`[ postChessApi ]: ${fen}`);
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

  console.log("[ChessMaster]: Started");
  //Showing move if no move happened and it is my turn (Im white)
  if (myTurn(moves) === true) {
    console.log("Show moves because this is my turn!");
    await showMoves(moves);
  }
  //Showing moves if a move happened and it is my turn!
  intervalId = setInterval(async function () {
    if (boardHasChanged() === true && myTurn(moves) === true) {
      await showMoves(moves);
    }
  }, 100);
}

// !OK
function Stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  moves = [];
  isActive = false;
  clearArrows();
  console.log("[ChessMaster]: Stopped");
}

async function stopOnCheckmate() {
  if (isStopOnCheckmateActive || !isActive) {
    return;
  } else {
    isStopOnCheckmateActive = true;
    isActive = false;
    const checkInterval = setInterval(async () => {
      const pageText = document.body.innerText || document.body.textContent;

      //Options when the game ended
      const blackWon = pageText.includes("Checkmate • Black is victorious");
      const whiteWon = pageText.includes("Checkmate • White is victorious");
      const gameAborted = pageText.includes("Game aborted");
      const draw = pageText.includes("Draw");

      // Check if the text contains keywords indicating game over or checkmate
      // ! TODO: Checking draw or stealmate
      const isGameOver = blackWon || whiteWon || gameAborted || draw;

      // Check if game is over and if a winner is found
      if (isGameOver) {
        //Stopping from re-running
        isActive = false;
        clearInterval(checkInterval);
        clearArrows();

        winColor = "-";
        if (whiteWon) {
          winColor = "w";
          console.log("[GAME ENDED]: White Won!");
        } else if (blackWon) {
          winColor = "b";
          console.log("[GAME ENDED]: Black Won!");
        } else {
          winColor = "-";
          console.log("[GAME ENDED]: Draw");
        }

        // Fetch email asynchronously
        chrome.storage.local.get(["email"], async (result) => {
          const email = result.email;

          if (!email) {
            // If no email found, stop:
            return;
          }

          // Prepare the game object
          const gameObject = {
            moves: moves,
            winColor: winColor,
            myColor: mycolor,
            email: email, // Use the email retrieved from storage
          };

          // Saving the game to the database
          try {
            const response = await fetch(
              "https://www.chessmaster.cloud/api/game",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(gameObject),
              }
            );

            if (!response.ok) {
              console.error("Cannot save the game to the database!");
            } else {
              console.log("Game saved to the database!");
            }
          } catch (error) {
            console.error("Cannot save the game to the database!", error);
          } finally {
            Stop();
            console.log("[BOARD.js]: Stopped on checkmate");
            isStopOnCheckmateActive = false;
          }
        });
      }
    }, 100); // Check every 1000 milliseconds (1 second)
  }
}

function getWinner() {
  // Select the element containing the header with the winner text
  const winnerElement = document.querySelector(
    "#main-wrap > main > aside > div > section.status"
  );

  // If the element exists, retrieve and return the text content (e.g., "White Won")
  if (winnerElement) {
    return winnerElement.textContent.trim();
  } else {
    return "Winner not found";
  }
}

function checkMoves() {
  // Select all move pairs (each `i5z` contains a number, and its sibling `kwdb` contains moves)
  const moveNodes = document.querySelectorAll("i5z");

  // Array to store the extracted moves
  const moves = [];

  // Loop through each move number node
  moveNodes.forEach((moveNode) => {
    // Get the white move (first sibling `kwdb`)
    const whiteMove = moveNode.nextElementSibling?.textContent.trim();

    // Get the black move (second sibling `kwdb`)
    const blackMove =
      moveNode.nextElementSibling?.nextElementSibling?.textContent.trim();

    // Add moves to the list (only include if they exist)
    if (whiteMove) moves.push(whiteMove);
    if (blackMove) moves.push(blackMove);
  });
  //console.log("[MOVES] :", moves);
  return moves;
}

function getColor() {
  const board = document.querySelector(".cg-wrap");
  if (!board) {
    console.error("Chess board not found.");
    return;
  }
  // Check if the next element has the "manipulated" attribute
  if (board && board.className.includes("orientation-white")) {
    mycolor = "w";
    console.log("You are with the white pieces.");
  } else {
    mycolor = "b";
    console.log("You are with the black pieces.");
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
  let isFlipped = mycolor === "b";

  console.log(`[ DrawArrow ]: ${from} ---> ${to}`);
  const svg = document.querySelector(".cg-shapes"); // Get the SVG container

  // Convert chess squares to matrix coordinates
  const fromCoord = chessNotationToMatrix(from);
  const toCoord = chessNotationToMatrix(to);

  // Map chessboard rows and columns (0-7) to the SVG `viewBox` range (-4 to 4)
  const mapToSvg = (value) => -4 + (value / 7) * 8;

  // Adjust coordinates based on whether the board is flipped
  const adjustRow = (row) => (isFlipped ? 7 - row : row);
  const adjustCol = (col) => (isFlipped ? 7 - col : col);

  // Correctly adjust both rows and columns for flipped boards
  const adjustedFromRow = adjustRow(fromCoord.row);
  const adjustedFromCol = adjustCol(fromCoord.col);
  const adjustedToRow = adjustRow(toCoord.row);
  const adjustedToCol = adjustCol(toCoord.col);

  // Define SVG coordinates based on the adjusted matrix coordinates
  const fromX = mapToSvg(adjustedFromCol);
  const fromY = mapToSvg(adjustedFromRow); // Correctly flipped Y-axis
  const toX = mapToSvg(adjustedToCol);
  const toY = mapToSvg(adjustedToRow); // Correctly flipped Y-axis

  // Calculate angle for the arrow
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Define the arrowhead size and line width
  const arrowHeadSize = 0.3; // Scaled down for the SVG's coordinate system
  const lineWidth = 0.1; // Thin line width for the SVG coordinate space
  const lineLengthAdjustment = arrowHeadSize * 0.75;

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
  line.setAttribute("stroke", "rgb(16, 31, 163)"); // Line color
  line.setAttribute("stroke-width", lineWidth.toString()); // Line width
  line.setAttribute("opacity", "1"); // Line opacity
  line.setAttribute("data-arrow", `${from}${to}`);
  line.setAttribute("id", `line-${from}${to}`); // Use 'line' in ID

  // Append the line to the SVG container
  svg.appendChild(line);

  // Create a new <polygon> element for the arrowhead
  const arrowhead = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polygon"
  );

  // Define points for the arrowhead (adjusted for the smaller SVG scale)
  const arrowheadPoints = `
          0,0 
          -${arrowHeadSize},${arrowHeadSize / 2} 
          -${arrowHeadSize},-${arrowHeadSize / 2}
      `;

  // Set the attributes for the arrowhead
  arrowhead.setAttribute("points", arrowheadPoints);
  arrowhead.setAttribute("fill", "rgb(16, 31, 163)"); // Color of the arrowhead
  arrowhead.setAttribute("opacity", "1"); // Arrowhead opacity
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
  const svg = document.querySelector(".cg-shapes"); // Get the SVG container
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

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "start") {
    console.log("[BOARD:js]: Start command recieved");
    await Start();
    await stopOnCheckmate();
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "stop") {
    console.log("[BOARD:js]: stop command recieved");
    Stop();
  }
});
