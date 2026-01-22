type LastFmImage = { ["#text"]?: string; size?: string };
type LastFmTrack = {
  name?: string;
  url?: string;
  artist?: { ["#text"]?: string } | string;
  album?: { ["#text"]?: string } | string;
  image?: LastFmImage[];
  ["@attr"]?: { nowplaying?: string };
  date?: { uts?: string };
};

function pickLargestImage(images?: LastFmImage[]) {
  if (!images?.length) return undefined;
  const sorted = [...images].sort(
    (a, b) => (a["#text"]?.length ?? 0) - (b["#text"]?.length ?? 0)
  );
  const url = sorted[sorted.length - 1]?.["#text"];
  return url || undefined;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function GET() {
  const apiKey = process.env.LASTFM_API_KEY;
  const user = process.env.LASTFM_USER;

  if (!apiKey || !user) {
    return Response.json(
      { ok: false, error: "Missing LASTFM_API_KEY or LASTFM_USER." },
      { status: 500 }
    );
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", user);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "User-Agent": "samueljbaker.dev (Last.fm now-playing)" },
    });

    if (!res.ok) {
      return Response.json(
        { ok: false, error: `Last.fm HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as any;

    const track = asArray<LastFmTrack>(json?.recenttracks?.track)[0];
    if (!track?.name) {
      return Response.json({ ok: true, isPlaying: false }, { status: 200 });
    }

    const isPlaying = track?.["@attr"]?.nowplaying === "true";
    const title = track.name ?? "";
    const artist =
      typeof track.artist === "string"
        ? track.artist
        : track.artist?.["#text"] ?? "";
    const album =
      typeof track.album === "string" ? track.album : track.album?.["#text"] ?? "";
    const trackUrl = track.url ?? "";
    const imageUrl = pickLargestImage(track.image);

    return Response.json(
      {
        ok: true,
        isPlaying,
        title,
        artist,
        album,
        trackUrl,
        imageUrl,
        playedAtUts: track?.date?.uts ? Number(track.date.uts) : undefined,
      },
      { status: 200 }
    );
  } catch {
    return Response.json(
      { ok: false, error: "Failed to reach Last.fm." },
      { status: 502 }
    );
  }
}
