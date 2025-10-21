//chess-board.js (content scrypt)
console.log("ChessCom content script loaded");

const chessCom = {
  mycolor: "w",
  isActive: false,
  intervalId: null,
  moves: [],

  showMoves: async function (moves) {
    try {
      console.log("Asking for best move from the server...");
      chrome.runtime.sendMessage(
        { action: "getMove", moves: moves },
        (response) => {
          console.log("Response:", response);

          if (chrome.runtime.lastError) {
            console.error("Message failed:", chrome.runtime.lastError.message);
            return;
          }

          if (response && response.success && response.from && response.to) {
            chessCom.drawArrow(response.from, response.to);
          } else if (response && response.error?.includes("Daily limit")) {
            // Show rate limit popup
            chessCom.showRateLimitPopup();
          }
        }
      );
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  },

  Start: async function () {
    chessCom.getColor();
    function boardHasChanged() {
      const moveNodes = chessCom.checkMoves();
      const currentMoves = moveNodes.map((node) => node.moveText);
      if (chessCom.moves.length < currentMoves.length) {
        chessCom.clearArrows();
        chessCom.moves = currentMoves;
        return true;
      } else {
        return false;
      }
    }

    const myTurn = (moves) => {
      if (chessCom.mycolor === "w" && moves.length % 2 === 0) {
        return true;
      }
      if (chessCom.mycolor === "b" && moves.length % 2 === 1) {
        return true;
      }
      return false;
    };

    if (chessCom.isActive) {
      console.log("Already active.");
      return;
    }
    chessCom.isActive = true;

    console.log("[ChessSolve]: Started");
    //Showing move if no move happened and it is my turn (Im white)
    if (myTurn(chessCom.moves) === true) {
      console.log("Show moves because this is my turn!");
      await chessCom.showMoves(chessCom.moves);
    }
    //Showing moves if a move happened and it is my turn!
    chessCom.intervalId = setInterval(async function () {
      if (boardHasChanged() === true && myTurn(chessCom.moves) === true) {
        await chessCom.showMoves(chessCom.moves);
      }
    }, 100);
  },

  Stop: function () {
    if (chessCom.intervalId) {
      clearInterval(chessCom.intervalId);
      chessCom.intervalId = null;
    }

    chessCom.moves = [];
    chessCom.isActive = false; // ✅ ensure reset
    chessCom.clearArrows();
    console.log("[ChessSolve]: Stopped");
    chrome.runtime.sendMessage({ action: "stoppedAck" });
  },

  saveOnCheckMate: async function () {
    let checkInterval = null;
    if (!chessCom.isActive) {
      chessCom.moves = [];
      chessCom.isActive = false;
      return;
    } else {
      checkInterval = setInterval(async () => {
        const pageText = document.body.innerText || document.body.textContent;

        const isGameOver = pageText?.includes("Game Review");

        // Check if game is over and if a winner is found
        if (isGameOver) {
          chessCom.clearArrows();

          const mewon = pageText?.includes("You Won!");
          const blackWon = pageText?.includes("Black Won!");
          const whiteWon = pageText?.includes("White Won!");
          const draw = pageText?.includes("Draw");

          let winColor = "w"; // Initialize winColor
          if (mewon) {
            console.log(`You won with ${chessCom.mycolor}`);
            winColor = chessCom.mycolor;
          } else if (blackWon || whiteWon) {
            console.log(
              `Opponent won with ${chessCom.mycolor === "w" ? "b" : "w"}`
            );
            winColor = chessCom.mycolor === "w" ? "b" : "w";
          } else if (draw) {
            winColor = "-";
            console.log("Draw");
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
              moves: chessCom.moves,
              winColor: winColor,
              myColor: chessCom.mycolor,
              email: email, // Use the email retrieved from storage
            };

            // Saving the game to the database
            try {
              const response = await fetch(
                "https://www.chesssolve.com/api/game",
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
            }
            chessCom.moves = [];
          });
        }
      }, 100); // Check every 1000 milliseconds (1 second)
    }
  },

  getWinner: function () {
    // Select the element containing the header with the winner text
    const winnerElement = document.querySelector(".header-title-component");

    // If the element exists, retrieve and return the text content (e.g., "White Won")
    if (winnerElement) {
      return winnerElement?.textContent?.trim();
    } else {
      return "Winner not found";
    }
  },

  checkMoves: function () {
    try {
      // Select all div elements with class 'node'
      const moves = document.querySelectorAll(".node");

      // Create an array to store the extracted moves
      const extractedMoves = [];

      // Loop through the selected div elements
      moves.forEach((move) => {
        let moveText = "";
        // Extract the data-node attribute and the move text inside the span
        const dataNode = move.getAttribute("data-node");
        //Checkin if the span has a span with the moving piece icon:
        const pieceIcon = move?.querySelector("span[data-figurine]");
        //If it has an icon, extract the text
        if (pieceIcon === null) {
          moveText = move?.querySelector("span")?.textContent?.trim();
        } else {
          const iconValue = pieceIcon.getAttribute("data-figurine");
          moveText = `${iconValue}${move
            ?.querySelector("span")
            ?.textContent?.trim()}`;
        }

        // If move text is available, store the result
        if (moveText) {
          extractedMoves.push({ dataNode, moveText });
        }
      });
      return extractedMoves;
    } catch (error) {
      console.error("checkMoves failed:", error);
      return [];
    }
  },

  getColor: function () {
    const board =
      document.querySelector("#board-play-computer") ||
      document.querySelector("#board-single");
    if (!board) {
      console.error("Chess board not found.");
      return;
    }
    if (board.className.includes("flipped")) {
      chessCom.mycolor = "b";
      console.log("You are with the black pieces.");
    } else {
      chessCom.mycolor = "w";
      console.log("You are with the white pieces.");
    }
  },

  chessNotationToMatrix: function (chessNotation) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    // Extract the file and rank from the chess notation
    const file = chessNotation.charAt(0); // First character (file)
    const rank = parseInt(chessNotation.charAt(1)); // Second character (rank)

    // Calculate the column index (0-7)
    const col = files.indexOf(file);

    // Calculate the row index (0-7) based on the rank
    const row = 8 - rank; // Convert rank to 0-based index (8 -> 0, 1 -> 7, etc.)

    return { row, col }; // Return as an object
  },

  drawArrow: function (from, to) {
    console.log(`DrawArrow from: ${from} to: ${to}`);
    const svg = document.querySelector(".arrows"); // Get the SVG container

    // Convert chess squares to matrix coordinates
    const fromCoord = chessCom.chessNotationToMatrix(from);
    const toCoord = chessCom.chessNotationToMatrix(to);

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
    svg?.appendChild(line);

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
    svg?.appendChild(arrowhead);
  },

  clearArrows: function () {
    const svg = document.querySelector(".arrows"); // Get the SVG container
    const arrows = svg?.querySelectorAll("line, polygon"); // Select all lines and polygons (arrows)

    arrows?.forEach((arrow) => {
      svg?.removeChild(arrow); // Remove each arrow from the SVG container
    });
  },
};

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
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
// Popup function
// --------------------
chessCom.showRateLimitPopup = function () {
  // Avoid creating multiple popups
  if (document.querySelector("#chess-limit-popup")) return;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "chess-limit-popup-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "rgba(0,0,0,0.4)";
  overlay.style.zIndex = 9999;
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";

  // Create popup
  const popup = document.createElement("div");
  popup.id = "chess-limit-popup";
  popup.style.background = "#fff";
  popup.style.padding = "20px";
  popup.style.borderRadius = "10px";
  popup.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
  popup.style.maxWidth = "400px";
  popup.style.textAlign = "center";
  popup.style.fontFamily = "Arial, sans-serif";

  popup.innerHTML = `
    <h2 style="margin-bottom:10px; color:#333;">Daily Limit Reached</h2>
    <p style="margin-bottom:15px; color:#555;">
      You have reached your 20 requests/day limit. 
      To continue using the bot, please support us on Ko-fi.
    </p>
    <a href="https://ko-fi.com/nazmox" target="_blank" style="
        display:inline-block;
        padding:10px 20px;
        background:#ff5c5c;
        color:#fff;
        border-radius:5px;
        text-decoration:none;
        margin-bottom:10px;
    ">Become a Supporter</a>
    <br/>
    <button id="chess-limit-popup-close" style="
        padding:6px 12px;
        border:none;
        background:#ccc;
        border-radius:5px;
        cursor:pointer;
        margin-top:10px;
    ">Close</button>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Close button
  document
    .getElementById("chess-limit-popup-close")
    .addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
};
