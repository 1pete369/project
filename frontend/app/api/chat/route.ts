const GRAPHQL_URL =
  process.env.GRAPHQL_URL || "http://localhost:4000/";

const ASK_AI_MUTATION = `
  mutation AskAI($prompt: String!) {
    askAI(prompt: $prompt) {
      message
      displayFocus
      movies {
        Id
        Title
        Genres
        Description
        Director
        Actors {
          Id
          Name
        }
        Year
        Runtime
        Rating
        Votes
        Revenue
      }
      actors {
        Id
        Name
      }
    }
  }
`;

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { error: "Prompt is required." },
        { status: 400 },
      );
    }

    const graphqlRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ASK_AI_MUTATION,
        variables: { prompt },
      }),
    });

    if (!graphqlRes.ok) {
      const text = await graphqlRes.text();
      console.error("GraphQL error response:", text);
      return Response.json(
        { error: "Failed to reach AI server." },
        { status: 502 },
      );
    }

    const result = await graphqlRes.json();

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return Response.json(
        { error: "AI server returned an error." },
        { status: 500 },
      );
    }

    const aiResult = result.data?.askAI;
    const message: string =
      (aiResult && typeof aiResult.message === "string"
        ? aiResult.message
        : "") || "";
    const movies = Array.isArray(aiResult?.movies) ? aiResult.movies : [];
    const actors = Array.isArray(aiResult?.actors) ? aiResult.actors : [];
    const displayFocus: string | null =
      aiResult && typeof aiResult.displayFocus === "string" ? aiResult.displayFocus : null;

    return Response.json({ message, movies, actors, displayFocus });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}

