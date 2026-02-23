"use client";

import { useEffect, useRef, useState } from "react";

type Actor = {
  Id: number;
  Name: string;
};

type MovieActor = {
  Id: number | null;
  Name: string;
};

type Movie = {
  Id: number;
  Title: string;
  Genres: string[];
  Description?: string | null;
  Director?: string | null;
  Actors: MovieActor[];
  Year?: number | null;
  Runtime?: number | null;
  Rating?: number | null;
  Votes?: number | null;
  Revenue?: number | null;
};

type DisplayFocus = "genres" | "actors" | "full" | null;

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      movies?: Movie[];
      actors?: Actor[];
      displayFocus?: DisplayFocus;
    };

const IconSend = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);
export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask me about movies and actors, or request to create/update/delete them.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      const movies: Movie[] = data.movies ?? [];
      const actors: Actor[] = data.actors ?? [];
      const displayFocus: DisplayFocus =
        data.displayFocus === "genres" || data.displayFocus === "actors" || data.displayFocus === "full"
          ? data.displayFocus
          : null;
      const assistantTextFromServer =
        typeof data.message === "string" ? data.message : "";
      const fallbackText =
        movies.length === 0 && actors.length === 0
          ? "I couldn't find any movies or actors matching your request."
          : `I found ${movies.length} movie${movies.length !== 1 ? "s" : ""} and ${actors.length} actor${actors.length !== 1 ? "s" : ""}.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: assistantTextFromServer || fallbackText,
          movies,
          actors,
          displayFocus: displayFocus ?? undefined,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error occurred.");
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: "I ran into a problem talking to the server.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen w-screen flex-col bg-[#f5f5f5] text-[#171717] font-sans">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-center border-b border-gray-200 bg-white px-4 py-3">
        <span className="text-base font-medium text-gray-900">IMDB Chat</span>
      </header>

      {/* Chat area */}
      <section className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-[#3b82f6] px-4 py-2.5 text-sm text-white"
                    : "max-w-[85%] text-sm leading-relaxed text-gray-800"
                }
              >
                <p className="whitespace-pre-wrap">{message.text}</p>

                {"movies" in message &&
                  message.movies &&
                  message.movies.length > 0 &&
                  (message.displayFocus === "genres" ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold text-gray-700">Genres</p>
                      <ul className="list-none space-y-2 text-gray-800">
                        {message.movies.map((movie) => (
                          <li key={movie.Id}>
                            <span className="font-medium">{movie.Title}:</span>{" "}
                            {Array.isArray(movie.Genres) && movie.Genres.length > 0
                              ? movie.Genres.join(", ")
                              : "—"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : message.displayFocus === "actors" ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold text-gray-700">Cast</p>
                      {message.movies.map(
                        (movie) =>
                          movie.Actors?.length > 0 && (
                            <div key={movie.Id} className="mb-3">
                              <p className="text-sm font-medium text-gray-800">
                                {(message.movies?.length ?? 0) > 1 ? `${movie.Title}:` : ""}
                              </p>
                              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-700">
                                {movie.Actors.map((a, i) => (
                                  <li key={a.Id ?? i}>{a.Name}</li>
                                ))}
                              </ul>
                            </div>
                          )
                      )}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold text-gray-700">
                        Quick comparison ({message.movies.length} movies)
                      </p>
                      <div className="max-h-[70vh] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                        <div className="overflow-y-auto max-h-[70vh]">
                          <table className="w-full min-w-0 text-left text-sm table-fixed">
                            <thead className="sticky top-0 z-10 bg-gray-50">
                              <tr className="border-b border-gray-200">
                                <th className="w-12 px-3 py-2 font-medium text-gray-700">Id</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Title</th>
                                <th className="w-16 px-3 py-2 font-medium text-gray-700">Year</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Director</th>
                                <th className="w-16 px-3 py-2 font-medium text-gray-700">Rating</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Genres</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Actors</th>
                              </tr>
                            </thead>
                            <tbody>
                              {message.movies.map((movie) => (
                                <tr
                                  key={movie.Id}
                                  className="border-b border-gray-100 hover:bg-gray-50"
                                >
                                  <td className="px-3 py-2 text-gray-600">{movie.Id}</td>
                                  <td className="px-3 py-2 text-gray-800 truncate" title={movie.Title}>{movie.Title}</td>
                                  <td className="px-3 py-2 text-gray-600">{movie.Year ?? "—"}</td>
                                  <td className="px-3 py-2 text-gray-600 truncate" title={movie.Director ?? ""}>{movie.Director ?? "—"}</td>
                                  <td className="px-3 py-2 text-gray-600">{movie.Rating ?? "—"}</td>
                                  <td className="px-3 py-2 text-gray-600 truncate" title={Array.isArray(movie.Genres) ? movie.Genres.join(", ") : ""}>
                                    {Array.isArray(movie.Genres) && movie.Genres.length > 0 ? movie.Genres.join(", ") : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600 truncate" title={movie.Actors?.map((a) => a.Name).join(", ")}>
                                    {movie.Actors?.length ? movie.Actors.map((a) => a.Name).join(", ") : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}

                {"actors" in message &&
                  message.actors &&
                  message.actors.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold text-gray-700">Actors</p>
                      <ul className="list-disc space-y-1 pl-5 text-gray-700">
                        {message.actors.map((actor) => (
                          <li key={actor.Id}>
                            {actor.Name} <span className="text-gray-500">(Id {actor.Id})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#3b82f6]" />
              <span>Thinking…</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div ref={messagesEndRef} />
        </div>
      </section>

      {/* Input bar */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-6xl items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask anything"
            className="min-h-[24px] flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-transparent"
            aria-label="Send"
          >
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}
