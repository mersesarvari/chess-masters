const chessCom = {
  mycolor: "w",
  isActive: false,
  intervalId: null,
  moves: [],

  showMoves: async function (moves) {
    // Make a POST request to the specified endpoint
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
          throw new Error(`HTTP error! status: ${response}`);
        }
        const data = await response.json();
        console.log(`[ fetchFen ]: ${data}`);
        return data;
      } catch (error) {
        console.error("Fetch error:", error); // Handle any errors that occur during fetch
      }
    }

    const { fen } = await fetchFen();

    try {
      chrome.runtime.sendMessage(
        { action: "getMove", fen: fen },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message failed:", chrome.runtime.lastError.message);
            return;
          }

          if (response && response.success && response.continuation) {
            const moves = response.continuation.split(" ");
            const firstMove = moves[0];

            if (firstMove.length === 4) {
              const from = firstMove.substring(0, 2);
              const to = firstMove.substring(2, 4);
              chessCom.drawArrow(from, to);
            }
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

    console.log("[ChessMaster]: Started");
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
    chessCom.isActive = false;
    chessCom.clearArrows();
    console.log("[ChessMaster]: Stopped");
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
                "https://chess-master-webpage.vercel.app/api/game",
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
  if (request.action === "startChessCom") {
    console.log("[CHESS.COM]: Start command recieved");
    await chessCom.Start();
    //await chessCom.saveOnCheckMate();
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "stop") {
    console.log("[CHESS.COM]: stop command recieved");
    chessCom.Stop();
  }
});
