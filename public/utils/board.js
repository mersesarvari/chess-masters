export async function fetchFen() {
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
