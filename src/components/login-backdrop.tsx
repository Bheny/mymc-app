"use client";

import { useEffect, useState } from "react";

// The picture behind the login card: a shepherd and his flock at dawn.
//
// It always shows the built-in animated scene (/login/scene.svg). If a film has been added at
// /login/shepherd.mp4 (and optionally shepherd.webm), that fades in over the scene and loops.
// People who've asked their device for reduced motion or data saving just get the scene, and
// nothing is downloaded that isn't needed. These files live under /login so they can be
// reached before signing in.

const MP4  = "/login/shepherd.mp4";
const WEBM = "/login/shepherd.webm";

export function LoginBackdrop() {
  const [hasVideo, setHasVideo] = useState(false);
  const [playing, setPlaying]   = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduceMotion || saveData) return;

    // Only ask for the film if it's really there — no failed downloads, no flash of an empty player
    let live = true;
    fetch(MP4, { method: "HEAD" })
      .then((r) => { if (live && r.ok && (r.headers.get("content-type") ?? "").startsWith("video")) setHasVideo(true); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden" style={{ background: "#050a1b" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/login/scene.svg" alt="" className="absolute inset-0 h-full w-full object-cover" />

      {hasVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ opacity: playing ? 1 : 0 }}
          autoPlay muted loop playsInline preload="auto"
          onCanPlay={() => setPlaying(true)}
          onError={() => { setPlaying(false); setHasVideo(false); }}
        >
          <source src={MP4} type="video/mp4" />
          <source src={WEBM} type="video/webm" />
        </video>
      )}

      {/* Keeps the card and the words on it easy to read over any picture or film */}
      <div className="absolute inset-0"
           style={{ background: "linear-gradient(180deg, rgba(5,10,27,0.4) 0%, rgba(5,10,27,0) 38%, rgba(5,10,27,0.55) 100%)" }} />
    </div>
  );
}
