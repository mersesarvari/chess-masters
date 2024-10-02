let mycolor = "w";
let previousFEN = "";
let isActive = false;
let intervalId = null;

function startFENChangeCheck() {
  if (isActive) {
    console.log("Already active.");
    return;
  }

  isActive = true;
  intervalId = setInterval(checkFENChange, 100);
  console.log("FEN change check started.");
}

function stopFENChangeCheck() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    previousFEN = "";
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

function checkFENChange() {
  let currentFEN = getCurrentFEN();

  if (
    currentFEN.split(" ")[0] &&
    currentFEN.split(" ")[0] !== previousFEN.split(" ")[0]
  ) {
    let opponentMoved = checkIfOpponentMoved(currentFEN, previousFEN, mycolor);
    clearArrows();

    chrome.runtime.sendMessage(
      {
        action: "sendFEN",
        fen: currentFEN,
      },
      (response) => {
        console.log(response.status);
      }
    );

    if (opponentMoved) {
      console.log("Bot Moved!");
    } else {
      console.log("Player Moved");
    }
  }
  previousFEN = currentFEN;
}

function checkIfOpponentMoved(currentFen, previousFen, myColor) {
  opponentColor = mycolor === "w" ? "b" : "w";
  //Checking if this is the opponent turn:

  if (previousFEN === "" || currentFen === "" || !previousFEN || !currentFen) {
    if (mycolor === "w") {
      return true;
    } else {
      return false;
    }
  }
  const currentPosition = currentFen.split(" ")[0];
  const previousPosition = previousFen.split(" ")[0];

  // Check if the positions are different
  if (currentPosition !== previousPosition) {
    // Determine opponent's pieces regex based on the color
    const opponentPiecesRegex = myColor === "w" ? /[a-z]/g : /[A-Z]/g; // Regex to find opponent pieces

    // Track positions of opponent pieces before and after the move
    const opponentPiecePositionsBefore = {};
    const opponentPiecePositionsAfter = {};

    // Populate positions for pieces before the move
    for (let i = 0; i < previousPosition.length; i++) {
      const piece = previousPosition[i];
      if (opponentPiecesRegex.test(piece)) {
        // If it's an opponent piece
        opponentPiecePositionsBefore[piece] =
          opponentPiecePositionsBefore[piece] || [];
        opponentPiecePositionsBefore[piece].push(i); // Store position
      }
    }

    // Populate positions for pieces after the move
    for (let i = 0; i < currentPosition.length; i++) {
      const piece = currentPosition[i];
      if (opponentPiecesRegex.test(piece)) {
        // If it's an opponent piece
        opponentPiecePositionsAfter[piece] =
          opponentPiecePositionsAfter[piece] || [];
        opponentPiecePositionsAfter[piece].push(i); // Store position
      }
    }

    // Check if any opponent pieces have moved
    for (const piece in opponentPiecePositionsBefore) {
      const positionsBefore = opponentPiecePositionsBefore[piece];
      const positionsAfter = opponentPiecePositionsAfter[piece] || [];

      // If the piece exists in both positions but the positions differ, it has moved
      if (
        positionsAfter.length > 0 && // The piece still exists
        (positionsAfter.length !== positionsBefore.length ||
          !positionsBefore.every((pos, index) => pos === positionsAfter[index]))
      ) {
        return true; // Opponent has moved a piece
      }
    }
  }
  return false; // Opponent has not moved any pieces
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

function getCurrentFEN() {
  const chessBoard =
    document.querySelector("#board-play-computer") ||
    document.querySelector("#board-single");

  if (chessBoard) {
    const array = convertChessBoardToArray(chessBoard, 90);
    return convertChessBoardToFEN(array);
  } else {
    console.error("Chess board not found.");
    return "";
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

function convertChessBoardToFEN(chessBoard, activeColor = "w") {
  const pieceMap = {
    wr: "R",
    wn: "N",
    wb: "B",
    wk: "K",
    wq: "Q",
    wp: "P",
    br: "r",
    bn: "n",
    bb: "b",
    bk: "k",
    bq: "q",
    bp: "p",
  };

  let fen = "";

  for (let row of chessBoard) {
    let emptyCount = 0; // Counter for empty squares in the row
    for (let square of row) {
      if (square) {
        if (emptyCount > 0) {
          // If there were empty squares before this piece, add their count
          fen += emptyCount;
          emptyCount = 0; // Reset the empty count
        }
        if (!pieceMap[square]) {
          throw new Error(`Invalid piece: ${square}`);
        }
        fen += pieceMap[square]; // Convert piece to FEN
      } else {
        emptyCount++; // Increment the empty square count
      }
    }
    if (emptyCount > 0) {
      // Add the count of empty squares at the end of the row
      fen += emptyCount;
    }
    fen += "/"; // Add a slash to separate rows
  }

  // Remove the trailing slash from the FEN string
  fen = fen.slice(0, -1);

  // Adding additional FEN information
  const castlingAvailability = "-"; // No castling available for this example
  const enPassantTargetSquare = "-"; // No en passant target square
  const halfmoveClock = 0; // Halfmove clock
  const fullmoveNumber = 1; // Fullmove number

  // Concatenating all parts to create the final FEN string
  const finalFEN = `${fen} ${activeColor} ${castlingAvailability} ${enPassantTargetSquare} ${halfmoveClock} ${fullmoveNumber}`;
  return finalFEN;
}

function convertChessBoardToArray(chessBoardHTML, degree) {
  const pieces = chessBoardHTML.querySelectorAll(".piece");
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  pieces.forEach((piece) => {
    const classList = piece.className.split(" ");

    // Get the square class and piece type
    const squareClass = classList.find((cls) => cls.startsWith("square-")); // e.g., square-42
    const pieceType = classList.find((cls) => cls.length === 2); // Assuming piece types are always 2 letters long

    if (squareClass && pieceType) {
      // Get the square index from class name
      const squareIndex = parseInt(squareClass.replace("square-", ""), 10);
      const file = squareIndex % 10; // File (1-8 corresponds to a-h)
      const rank = Math.floor(squareIndex / 10); // Rank (1-8 corresponds to 1-8)

      // Map to board coordinates
      const row = 8 - rank; // Convert to array index (0-7)
      const col = file - 1; // Convert to array index (0-7)

      // Place the piece in the board array
      board[row][col] = pieceType;
    }
  });

  // Reverse the rows of the board
  board.forEach((row) => row.reverse());

  // Rotate the board based on the given degree
  let rotated = rotateMatrix(board, degree);
  return rotated;
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

function showStockFishMove(message) {
  if (message.type === "move") {
    console.log("Stockfish move:", message);
    return { from: message.from, to: message.to };
  }
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
  line.setAttribute("x1", fromX);
  line.setAttribute("y1", fromY);
  line.setAttribute("x2", adjustedToX);
  line.setAttribute("y2", adjustedToY);
  line.setAttribute("stroke", "rgb(150, 190, 70)"); // Line color
  line.setAttribute("stroke-width", lineWidth); // Line width
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    }, 4000);
    sendResponse({ status: "started" });
  }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "drawMove") {
    if (request.move.type === "move") {
      const { from, to } = showStockFishMove(request.move);
      drawArrow(from, to);
    }
  }
});

// Initialize the extension
getColor();
startFENChangeCheck();
stopOnCheckmate();
