export interface MovieMeta {
  title: string;
  matchKey: string;
  year: number;
  poster: string | null;
  cast: string[];
  posterFit?: "cover" | "contain";
  posterPosition?: string;
  genres: string[];
  rating: number;
  duration: string;
  cert: string;
  director: string;
  synopsis: string;
  accent: [string, string, string];
  tagline: string;
}

export const MOVIES: MovieMeta[] = [
  {
    title: "The Legend of Maula Jatt",
    cast: ["Fawad Khan", "Hamza Ali Abbasi", "Mahira Khan", "Humaima Malick"],
    matchKey: "maula jatt",
    year: 2022,
    poster: "https://en.wikipedia.org/wiki/Special:FilePath/The%20Legend%20of%20Maula%20Jatt.jpeg",
    genres: ["Action", "Fantasy", "Epic"],
    rating: 8.4,
    duration: "2h 33m",
    cert: "PG-18",
    director: "Bilal Lashari",
    synopsis:
      "A fierce prizefighter with a tortured past seeks vengeance against his arch nemesis Noori Natt, the most feared warrior in the land of Punjab.",
    accent: ["#e9b356", "#8a3d1c", "#200a06"],
    tagline: "Written in soil with blood.",
  },
  {
    title: "Kamli",
    cast: ["Saba Qamar", "Sania Saeed", "Hamza Khawaja", "Nimra Bucha"],
    matchKey: "kamli",
    year: 2022,
    poster: "https://en.wikipedia.org/wiki/Special:FilePath/Kamli.jpg",
    genres: ["Drama", "Mystery", "Romance"],
    rating: 7.6,
    duration: "2h 10m",
    cert: "PG-13",
    director: "Sarmad Sultan Khoosat",
    synopsis:
      "A young married woman waiting eight years for her missing husband is rescued by a mysterious wanderer — a dilemma between desire and loyalty begins.",
    accent: ["#3ea08c", "#155146", "#071a16"],
    tagline: "Desire is a force of nature.",
  },
  {
    title: "Dune: Part Two",
    cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson", "Austin Butler"],
    matchKey: "dune",
    year: 2024,
    poster: "https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    genres: ["Sci-Fi", "Adventure", "Drama"],
    rating: 8.5,
    duration: "2h 46m",
    cert: "PG-13",
    director: "Denis Villeneuve",
    synopsis:
      "Paul Atreides unites with the Fremen to wage war against House Harkonnen, torn between the love of his life and the fate of the known universe.",
    accent: ["#e8a44c", "#8a4f2a", "#241009"],
    tagline: "Long live the fighters.",
  },
  {
    title: "Oppenheimer",
    cast: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr.", "Matt Damon"],
    matchKey: "oppenheimer",
    year: 2023,
    poster: "https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    genres: ["Drama", "History", "Thriller"],
    rating: 8.3,
    duration: "3h 00m",
    cert: "PG-18",
    director: "Christopher Nolan",
    synopsis:
      "The story of J. Robert Oppenheimer, the brilliant physicist whose Manhattan Project changed the world forever — and haunted him ever after.",
    accent: ["#ff8a5c", "#c23b22", "#2b0d0d"],
    tagline: "The world forever changes.",
  },
  {
    title: "Interstellar (IMAX Re-Release)",
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine"],
    matchKey: "interstellar",
    year: 2014,
    poster: "https://image.tmdb.org/t/p/w780/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    posterPosition: "center 35%",
    genres: ["Sci-Fi", "Adventure", "IMAX"],
    rating: 8.7,
    duration: "2h 49m",
    cert: "PG-13",
    director: "Christopher Nolan",
    synopsis:
      "As Earth becomes uninhabitable, a team of explorers travels through a wormhole in space to ensure humanity's survival among the stars.",
    accent: ["#5b8cff", "#24408f", "#050a1c"],
    tagline: "Mankind was born on Earth. It was never meant to die here.",
  },
  {
    title: "Spider-Man: Across the Spider-Verse",
    cast: ["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac", "Issa Rae"],
    matchKey: "spider",
    year: 2023,
    poster: "https://image.tmdb.org/t/p/w780/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg",
    genres: ["Animation", "Action", "Adventure"],
    rating: 8.6,
    duration: "2h 20m",
    cert: "PG",
    director: "Joaquim Dos Santos",
    synopsis:
      "Miles Morales catapults across the multiverse, where he encounters a team of Spider-People charged with protecting its very existence.",
    accent: ["#c86bff", "#7a2ff2", "#1b0b38"],
    tagline: "It's how you wear the mask that matters.",
  },
  {
    title: "Top Gun: Maverick",
    cast: ["Tom Cruise", "Miles Teller", "Jennifer Connelly", "Jon Hamm"],
    matchKey: "top gun",
    year: 2022,
    poster: "https://image.tmdb.org/t/p/w780/62HCnUTziyWcpDaBO2i1DX17ljH.jpg",
    genres: ["Action", "Drama"],
    rating: 8.2,
    duration: "2h 11m",
    cert: "PG-13",
    director: "Joseph Kosinski",
    synopsis:
      "After thirty years as a top naval aviator, Maverick returns to train a group of young pilots for a mission that demands the ultimate sacrifice.",
    accent: ["#e9b356", "#7a4a1c", "#140b04"],
    tagline: "Feel the need.",
  },
  {
    title: "The Dark Knight",
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Gary Oldman"],
    matchKey: "dark knight",
    year: 2008,
    poster: "https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    genres: ["Action", "Crime", "Drama"],
    rating: 9.0,
    duration: "2h 32m",
    cert: "PG-13",
    director: "Christopher Nolan",
    synopsis:
      "Batman faces the Joker, a criminal mastermind who pushes Gotham into chaos and forces the hero to test where justice ends and revenge begins.",
    accent: ["#5b8cff", "#1c2a4a", "#05080f"],
    tagline: "Why so serious?",
  },
  {
    title: "Inception",
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy"],
    matchKey: "inception",
    year: 2010,
    poster: "https://image.tmdb.org/t/p/w780/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    genres: ["Sci-Fi", "Action", "Thriller"],
    rating: 8.8,
    duration: "2h 28m",
    cert: "PG-13",
    director: "Christopher Nolan",
    synopsis:
      "A thief who steals secrets from dreams is offered one last job: plant an idea in a target's mind, deep inside layers of shared dreams.",
    accent: ["#8fb3c9", "#2d4656", "#080f14"],
    tagline: "Your mind is the scene of the crime.",
  },
  {
    title: "Avatar: The Way of Water",
    cast: ["Sam Worthington", "Zoe Saldaña", "Sigourney Weaver", "Kate Winslet"],
    matchKey: "avatar",
    year: 2022,
    poster: "https://image.tmdb.org/t/p/w780/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
    genres: ["Sci-Fi", "Adventure", "IMAX"],
    rating: 7.6,
    duration: "3h 12m",
    cert: "PG-13",
    director: "James Cameron",
    synopsis:
      "Jake Sully and Neytiri build a family on Pandora, until an old threat returns and forces them to seek refuge with the ocean clans.",
    accent: ["#3ec7e0", "#135a72", "#03141a"],
    tagline: "Return to Pandora.",
  },
  {
    title: "Joker",
    cast: ["Joaquin Phoenix", "Robert De Niro", "Zazie Beetz", "Frances Conroy"],
    matchKey: "joker",
    year: 2019,
    poster: "https://image.tmdb.org/t/p/w780/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",
    genres: ["Crime", "Drama", "Thriller"],
    rating: 8.4,
    duration: "2h 02m",
    cert: "PG-18",
    director: "Todd Phillips",
    synopsis:
      "Failed comedian Arthur Fleck, ignored by a city that has turned its back on him, slowly descends into madness and becomes the Joker.",
    accent: ["#e0703e", "#6a2a14", "#140805"],
    tagline: "Put on a happy face.",
  },
  {
    title: "Parasite",
    cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong", "Choi Woo-shik"],
    matchKey: "parasite",
    year: 2019,
    poster: "https://image.tmdb.org/t/p/w780/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    genres: ["Thriller", "Drama", "Comedy"],
    rating: 8.5,
    duration: "2h 12m",
    cert: "PG-18",
    director: "Bong Joon-ho",
    synopsis:
      "A poor family schemes its way into working for a wealthy household, until an unexpected discovery turns the arrangement upside down.",
    accent: ["#7fbf6a", "#2e5224", "#081306"],
    tagline: "Act like you own the place.",
  },
];

const FALLBACK_ACCENTS: [string, string, string][] = [
  ["#5b8cff", "#24408f", "#080d1e"],
  ["#e9b356", "#8a5a1c", "#1a1206"],
  ["#c86bff", "#7a2ff2", "#12061f"],
  ["#3ea08c", "#155146", "#071a16"],
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Fuzzy-match a backend movie title to rich metadata. Always returns a meta. */
export function getMovieMeta(rawTitle: string): MovieMeta {
  const t = rawTitle.toLowerCase();
  const direct = MOVIES.find((m) => rawTitle === m.title);
  if (direct) return direct;
  const fuzzy = MOVIES.find((m) => t.includes(m.matchKey) || m.matchKey.includes(t.split("(")[0].trim()));
  if (fuzzy) return fuzzy;
  const accent = FALLBACK_ACCENTS[hashString(rawTitle) % FALLBACK_ACCENTS.length];
  return {
    title: rawTitle,
    cast: [],
    matchKey: rawTitle,
    year: new Date().getFullYear(),
    poster: null,
    genres: ["Feature Film"],
    rating: 7.5,
    duration: "2h 15m",
    cert: "PG-13",
    director: "—",
    synopsis: "A cinematic experience worth every second.",
    accent,
    tagline: "Now showing on the big screen.",
  };
}

/** Deterministic short id for a movie title (used for stable keys/gradients) */
export function movieSlug(rawTitle: string): string {
  return getMovieMeta(rawTitle).matchKey.replace(/[^a-z]+/g, "-");
}
