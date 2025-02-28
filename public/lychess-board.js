const lychessOrg = {
  mycolor: "w",
  isActive: false,
  intervalId: null,
  moves: [],

  Start: async function () {
    lychessOrg.getColor();
    function boardHasChanged() {
      const currentMoves = lychessOrg.checkMoves();
      if (lychessOrg.moves.length < currentMoves.length) {
        lychessOrg.clearArrows();
        lychessOrg.moves = currentMoves;
        console.log("[ MOVES ] : ", lychessOrg.moves);
        return true;
      } else {
        return false;
      }
    }

    function myTurn(moves) {
      if (lychessOrg.mycolor === "w" && moves.length % 2 === 0) {
        return true;
      }
      if (lychessOrg.mycolor === "b" && moves.length % 2 === 1) {
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
      lychessOrg.drawArrow(apiData.from, apiData.to);
    }

    if (lychessOrg.isActive) {
      console.log("Already active.");
      return;
    }
    lychessOrg.isActive = true;

    console.log("[ChessMaster]: Started");
    //Showing move if no move happened and it is my turn (Im white)
    if (myTurn(lychessOrg.moves) === true) {
      console.log("Show moves because this is my turn!");
      await showMoves(lychessOrg.moves);
    }
    //Showing moves if a move happened and it is my turn!
    lychessOrg.intervalId = setInterval(async function () {
      if (boardHasChanged() === true && myTurn(lychessOrg.moves) === true) {
        await showMoves(lychessOrg.moves);
      }
    }, 100);
  },

  Stop: async function () {
    if (lychessOrg.intervalId) {
      clearInterval(lychessOrg.intervalId);
      lychessOrg.intervalId = null;
    }

    lychessOrg.moves = [];
    lychessOrg.isActive = false;
    lychessOrg.clearArrows();
    console.log("[ChessMaster]: Stopped");
  },

  saveOnCheckMate: async function () {
    let checkInterval = null;
    if (!lychessOrg.isActive) {
      lychessOrg.moves = [];
      clearInterval(checkInterval);
      return;
    } else {
      checkInterval = setInterval(async () => {
        const pageText = document.body.innerText || document.body.textContent;

        //Options when the game ended
        const blackWon = pageText?.includes("Black is victorious");
        const whiteWon = pageText?.includes("White is victorious");
        const gameAborted = pageText?.includes("Game aborted");
        const draw = pageText?.includes("Draw");

        // Check if the text contains keywords indicating game over or checkmate
        // ! TODO: Checking draw or stealmate
        const isGameOver = blackWon || whiteWon || gameAborted || draw;

        // Check if game is over and if a winner is found
        if (isGameOver) {
          lychessOrg.clearArrows();

          let winColor = "-";
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
              moves: lychessOrg.moves,
              winColor: winColor,
              myColor: lychessOrg.mycolor,
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
            }
            lychessOrg.moves = [];
          });
        }
      }, 200); // Check every 1000 milliseconds (1 second)
    }
  },

  getWinner: async function () {
    // Select the element containing the header with the winner text
    const winnerElement = document.querySelector(
      "#main-wrap > main > aside > div > section.status"
    );

    // If the element exists, retrieve and return the text content (e.g., "White Won")
    if (winnerElement) {
      return winnerElement?.textContent?.trim();
    } else {
      return "Winner not found";
    }
  },

  checkMoves: function () {
    // Select all move pairs (each `i5z` contains a number, and its sibling `kwdb` contains moves)
    const moveNodes = document.querySelectorAll("i5z");

    // Array to store the extracted moves
    const moves = [];

    // Loop through each move number node
    moveNodes.forEach((moveNode) => {
      // Get the white move (first sibling `kwdb`)
      const whiteMove = moveNode?.nextElementSibling?.textContent?.trim();

      // Get the black move (second sibling `kwdb`)
      const blackMove =
        moveNode?.nextElementSibling?.nextElementSibling?.textContent?.trim();

      // Add moves to the list (only include if they exist)
      if (whiteMove) moves.push(whiteMove);
      if (blackMove) moves.push(blackMove);
    });
    //console.log("[MOVES] :", moves);
    return moves;
  },

  getColor: function () {
    const board = document.querySelector(".cg-wrap");
    if (!board) {
      console.error("Chess board not found.");
      return;
    }
    // Check if the next element has the "manipulated" attribute
    if (board && board.className.includes("orientation-white")) {
      lychessOrg.mycolor = "w";
      console.log("You are with the white pieces.");
    } else {
      lychessOrg.mycolor = "b";
      console.log("You are with the black pieces.");
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
    let isFlipped = lychessOrg.mycolor === "b";

    console.log(`[ DrawArrow ]: ${from} ---> ${to}`);
    const svg = document.querySelector(".cg-shapes"); // Get the SVG container

    // Convert chess squares to matrix coordinates
    const fromCoord = lychessOrg.chessNotationToMatrix(from);
    const toCoord = lychessOrg.chessNotationToMatrix(to);

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
    svg?.appendChild(line);

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
    svg?.appendChild(arrowhead);
  },

  clearArrows: function () {
    const svg = document.querySelector(".cg-shapes"); // Get the SVG container
    const arrows = svg.querySelectorAll("line, polygon"); // Select all lines and polygons (arrows)

    arrows.forEach((arrow) => {
      svg.removeChild(arrow); // Remove each arrow from the SVG container
    });
  },

  createSupportPopup: function () {
    // Create modal elements
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
        width: 400px;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 10px;
        color: white;
        font-family: Arial, sans-serif;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    // Add content
    modalContent.innerHTML = `
        <h1 style="margin-bottom: 20px; font-size: 24px;">Support Chess Bot</h1>
        <div style="margin-bottom: 30px; line-height: 1.5;">
            Thank you for using my chess bot extension! If you're enjoying the enhanced gameplay experience, 
            please consider supporting this project to help keep it growing! ♟️
        </div>
        <div>
            <button id="supportBtn" style="
                padding: 10px 20px;
                background: #ffd700;
                color: #333;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                margin: 5px;
                transition: background 0.3s;
            ">Support Project ❤️</button>
            
            <button id="closeBtn" style="
                padding: 10px 20px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                margin: 5px;
                transition: background 0.3s;
            ">Close</button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Add hover effects
    const supportBtn = modalContent.querySelector("#supportBtn");
    const closeBtn = modalContent.querySelector("#closeBtn");

    supportBtn.onmouseover = () => (supportBtn.style.background = "#ffed4a");
    supportBtn.onmouseout = () => (supportBtn.style.background = "#ffd700");
    closeBtn.onmouseover = () =>
      (closeBtn.style.background = "rgba(255, 255, 255, 0.3)");
    closeBtn.onmouseout = () =>
      (closeBtn.style.background = "rgba(255, 255, 255, 0.2)");

    // Add click handlers
    supportBtn.onclick = () => {
      window.open("https://ko-fi.com/nazmox", "_blank");
      modal.remove();
    };

    closeBtn.onclick = () => {
      modal.remove();
    };

    // Close on overlay click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };

    // Close on escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        modal.remove();
      }
    });
  },
};

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "startLychessOrg") {
    console.log("[LYCHESS]: Start command recieved");
    lychessOrg.createSupportPopup();
    await lychessOrg.Start();
    //await lychessOrg.saveOnCheckMate();
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "stop") {
    console.log("[LYCHESS]: stop command recieved");
    lychessOrg.Stop();
  }
});
