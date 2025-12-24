// app.js
// MultiView – multi-provider embed workspace with smooth drag/resize
"use strict";

// ==========================
// DOM References
// ==========================
const workspace = document.getElementById("workspace");
const welcome = document.getElementById("welcome");

const sidebar = document.getElementById("sidebar");
const sidebarTab = document.getElementById("sidebar-tab");
const urlInput = document.getElementById("urlInput");
const embedInput = document.getElementById("embedInput");
const addUrlBtn = document.getElementById("addUrlBtn");
const addEmbedBtn = document.getElementById("addEmbedBtn");

const sidebarBackdrop = document.getElementById("sidebar-backdrop");

const TWITCH_PARENT_DOMAIN = "multiviewplayer.pages.dev";

let zCounter = 10;
let activeAction = null;
let rafId = null;

const winHooks = new WeakMap();
const resizeTimers = new WeakMap();
const winMeta = new WeakMap();

// ==========================
// Utility Functions
// ==========================
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeParseURL(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function normalizeHost(hostname) {
  return (hostname || "").replace(/^(www\.|m\.|mobile\.)/gi, "").toLowerCase();
}

function getPathParts(urlObj) {
  return urlObj.pathname.split("/").filter(Boolean);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function extractSiteName(url) {
  const urlObj = safeParseURL(url);
  if (!urlObj) return "Unknown";
  
  const host = normalizeHost(urlObj.hostname);
  const parts = host.split(".");
  
  const mainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return capitalize(mainPart);
}

// ==========================
// Enhanced Provider Detection
// ==========================

function getDisplayTitle(provider, url) {
  const providerNames = {
    "youtube": "YouTube",
    "twitch-live": "Twitch",
    "twitch-vod": "Twitch",
    "twitch-clip": "Twitch",
    "twitch": "Twitch",
    "kick": "Kick",
    "vimeo": "Vimeo",
    "twitter": "X",
    "facebook": "Facebook",
    "rumble": "Rumble",
    "dailymotion": "Dailymotion",
    "spotify": "Spotify",
    "soundcloud": "SoundCloud",
    "streamable": "Streamable",
    "tiktok": "TikTok",
    "instagram": "Instagram",
    "reddit": "Reddit",
    "pinterest": "Pinterest",
    "giphy": "Giphy",
    "imgur": "Imgur",
    "coub": "Coub",
    "bandcamp": "Bandcamp",
    "mixcloud": "Mixcloud",
    "codepen": "CodePen",
    "jsfiddle": "JSFiddle",
    "loom": "Loom",
    "wistia": "Wistia",
    "vidyard": "Vidyard",
    "bitchute": "BitChute",
    "odysee": "Odysee",
    "peertube": "PeerTube",
    "bilibili": "Bilibili",
    "nicovideo": "Niconico",
    "googledrive": "Google Drive",
    "googlemaps": "Google Maps",
    "gfycat": "Gfycat",
    "tenor": "Tenor",
    "flickr": "Flickr",
    "ted": "TED",
    "vevo": "Vevo",
    "twitch-chat": "Twitch Chat",
    "discord": "Discord",
    "github-gist": "GitHub Gist",
    "replit": "Replit",
    "glitch": "Glitch",
    "figma": "Figma",
    "canva": "Canva",
    "miro": "Miro",
    "notion": "Notion",
    "airtable": "Airtable",
    "typeform": "Typeform",
    "google-forms": "Google Forms",
    "google-docs": "Google Docs",
    "google-sheets": "Google Sheets",
    "google-slides": "Google Slides",
    "dropbox": "Dropbox",
    "box": "Box",
    "onedrive": "OneDrive",
    "slideshare": "SlideShare",
    "prezi": "Prezi",
    "padlet": "Padlet",
    "trello": "Trello",
    "calendly": "Calendly",
    "eventbrite": "Eventbrite",
    "meetup": "Meetup",
    "medium": "Medium",
    "substack": "Substack",
    "threads": "Threads",
    "bluesky": "Bluesky",
    "mastodon": "Mastodon",
    "tumblr": "Tumblr",
    "linkedin": "LinkedIn",
    "tidal": "TIDAL",
    "deezer": "Deezer",
    "audiomack": "Audiomack",
    "clyp": "Clyp",
    "vocaroo": "Vocaroo",
    "anchor": "Anchor",
    "simplecast": "Simplecast",
    "libsyn": "Libsyn",
    "buzzsprout": "Buzzsprout",
    "transistor": "Transistor",
    "megaphone": "Megaphone",
    "spreaker": "Spreaker",
    "stitcher": "Stitcher",
    "iheart": "iHeartRadio",
    "generic": null
  };

  if (provider && providerNames[provider]) {
    return providerNames[provider];
  }

  // If url looks like HTML (embed code), try to extract from iframe src
  if (url && url.includes("<")) {
    const temp = document.createElement("div");
    temp.innerHTML = url;
    const iframe = temp.querySelector("iframe");
    if (iframe) {
      const src = iframe.getAttribute("src") || "";
      if (src) {
        return extractSiteName(src);
      }
    }
    // Try to find any recognizable URL in the embed
    const match = url.match(/https?:\/\/([^"'\s<>]+)/i);
    if (match) {
      return extractSiteName("https://" + match[1]);
    }
    return "Embed";
  }

  return extractSiteName(url);
}

// ==========================
// Sidebar Helpers
// ==========================
function openSidebar() {
  document.body.classList.add("sidebar-open");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

sidebarTab?.addEventListener("click", toggleSidebar);

document.addEventListener("keydown", (e) => {
  if (e.key === "Shift" && !e.repeat) {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    toggleSidebar();
  }
});

sidebarBackdrop?.addEventListener("click", () => {
  document.body.classList.remove("sidebar-open");
});

// ==========================
// Smart Paste & Controls
// ==========================
addUrlBtn?.addEventListener("click", () => {
  const raw = urlInput.value.trim();
  if (!raw) return;
  createVideoFromUrl(raw);
  urlInput.value = "";
  closeSidebar();
});

urlInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const raw = urlInput.value.trim();
    if (!raw) return;
    createVideoFromUrl(raw);
    urlInput.value = "";
    closeSidebar();
  }
});

urlInput?.addEventListener("paste", (e) => {
  const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const value = pasted.trim();
  if (!value) return;

  if (!urlInput.value.trim()) {
    e.preventDefault();
    createVideoFromUrl(value);
    urlInput.value = "";
    closeSidebar();
  }
});

addEmbedBtn?.addEventListener("click", () => {
  const raw = embedInput.value.trim();
  if (!raw) return;
  createVideoFromEmbed(raw);
  embedInput.value = "";
  closeSidebar();
});

embedInput?.addEventListener("paste", (e) => {
  const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const value = pasted.trim();
  if (!value) return;

  if (!embedInput.value.trim()) {
    e.preventDefault();
    createVideoFromEmbed(value);
    embedInput.value = "";
    closeSidebar();
  }
});

// ==========================
// Iframe Creation Helper
// ==========================
function createIframeEl({ src, title, allow, referrerPolicy, scrollable = false }) {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("title", title || "Embedded media");
  iframe.setAttribute(
    "allow",
    allow || "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  );
  iframe.setAttribute("referrerpolicy", referrerPolicy || "strict-origin-when-cross-origin");

  // Style overrides for global top-alignment
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.display = "block";
  iframe.style.verticalAlign = "top"; // Ensures no baseline gaps at the top
  
  // Control scrolling based on content type
  iframe.scrolling = scrollable ? "auto" : "no";

  return iframe;
}
// ==========================
// YouTube Provider
// ==========================
function extractYouTubeId(urlObj) {
  const host = normalizeHost(urlObj.hostname);
  const parts = getPathParts(urlObj);

  if (host === "youtu.be") return parts[0] || "";

  const v = urlObj.searchParams.get("v");
  if (v) return v;

  const first = parts[0];
  const second = parts[1];
  if (["shorts", "embed", "live"].includes(first) && second) return second;

  if (first && /^[A-Za-z0-9_-]{6,}$/.test(first)) return first;
  return "";
}

// ==========================
// Twitch Provider
// ==========================
function buildTwitchParams() {
  return `parent=${encodeURIComponent(TWITCH_PARENT_DOMAIN)}`;
}

// ==========================
// Twitter/X Provider
// ==========================
function extractTweetId(urlObj) {
  const parts = getPathParts(urlObj);

  for (let i = 0; i < parts.length; i++) {
    const seg = (parts[i] || "").toLowerCase();
    if ((seg === "status" || seg === "statuses") && parts[i + 1]) {
      const candidate = (parts[i + 1] || "").split(/[?#]/)[0];
      if (/^\d{10,}$/.test(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function buildTwitterEmbedSrc(tweetId) {
  const params = new URLSearchParams({
    id: tweetId,
    theme: "dark",
    dnt: "true",
    cards: "hidden",
    conversation: "none",
    align: "center"
  });
  return `https://platform.twitter.com/embed/Tweet.html?${params.toString()}`;
}

// ==========================
// Facebook Provider
// ==========================
function buildFacebookPluginSrc({ href, width }) {
  const w = Math.round(clamp(width || 500, 220, 1920));
  const h = Math.round(w / (16 / 9));

  const u = new URL("https://www.facebook.com/plugins/video.php");
  u.searchParams.set("href", href);
  u.searchParams.set("show_text", "false");
  u.searchParams.set("width", String(w));
  u.searchParams.set("height", String(h));
  return u.toString();
}

function getFacebookHrefFromPluginSrc(src) {
  try {
    const u = new URL(src);
    if (!normalizeHost(u.hostname).includes("facebook.com")) return "";
    if (!u.pathname.includes("/plugins/video.php")) return "";
    return u.searchParams.get("href") || "";
  } catch {
    return "";
  }
}

function updateFacebookIframe(iframe, href, contentEl) {
  if (!iframe || !href || !contentEl) return;

  const boxWidth = contentEl.clientWidth || contentEl.getBoundingClientRect().width || 500;
  const w = Math.round(clamp(boxWidth, 220, 1920));
  const h = Math.round(w / (16 / 9));

  iframe.setAttribute("width", String(w));
  iframe.setAttribute("height", String(h));

  let currentW = 0;
  try {
    if (iframe.src && iframe.src !== "about:blank") {
      const cur = new URL(iframe.src);
      currentW = parseInt(cur.searchParams.get("width") || "0", 10) || 0;
    }
  } catch {
    currentW = 0;
  }

  if (Math.abs(currentW - w) >= 30 || !iframe.src || iframe.src === "about:blank") {
    iframe.src = buildFacebookPluginSrc({ href, width: w });
  }
}

function scheduleFacebookUpdate(win, iframe, href) {
  const existingTimer = resizeTimers.get(win);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    const contentEl = getContentElForWin(win);
    if (contentEl) {
      updateFacebookIframe(iframe, href, contentEl);
    }
    resizeTimers.delete(win);
  }, 200);

  resizeTimers.set(win, timer);
}

// ==========================
// Embed Provider Detection from src
// ==========================

function detectProviderFromSrc(src) {
  if (!src) return { provider: "generic", aspect: 16 / 9 };
  
  const srcLower = src.toLowerCase();
  
  // Video Platforms
  if (srcLower.includes("youtube.com/embed") || 
      srcLower.includes("youtube-nocookie.com/embed") ||
      srcLower.includes("youtube.com/v/")) {
    return { provider: "youtube", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("player.twitch.tv") || 
      srcLower.includes("clips.twitch.tv/embed")) {
    return { provider: "twitch", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("player.vimeo.com")) {
    return { provider: "vimeo", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("dailymotion.com/embed") ||
      srcLower.includes("geo.dailymotion.com/player")) {
    return { provider: "dailymotion", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("rumble.com/embed")) {
    return { provider: "rumble", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("streamable.com/e/") ||
      srcLower.includes("streamable.com/o/") ||
      srcLower.includes("streamable.com/s/")) {
    return { provider: "streamable", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("bitchute.com/embed")) {
    return { provider: "bitchute", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("odysee.com/$/embed")) {
    return { provider: "odysee", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("/videos/embed/") || srcLower.includes("peertube")) {
    return { provider: "peertube", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("player.bilibili.com")) {
    return { provider: "bilibili", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("embed.nicovideo.jp") || srcLower.includes("nicovideo.jp/watch")) {
    return { provider: "nicovideo", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("player.kick.com")) {
    return { provider: "kick", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("loom.com/embed") || srcLower.includes("loom.com/share")) {
    return { provider: "loom", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("wistia.com") || srcLower.includes("wistia.net") || srcLower.includes("wi.st")) {
    return { provider: "wistia", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("vidyard.com") || srcLower.includes("play.vidyard.com")) {
    return { provider: "vidyard", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("vevo.com")) {
    return { provider: "vevo", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("ted.com/talks") || srcLower.includes("embed.ted.com")) {
    return { provider: "ted", aspect: 16 / 9 };
  }
  
  // Music/Audio Platforms
  if (srcLower.includes("open.spotify.com/embed")) {
    if (srcLower.includes("/track/")) {
      return { provider: "spotify", aspect: 352 / 152 };
    }
    if (srcLower.includes("/episode/")) {
      return { provider: "spotify", aspect: 352 / 232 };
    }
    if (srcLower.includes("/playlist/") || srcLower.includes("/album/")) {
      return { provider: "spotify", aspect: 352 / 380 };
    }
    if (srcLower.includes("/show/")) {
      return { provider: "spotify", aspect: 352 / 232 };
    }
    return { provider: "spotify", aspect: 352 / 352 };
  }
  
  if (srcLower.includes("soundcloud.com/player") ||
      srcLower.includes("w.soundcloud.com") ||
      srcLower.includes("api.soundcloud.com")) {
    const isVisual = srcLower.includes("visual=true");
    return { provider: "soundcloud", aspect: isVisual ? 16 / 9 : 16 / 4 };
  }
  
  if (srcLower.includes("bandcamp.com/EmbeddedPlayer")) {
    if (srcLower.includes("/album=")) {
      return { provider: "bandcamp", aspect: 350 / 470 };
    }
    if (srcLower.includes("/track=")) {
      return { provider: "bandcamp", aspect: 350 / 442 };
    }
    return { provider: "bandcamp", aspect: 1 };
  }
  
  if (srcLower.includes("mixcloud.com/widget")) {
    return { provider: "mixcloud", aspect: 16 / 4 };
  }
  
  if (srcLower.includes("embed.tidal.com")) {
    return { provider: "tidal", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("widget.deezer.com")) {
    return { provider: "deezer", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("audiomack.com/embed")) {
    return { provider: "audiomack", aspect: 16 / 5 };
  }
  
  if (srcLower.includes("clyp.it")) {
    return { provider: "clyp", aspect: 16 / 4 };
  }
  
  if (srcLower.includes("vocaroo.com/embed")) {
    return { provider: "vocaroo", aspect: 16 / 3 };
  }
  
  if (srcLower.includes("anchor.fm") && srcLower.includes("embed")) {
    return { provider: "anchor", aspect: 16 / 5 };
  }
  
  // Podcast platforms
  if (srcLower.includes("player.simplecast.com")) {
    return { provider: "simplecast", aspect: 16 / 5 };
  }
  
  if (srcLower.includes("html5-player.libsyn.com")) {
    return { provider: "libsyn", aspect: 16 / 4 };
  }
  
  if (srcLower.includes("buzzsprout.com") && srcLower.includes("player")) {
    return { provider: "buzzsprout", aspect: 16 / 4 };
  }
  
  if (srcLower.includes("share.transistor.fm")) {
    return { provider: "transistor", aspect: 16 / 5 };
  }
  
  if (srcLower.includes("player.megaphone.fm")) {
    return { provider: "megaphone", aspect: 16 / 4 };
  }
  
  if (srcLower.includes("widget.spreaker.com")) {
    return { provider: "spreaker", aspect: 16 / 5 };
  }
  
  // Social Media Platforms
  if (srcLower.includes("tiktok.com/embed") || srcLower.includes("tiktok.com/player")) {
    return { provider: "tiktok", aspect: 9 / 16, scrollable: true };
  }
  
  if (srcLower.includes("instagram.com") && (srcLower.includes("/embed") || srcLower.includes("/p/"))) {
    return { provider: "instagram", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("facebook.com/plugins/video")) {
    return { provider: "facebook", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("facebook.com/plugins/post")) {
    return { provider: "facebook", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("redditmedia.com") ||
      (srcLower.includes("reddit.com") && srcLower.includes("embed"))) {
    return { provider: "reddit", aspect: 4 / 3, scrollable: true };
  }
  
  if (srcLower.includes("platform.twitter.com") || srcLower.includes("twitframe.com")) {
    return { provider: "twitter", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("tumblr.com/post")) {
    return { provider: "tumblr", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("linkedin.com/embed") || srcLower.includes("linkedin.com/post")) {
    return { provider: "linkedin", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("threads.net") && srcLower.includes("embed")) {
    return { provider: "threads", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("bsky.app") || srcLower.includes("embed.bsky")) {
    return { provider: "bluesky", aspect: 4 / 5, scrollable: true };
  }
  
  // Mastodon (various instances)
  if (srcLower.includes("/embed") && (
      srcLower.includes("mastodon") || 
      srcLower.includes("mstdn") ||
      srcLower.includes("fosstodon") ||
      srcLower.includes("hachyderm") ||
      srcLower.includes("infosec.exchange")
  )) {
    return { provider: "mastodon", aspect: 4 / 5, scrollable: true };
  }
  
  // Image/GIF Platforms
// Check for the specific embed assets or the general domain
const isPinterestEmbed = srcLower.includes("assets.pinterest.com/ext/embed.html");
const isGeneralPinterest = srcLower.includes("pinterest.com") && srcLower.includes("embed");

if (isPinterestEmbed || isGeneralPinterest) {
  return { 
    provider: "pinterest", 
    // The specific URL you gave has a fixed height/width 
    // 236/439 is roughly 0.537, which is close to 9:16 or 2:3
    aspect: 236 / 439, 
    scrollable: false // Embeds are usually fixed size
  };
}
  if (srcLower.includes("giphy.com/embed")) {
    return { provider: "giphy", aspect: 1 };
  }
  
  if (srcLower.includes("imgur.com") && (srcLower.includes("embed") || srcLower.includes("/a/"))) {
    return { provider: "imgur", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("gfycat.com/ifr")) {
    return { provider: "gfycat", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("tenor.com/embed")) {
    return { provider: "tenor", aspect: 1 };
  }
  
  if (srcLower.includes("flickr.com/photos") && srcLower.includes("player")) {
    return { provider: "flickr", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("coub.com/embed")) {
    return { provider: "coub", aspect: 16 / 9 };
  }
  
  // Code/Development Platforms
  if (srcLower.includes("codepen.io") && srcLower.includes("embed")) {
    return { provider: "codepen", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("jsfiddle.net") && srcLower.includes("embedded")) {
    return { provider: "jsfiddle", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("gist.github.com")) {
    return { provider: "github-gist", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("replit.com") && srcLower.includes("embed")) {
    return { provider: "replit", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("glitch.com/embed")) {
    return { provider: "glitch", aspect: 16 / 9, scrollable: true };
  }
  
  // Design/Collaboration Platforms
  if (srcLower.includes("figma.com/embed") || srcLower.includes("figma.com/file")) {
    return { provider: "figma", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("canva.com/design") && srcLower.includes("embed")) {
    return { provider: "canva", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("miro.com/app/embed") || srcLower.includes("miro.com/app/board")) {
    return { provider: "miro", aspect: 16 / 9, scrollable: true };
  }
  
  // Productivity/Forms Platforms
  if (srcLower.includes("notion.so") || srcLower.includes("notion.site")) {
    return { provider: "notion", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("airtable.com/embed")) {
    return { provider: "airtable", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("typeform.com/to")) {
    return { provider: "typeform", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("docs.google.com/forms")) {
    return { provider: "google-forms", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("docs.google.com/document")) {
    return { provider: "google-docs", aspect: 8.5 / 11, scrollable: true };
  }
  
  if (srcLower.includes("docs.google.com/spreadsheets")) {
    return { provider: "google-sheets", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("docs.google.com/presentation")) {
    return { provider: "google-slides", aspect: 16 / 9 };
  }
  
  // Presentation Platforms
  if (srcLower.includes("slideshare.net") && srcLower.includes("embed")) {
    return { provider: "slideshare", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("prezi.com/embed") || srcLower.includes("prezi.com/view")) {
    return { provider: "prezi", aspect: 16 / 9 };
  }
  
  // Cloud Storage/Preview
  if (srcLower.includes("drive.google.com") && srcLower.includes("preview")) {
    return { provider: "googledrive", aspect: 16 / 9 };
  }
  
  if (srcLower.includes("dropbox.com") && srcLower.includes("embed")) {
    return { provider: "dropbox", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("onedrive.live.com/embed")) {
    return { provider: "onedrive", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("app.box.com/embed")) {
    return { provider: "box", aspect: 16 / 9, scrollable: true };
  }
  
  // Maps
  if (srcLower.includes("google.com/maps") || srcLower.includes("maps.google.com")) {
    return { provider: "googlemaps", aspect: 4 / 3, scrollable: true };
  }
  
  // Chat/Community
  if (srcLower.includes("discord.com/widget") || srcLower.includes("discordapp.com/widget")) {
    return { provider: "discord", aspect: 350 / 500, scrollable: true };
  }
  
  if (srcLower.includes("twitch.tv") && srcLower.includes("chat")) {
    return { provider: "twitch-chat", aspect: 350 / 500, scrollable: true };
  }
  
  // Event Platforms
  if (srcLower.includes("calendly.com")) {
    return { provider: "calendly", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("eventbrite.com") && srcLower.includes("widget")) {
    return { provider: "eventbrite", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("meetup.com") && srcLower.includes("widget")) {
    return { provider: "meetup", aspect: 16 / 9, scrollable: true };
  }
  
  // Educational/Project Management
  if (srcLower.includes("padlet.com/embed")) {
    return { provider: "padlet", aspect: 16 / 9, scrollable: true };
  }
  
  if (srcLower.includes("trello.com") && srcLower.includes("embed")) {
    return { provider: "trello", aspect: 16 / 9, scrollable: true };
  }
  
  // Publishing Platforms
  if (srcLower.includes("medium.com") && srcLower.includes("embed")) {
    return { provider: "medium", aspect: 4 / 5, scrollable: true };
  }
  
  if (srcLower.includes("substack.com") && srcLower.includes("embed")) {
    return { provider: "substack", aspect: 4 / 5, scrollable: true };
  }

  return { provider: "generic", aspect: 16 / 9 };
}

// ==========================
// Provider Spec Builder
// ==========================
function buildEmbedSpecFromUrl(urlObj, raw) {
  const fallback = {
    provider: "generic",
    url: raw,
    aspect: 16 / 9,
    scrollable: true,
    mount(contentEl) {
      const iframe = createIframeEl({
        src: raw,
        title: "Embedded page",
        scrollable: true
      });
      contentEl.appendChild(iframe);
    },
  };

  if (!urlObj) return fallback;

  const host = normalizeHost(urlObj.hostname);
  const parts = getPathParts(urlObj);
  const full = urlObj.toString();

  // ===== YouTube =====
  if (host.includes("youtube.com") || host === "youtu.be") {
    const id = extractYouTubeId(urlObj);
    if (!id) return fallback;

    const src = new URL(`https://www.youtube.com/embed/${id}`);
    src.searchParams.set("rel", "0");
    src.searchParams.set("modestbranding", "1");

    return {
      provider: "youtube",
      url: raw,
      aspect: 16 / 9,
      scrollable: false,
      mount(contentEl) {
        const iframe = createIframeEl({
          src: src.toString(),
          title: "YouTube video",
          scrollable: false
        });
        contentEl.appendChild(iframe);
      },
    };
  }

  // ===== Twitch =====
  if (host === "twitch.tv" || host.endsWith(".twitch.tv") || host === "clips.twitch.tv") {
    const twitchParams = buildTwitchParams();

    if (host === "clips.twitch.tv") {
      const slug = parts[0] || "";
      if (!slug) return fallback;
      const src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&${twitchParams}`;
      return {
        provider: "twitch-clip",
        url: raw,
        aspect: 16 / 9,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({ src, title: "Twitch clip", scrollable: false });
          contentEl.appendChild(iframe);
        },
      };
    }

    if (parts[0] === "clip" && parts[1]) {
      const slug = parts[1];
      const src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&${twitchParams}`;
      return {
        provider: "twitch-clip",
        url: raw,
        aspect: 16 / 9,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({ src, title: "Twitch clip", scrollable: false });
          contentEl.appendChild(iframe);
        },
      };
    }

    const clipParam = urlObj.searchParams.get("clip");
    if (clipParam) {
      const src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clipParam)}&${twitchParams}`;
      return {
        provider: "twitch-clip",
        url: raw,
        aspect: 16 / 9,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({ src, title: "Twitch clip", scrollable: false });
          contentEl.appendChild(iframe);
        },
      };
    }

    if (parts[0] === "videos" && parts[1]) {
      const videoId = parts[1];
      const src = `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&${twitchParams}`;
      return {
        provider: "twitch-vod",
        url: raw,
        aspect: 16 / 9,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({ src, title: "Twitch VOD", scrollable: false });
          contentEl.appendChild(iframe);
        },
      };
    }

    const channel = parts[0] || "";
    if (channel) {
      const src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${twitchParams}`;
      return {
        provider: "twitch-live",
        url: raw,
        aspect: 16 / 9,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({ src, title: "Twitch stream", scrollable: false });
          contentEl.appendChild(iframe);
        },
      };
    }

    return fallback;
  }

  // ===== Kick =====
  if (host === "kick.com" || host.includes("kick.com")) {
    const channel = parts[0] || "";
    if (!channel) return fallback;
    const src = `https://player.kick.com/${encodeURIComponent(channel)}`;
    return {
      provider: "kick",
      url: raw,
      aspect: 16 / 9,
      scrollable: false,
      mount(contentEl) {
        const iframe = createIframeEl({ src, title: "Kick stream", scrollable: false });
        contentEl.appendChild(iframe);
      },
    };
  }

  // ===== Vimeo =====
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    if (host === "player.vimeo.com") {
      return {
        provider: "vimeo",
        url: raw,
        aspect: 16 / 9,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({ src: full, title: "Vimeo video", scrollable: false });
          contentEl.appendChild(iframe);
        },
      };
    }

    const id = parts[0];
    if (id && /^\d+$/.test(id)) {
      const src = `https://player.vimeo.com/video/${id}`;
      return {
        provider: "vimeo",
        url: raw,
        aspect: 16 / 9,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({ src, title: "Vimeo video", scrollable: false });
          contentEl.appendChild(iframe);
        },
      };
    }
    return fallback;
  }

  // ===== Twitter/X =====
  if (host === "twitter.com" || host === "x.com") {
    const tweetId = extractTweetId(urlObj);

    if (tweetId) {
      return {
        provider: "twitter",
        url: raw,
        aspect: 4 / 5,
        scrollable: false,
        mount(contentEl) {
          const iframe = createIframeEl({
            src: buildTwitterEmbedSrc(tweetId),
            title: "Tweet",
            scrollable: false
          });
          iframe.style.overflow = "hidden";
          iframe.style.backgroundColor = "#15202b";
          contentEl.appendChild(iframe);
        },
      };
    }

    const src = `https://twitframe.com/show?url=${encodeURIComponent(full)}`;
    return {
      provider: "twitter",
      url: raw,
      aspect: 4 / 5,
      scrollable: false,
      mount(contentEl) {
        const iframe = createIframeEl({ src, title: "Twitter content", scrollable: false });
        iframe.style.backgroundColor = "#15202b";
        contentEl.appendChild(iframe);
      },
    };
  }

  // ===== Facebook =====
  if (host.includes("facebook.com") || host === "fb.watch") {
    const href = full;

    return {
      provider: "facebook",
      url: raw,
      aspect: 16 / 9,
      scrollable: false,
      mount(contentEl, win) {
        const iframe = createIframeEl({
          src: "about:blank",
          title: "Facebook video",
          allow: "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share",
          scrollable: false
        });

        iframe.dataset.fbHref = href;
        iframe.style.backgroundColor = "#000";
        contentEl.appendChild(iframe);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            updateFacebookIframe(iframe, href, contentEl);
          });
        });

        registerWindowHook(win, {
          onResizeEnd: () => {
            scheduleFacebookUpdate(win, iframe, href);
          },
          getContentEl: () => win.querySelector(".video-content"),
        });
      },
    };
  }

  // ===== Rumble =====
  if (host.includes("rumble.com")) {
    alert("Rumble requires their official embed iframe. Paste the Rumble embed code into the Embed box.");
    return null;
  }

  return fallback;
}

// ==========================
// Window Hooks Management
// ==========================
function registerWindowHook(win, hooks) {
  if (!win) return;
  const prev = winHooks.get(win) || {};
  winHooks.set(win, { ...prev, ...hooks });
}

function getContentElForWin(win) {
  const meta = winHooks.get(win);
  if (meta?.getContentEl) return meta.getContentEl();
  return win?.querySelector?.(".video-content") || null;
}

function triggerResizeEnd(win) {
  const meta = winHooks.get(win);
  if (meta?.onResizeEnd) {
    try {
      meta.onResizeEnd();
    } catch {
      // ignore
    }
  }
}

// ==========================
// Refresh Window Content
// ==========================
function refreshWindow(win) {
  const content = win.querySelector(".video-content");
  if (!content) return;

  const iframe = content.querySelector("iframe");
  if (iframe) {
    const currentSrc = iframe.src;
    iframe.src = "";
    requestAnimationFrame(() => {
      iframe.src = currentSrc;
    });
  }

  const video = content.querySelector("video");
  if (video) {
    video.load();
  }
}

// ==========================
// Copy URL/Embed to Clipboard (with temporary ✓ icon)
// ==========================
function copyWindowUrl(win) {
  const meta = winMeta.get(win);
  if (!meta?.url) return;

  const textToCopy = meta.url;
  const isEmbed = textToCopy.includes("<");
  const copyBtn = win.querySelector(".copy-btn");
  if (!copyBtn) return;

  const COPY_ICON = "⧉";  // normal copy icon
  const CHECK_ICON = "✓"; // shown briefly after copy

  function showCopiedState() {
    copyBtn.innerHTML = CHECK_ICON;
    copyBtn.title = isEmbed ? "Embed copied!" : "URL copied!";

    if (copyBtn._resetTimeout) {
      clearTimeout(copyBtn._resetTimeout);
    }

    copyBtn._resetTimeout = setTimeout(() => {
      copyBtn.innerHTML = COPY_ICON;
      copyBtn.title = isEmbed ? "Copy embed" : "Copy URL";
      copyBtn._resetTimeout = null;
    }, 1000);
  }

  // Modern API
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(textToCopy)
      .then(showCopiedState)
      .catch(() => fallbackCopy());
  } else {
    fallbackCopy();
  }

  // Fallback for older browsers
  function fallbackCopy() {
    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showCopiedState();
    } catch (e) {
      console.error("Copy failed:", e);
    }
    document.body.removeChild(textarea);
  }
} 

// ==========================
// Embed Blockquote Processing
// ==========================

function extractFirstMatchingLink(root, predicate) {
  const links = root.querySelectorAll("a[href]");
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    if (predicate(href)) return href;
  }
  return "";
}

function processBlockquoteEmbed(temp) {
  // Twitter/X - multiple formats
  const twitterBlock = temp.querySelector(
    'blockquote.twitter-tweet, blockquote.twitter-video, ' +
    'blockquote[class*="twitter"], [data-tweet-id], ' +
    'div.twitter-tweet'
  );
  if (twitterBlock) {
    const tweetUrl = extractFirstMatchingLink(temp, (u) => 
      /https?:\/\/(x\.com|twitter\.com)\/\w+\/(status|statuses)\/\d+/i.test(u)
    );
    if (tweetUrl) {
      return { type: "url", url: tweetUrl };
    }
  }

  // Instagram - multiple formats
  const instagramBlock = temp.querySelector(
    'blockquote.instagram-media, blockquote[data-instgrm-permalink], ' +
    'blockquote[data-instgrm-captioned], [class*="instagram-embed"], ' +
    'div.instagram-media'
  );
  if (instagramBlock) {
    const instaUrl = instagramBlock.getAttribute("data-instgrm-permalink") ||
                     instagramBlock.getAttribute("data-instgrm-captioned") ||
                     extractFirstMatchingLink(temp, (u) => 
                       /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/[\w-]+/i.test(u)
                     );
    if (instaUrl) {
      return { type: "url", url: instaUrl };
    }
  }

  // TikTok
  const tiktokBlock = temp.querySelector(
    'blockquote.tiktok-embed, blockquote[cite*="tiktok.com"], ' +
    '[data-video-id][class*="tiktok"], div.tiktok-embed'
  );
  if (tiktokBlock) {
    const tiktokUrl = tiktokBlock.getAttribute("cite") ||
                      tiktokBlock.getAttribute("data-video-url") ||
                      extractFirstMatchingLink(temp, (u) =>
                        /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//i.test(u)
                      );
    if (tiktokUrl) {
      return { type: "url", url: tiktokUrl };
    }
  }

  // Reddit
  const redditBlock = temp.querySelector(
    'blockquote.reddit-embed-bq, blockquote[class*="reddit"], ' +
    '[data-embed-created], div.reddit-embed'
  );
  if (redditBlock) {
    const redditUrl = extractFirstMatchingLink(temp, (u) =>
      /https?:\/\/(www\.|old\.|new\.)?reddit\.com\/(r\/|user\/)/i.test(u)
    );
    if (redditUrl) {
      return { type: "url", url: redditUrl };
    }
  }

  // Threads (Meta)
  const threadsBlock = temp.querySelector(
    'blockquote.text-post-media, blockquote[cite*="threads.net"], ' +
    'blockquote[data-threads-permalink]'
  );
  if (threadsBlock) {
    const threadsUrl = threadsBlock.getAttribute("cite") ||
                       threadsBlock.getAttribute("data-threads-permalink") ||
                       extractFirstMatchingLink(temp, (u) =>
                         /https?:\/\/(www\.)?threads\.net\//i.test(u)
                       );
    if (threadsUrl) {
      return { type: "url", url: threadsUrl };
    }
  }

  // Bluesky
  const bskyBlock = temp.querySelector(
    'blockquote[data-bluesky-uri], [class*="bluesky-embed"], ' +
    'blockquote[cite*="bsky.app"]'
  );
  if (bskyBlock) {
    const bskyUrl = bskyBlock.getAttribute("data-bluesky-uri") ||
                    bskyBlock.getAttribute("cite") ||
                    extractFirstMatchingLink(temp, (u) =>
                      /https?:\/\/bsky\.app\//i.test(u)
                    );
    if (bskyUrl) {
      return { type: "url", url: bskyUrl };
    }
  }

  // Tumblr
  const tumblrBlock = temp.querySelector(
    'div.tumblr-post, [data-href*="tumblr.com"], ' +
    'blockquote[class*="tumblr"]'
  );
  if (tumblrBlock) {
    const tumblrUrl = tumblrBlock.getAttribute("data-href") ||
                      extractFirstMatchingLink(temp, (u) =>
                        /https?:\/\/[\w-]+\.tumblr\.com\/post\//i.test(u)
                      );
    if (tumblrUrl) {
      return { type: "url", url: tumblrUrl };
    }
  }

  // LinkedIn
  const linkedinBlock = temp.querySelector(
    '[data-li-embed], blockquote[class*="linkedin"]'
  );
  if (linkedinBlock) {
    const linkedinUrl = extractFirstMatchingLink(temp, (u) =>
      /https?:\/\/(www\.)?linkedin\.com\/(posts|embed|pulse)\//i.test(u)
    );
    if (linkedinUrl) {
      return { type: "url", url: linkedinUrl };
    }
  }

  // Mastodon (various instances)
  const mastodonBlock = temp.querySelector(
    'iframe[src*="/embed"], [class*="mastodon-embed"]'
  );
  if (mastodonBlock) {
    const src = mastodonBlock.getAttribute("src");
    if (src && src.includes("/embed")) {
      return { type: "embed", src: src, provider: "mastodon" };
    }
  }

  return null;
}

// ==========================
// Embed Div Processing
// ==========================

function processDivEmbed(temp) {
  // Facebook video
  const fbVideoDiv = temp.querySelector(
    '.fb-video[data-href], .fb-video[data-uri], ' +
    'div[data-href*="facebook.com"], div[data-uri*="facebook.com"], ' +
    'div[data-href*="fb.watch"]'
  );
  if (fbVideoDiv) {
    const href = fbVideoDiv.getAttribute("data-href") || 
                 fbVideoDiv.getAttribute("data-uri") || "";
    if (href) {
      return { type: "url", url: href };
    }
  }

  // Facebook post
  const fbPostDiv = temp.querySelector('.fb-post[data-href], .fb-post[data-uri]');
  if (fbPostDiv) {
    const href = fbPostDiv.getAttribute("data-href") ||
                 fbPostDiv.getAttribute("data-uri") || "";
    if (href) {
      return { type: "url", url: href };
    }
  }

  // Pinterest
  const pinDiv = temp.querySelector(
    'a[data-pin-do="embedPin"], [data-pin-id], ' +
    '[class*="pinterest-embed"], a[href*="pinterest.com/pin/"]'
  );
  if (pinDiv) {
    const pinUrl = pinDiv.getAttribute("href") ||
                   extractFirstMatchingLink(temp, (u) =>
                     /https?:\/\/(www\.)?pinterest\.(com|co\.uk|de|fr|es|it|ca|au)\/pin\//i.test(u)
                   );
    if (pinUrl) {
      return { type: "url", url: pinUrl };
    }
  }

  // Spotify (sometimes embedded as divs)
  const spotifyDiv = temp.querySelector(
    '[data-spotify-id], [class*="spotify-embed"]'
  );
  if (spotifyDiv) {
    const spotifyUrl = extractFirstMatchingLink(temp, (u) =>
      /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\//i.test(u)
    );
    if (spotifyUrl) {
      return { type: "url", url: spotifyUrl };
    }
  }

  // SoundCloud
  const soundcloudDiv = temp.querySelector(
    '[data-soundcloud], [class*="soundcloud-embed"]'
  );
  if (soundcloudDiv) {
    const soundcloudUrl = extractFirstMatchingLink(temp, (u) =>
      /https?:\/\/(www\.)?soundcloud\.com\//i.test(u)
    );
    if (soundcloudUrl) {
      return { type: "url", url: soundcloudUrl };
    }
  }

  // YouTube (sometimes in divs)
  const ytDiv = temp.querySelector(
    '[data-youtube-id], [data-video-id], [class*="youtube-embed"]'
  );
  if (ytDiv) {
    const ytId = ytDiv.getAttribute("data-youtube-id") || 
                 ytDiv.getAttribute("data-video-id");
    if (ytId && /^[A-Za-z0-9_-]{11}$/.test(ytId)) {
      return { type: "url", url: `https://www.youtube.com/watch?v=${ytId}` };
    }
  }

  // Giphy
  const giphyDiv = temp.querySelector(
    '[data-giphy-id], [class*="giphy-embed"]'
  );
  if (giphyDiv) {
    const giphyId = giphyDiv.getAttribute("data-giphy-id");
    if (giphyId) {
      return { type: "url", url: `https://giphy.com/gifs/${giphyId}` };
    }
  }

  return null;
}

// ==========================
// Video Creation from URL
// ==========================
function createVideoFromUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return;

  const urlObj = safeParseURL(trimmed);
  const spec = buildEmbedSpecFromUrl(urlObj, trimmed);

  if (!spec) return;

  createVideoWindow({
    aspectRatio: spec.aspect,
    mountContent: spec.mount,
    provider: spec.provider,
    url: spec.url,
    scrollable: spec.scrollable,
  });
}

// ==========================
// Helper: Create Window from URL but Store Original Embed
// ==========================

function createVideoWindowFromUrlWithOriginal(url, originalEmbed) {
  const trimmed = url.trim();
  if (!trimmed) return;

  const urlObj = safeParseURL(trimmed);
  const spec = buildEmbedSpecFromUrl(urlObj, trimmed);

  if (!spec) return;

  createVideoWindow({
    aspectRatio: spec.aspect,
    mountContent: spec.mount,
    provider: spec.provider,
    url: originalEmbed, // Store original embed code instead of converted URL
    scrollable: spec.scrollable,
  });
}

// ==========================
// Video Creation from Embed
// ==========================

function createVideoFromEmbed(embedHtml) {
  const html = embedHtml.trim();
  if (!html) return;

  // Store original embed code for copy functionality
  const originalInput = html;

  // If it's just a URL (no HTML tags), use URL handler but preserve original
  if (!/[<]/.test(html) && /^https?:\/\//i.test(html)) {
    createVideoFromUrl(html);
    return;
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Try blockquote-based embeds first
  const blockquoteResult = processBlockquoteEmbed(temp);
  if (blockquoteResult?.type === "url") {
    createVideoWindowFromUrlWithOriginal(blockquoteResult.url, originalInput);
    return;
  }

  // Try div-based embeds
  const divResult = processDivEmbed(temp);
  if (divResult?.type === "url") {
    createVideoWindowFromUrlWithOriginal(divResult.url, originalInput);
    return;
  }

  // Check for Facebook plugin iframe and preserve original
  const firstIframe = temp.querySelector("iframe");
  if (firstIframe) {
    const src = firstIframe.getAttribute("src") || "";
    const fbHref = getFacebookHrefFromPluginSrc(src);
    if (fbHref) {
      createVideoWindowFromUrlWithOriginal(fbHref, originalInput);
      return;
    }
  }

  // Remove scripts for safety but preserve structure
  temp.querySelectorAll("script").forEach((s) => s.remove());

  // Detect provider and aspect from media elements
  let detectedProvider = "generic";
  let aspect = 16 / 9;
  let scrollable = false;

  const mediaEls = temp.querySelectorAll("iframe, embed, video, object, audio");

  if (mediaEls.length > 0) {
    const first = mediaEls[0];
    const src = first.getAttribute("src") || 
                first.getAttribute("data") || 
                first.getAttribute("data-src") || "";
    
    // Detect provider from src
    const detected = detectProviderFromSrc(src);
    detectedProvider = detected.provider;
    scrollable = detected.scrollable || false;
    
    // Try to get aspect from attributes first
    const wAttr = parseInt(first.getAttribute("width"), 10);
    const hAttr = parseInt(first.getAttribute("height"), 10);

    if (!Number.isNaN(wAttr) && !Number.isNaN(hAttr) && hAttr !== 0 && wAttr !== 0) {
      aspect = wAttr / hAttr;
    } else {
      aspect = detected.aspect || 16 / 9;
    }

    // Normalize media elements for responsive display
    mediaEls.forEach((el) => {
      el.removeAttribute("width");
      el.removeAttribute("height");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.border = "none";

      const tagName = el.tagName.toLowerCase();

      if (tagName === "video" || tagName === "audio") {
        el.style.objectFit = "contain";
        el.setAttribute("playsinline", "true");
        el.setAttribute("controls", "true");
      }
      if (tagName === "iframe") {
        el.style.display = "block";
        el.scrolling = scrollable ? "auto" : "no";
        // Ensure proper attributes
        el.setAttribute("allowfullscreen", "true");
        el.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen");
      }
      if (tagName === "embed" || tagName === "object") {
        el.style.display = "block";
      }
    });
  }

  // Handle object/embed elements
  const objectEls = temp.querySelectorAll("object, embed");
  objectEls.forEach((el) => {
    el.style.width = "100%";
    el.style.height = "100%";
  });

  const processedHtml = temp.innerHTML;

  createVideoWindow({
    aspectRatio: aspect,
    provider: detectedProvider,
    url: originalInput, // Store original embed code for copy
    scrollable: scrollable,
    mountContent(contentEl) {
      contentEl.innerHTML = processedHtml;

      // Re-apply styles after mounting
      const anyMedia = contentEl.querySelectorAll("iframe, embed, video, object, audio");
      anyMedia.forEach((el) => {
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.border = "none";
        
        const tagName = el.tagName.toLowerCase();
        
        if (tagName === "video" || tagName === "audio") {
          el.style.objectFit = "contain";
        }
        if (tagName === "iframe") {
          el.style.display = "block";
          if (!scrollable) {
            el.scrolling = "no";
          }
        }
      });
    },
  });
}

// ==========================
// Video Window Creation
// ==========================
function computeInitialSize(ratio) {
  const workspaceRect = workspace.getBoundingClientRect();
  const maxW = Math.max(260, workspaceRect.width - 40);
  const maxH = Math.max(160, workspaceRect.height - 40);

  let width = 480;
  let height = width / ratio;

  if (width > maxW || height > maxH) {
    const scale = Math.min(maxW / width, maxH / height);
    width = Math.max(260, width * scale);
    height = width / ratio;
  }

  return { width, height };
}

function createVideoWindow({ aspectRatio = 16 / 9, mountContent, provider = "generic", url = "", scrollable = false }) {
  if (welcome && welcome.style.display !== "none") {
    welcome.style.display = "none";
  }

  const win = document.createElement("div");
  win.className = "video-window";
  
  // Add provider as data attribute for CSS targeting
  win.dataset.provider = provider;
  win.dataset.scrollable = scrollable ? "true" : "false";

  const ratio = aspectRatio || 16 / 9;
  win.dataset.aspectRatio = String(ratio);

  winMeta.set(win, { provider, url });

  const existingCount = workspace.querySelectorAll(".video-window").length;
  const { width, height } = computeInitialSize(ratio);

  win.style.width = width + "px";
  win.style.height = height + "px";
  win.style.left = 40 + existingCount * 24 + "px";
  win.style.top = 40 + existingCount * 24 + "px";
  win.style.zIndex = String(zCounter++);

  const toolbar = document.createElement("div");
  toolbar.className = "video-toolbar";

  // Left group: Move + Copy
  const leftGroup = document.createElement("div");
  leftGroup.className = "toolbar-group toolbar-left";

  const moveHandle = document.createElement("button");
  moveHandle.className = "toolbar-btn move-handle";
  moveHandle.type = "button";
  moveHandle.innerHTML = "⠿";
  moveHandle.title = "Move";
  moveHandle.setAttribute("aria-label", "Move video");

  const copyBtn = document.createElement("button");
  copyBtn.className = "toolbar-btn copy-btn";
  copyBtn.type = "button";
  copyBtn.innerHTML = "⧉";
  // Set initial title based on whether URL is embed code
  copyBtn.title = url.includes("<") ? "Copy embed" : "Copy URL";
  copyBtn.setAttribute("aria-label", url.includes("<") ? "Copy embed code" : "Copy URL");

  leftGroup.appendChild(moveHandle);
  leftGroup.appendChild(copyBtn);

  // Center: Title
  const centerGroup = document.createElement("div");
  centerGroup.className = "toolbar-group toolbar-center";

  const titleEl = document.createElement("span");
  titleEl.className = "window-title";
  titleEl.textContent = getDisplayTitle(provider, url);
  centerGroup.appendChild(titleEl);

  // Right group: Size + Refresh + Close
  const rightGroup = document.createElement("div");
  rightGroup.className = "toolbar-group toolbar-right";

  const sizeIndicator = document.createElement("span");
  sizeIndicator.className = "size-indicator";

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "toolbar-btn refresh-btn";
  refreshBtn.type = "button";
  refreshBtn.innerHTML = "⟳";
  refreshBtn.title = "Refresh";
  refreshBtn.setAttribute("aria-label", "Refresh video");

  const closeBtn = document.createElement("button");
  closeBtn.className = "toolbar-btn close-btn";
  closeBtn.type = "button";
  closeBtn.innerHTML = "✕";
  closeBtn.title = "Close";
  closeBtn.setAttribute("aria-label", "Close video");

  rightGroup.appendChild(sizeIndicator);
  rightGroup.appendChild(refreshBtn);
  rightGroup.appendChild(closeBtn);

  toolbar.appendChild(leftGroup);
  toolbar.appendChild(centerGroup);
  toolbar.appendChild(rightGroup);

  const content = document.createElement("div");
  content.className = "video-content";

  ["nw", "ne", "sw", "se"].forEach((corner) => {
    const h = document.createElement("div");
    h.className = `resize-handle resize-${corner}`;
    h.dataset.corner = corner;
    win.appendChild(h);
  });

  win.appendChild(toolbar);
  win.appendChild(content);
  workspace.appendChild(win);

  if (typeof mountContent === "function") {
    mountContent(content, win);
  }

  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <p>Remove this video from the canvas?</p>
      <div class="confirm-buttons">
        <button type="button" class="confirm-yes">Yes</button>
        <button type="button" class="confirm-no">No</button>
      </div>
    </div>
  `;
  content.appendChild(overlay);

  attachWindowEvents(win);
  clampWindowToWorkspace(win);
  triggerResizeEnd(win);
}

// ==========================
// Window Events
// ==========================
function attachWindowEvents(win) {
  const moveHandle = win.querySelector(".move-handle");
  const copyBtn = win.querySelector(".copy-btn");
  const refreshBtn = win.querySelector(".refresh-btn");
  const closeBtn = win.querySelector(".close-btn");
  const overlay = win.querySelector(".confirm-overlay");
  const confirmYes = overlay.querySelector(".confirm-yes");
  const confirmNo = overlay.querySelector(".confirm-no");
  const sizeIndicator = win.querySelector(".size-indicator");

  win.addEventListener("mousedown", () => {
    win.style.zIndex = String(zCounter++);
  });

  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyWindowUrl(win);
  });

  refreshBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    refreshWindow(win);
  });

moveHandle.addEventListener("mousedown", (e) => {
  e.preventDefault();

  // 1. Increment the global z-index counter and apply it to this window
  win.style.zIndex = ++zCounter;

  const rect = win.getBoundingClientRect();
  const workspaceRect = workspace.getBoundingClientRect();

  activeAction = {
    type: "move",
    win,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    workspaceRect,
    width: rect.width,
    height: rect.height,
    left: rect.left - workspaceRect.left,
    top: rect.top - workspaceRect.top,
  };

  win.classList.add("moving");
});

   const handles = win.querySelectorAll(".resize-handle");
  handles.forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Bring this window to the top and keep it there
      win.style.zIndex = String(zCounter++);

      const corner = handle.dataset.corner;
      const style = window.getComputedStyle(win);
      const workspaceRect = workspace.getBoundingClientRect();

      const startLeft = parseFloat(style.left);
      const startTop = parseFloat(style.top);
      const startWidth = parseFloat(style.width);
      const startHeight = parseFloat(style.height);

      activeAction = {
        type: "resize",
        win,
        corner,
        startMouseX: e.clientX,
        startLeft,
        startTop,
        startWidth,
        startHeight,
        aspect: parseFloat(win.dataset.aspectRatio) || 16 / 9,
        workspaceRect,
        left: startLeft,
        top: startTop,
        width: startWidth,
        height: startHeight,
      };

      win.classList.add("resizing");
      if (sizeIndicator) {
        sizeIndicator.textContent = Math.round(startWidth) + " × " + Math.round(startHeight);
      }
    });
  });
  
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    overlay.style.display = "flex";
  });

  confirmNo.addEventListener("click", (e) => {
    e.stopPropagation();
    overlay.style.display = "none";
  });

  confirmYes.addEventListener("click", (e) => {
    e.stopPropagation();

    const timer = resizeTimers.get(win);
    if (timer) clearTimeout(timer);
    resizeTimers.delete(win);
    winHooks.delete(win);
    winMeta.delete(win);

    win.remove();
    overlay.style.display = "none";

    if (!workspace.querySelector(".video-window") && welcome) {
      welcome.style.display = "";
    }
  });
}

// ==========================
// Geometry Helpers
// ==========================
function clampWindowToWorkspace(win) {
  const workspaceRect = workspace.getBoundingClientRect();
  const style = window.getComputedStyle(win);

  let left = parseFloat(style.left);
  let top = parseFloat(style.top);
  let width = parseFloat(style.width);
  let height = parseFloat(style.height);

  if (Number.isNaN(left)) left = 0;
  if (Number.isNaN(top)) top = 0;

  if (width > workspaceRect.width || height > workspaceRect.height) {
    const scale = Math.min(workspaceRect.width / width, workspaceRect.height / height, 1);
    width *= scale;
    height *= scale;
    win.style.width = width + "px";
    win.style.height = height + "px";
  }

  const maxLeft = Math.max(0, workspaceRect.width - width);
  const maxTop = Math.max(0, workspaceRect.height - height);

  left = clamp(left, 0, maxLeft);
  top = clamp(top, 0, maxTop);

  win.style.left = left + "px";
  win.style.top = top + "px";
}

function getMaxWidthForCorner(action) {
  const { startLeft, startTop, startWidth, startHeight, aspect, corner, workspaceRect } = action;

  const right = startLeft + startWidth;
  const bottom = startTop + startHeight;
  const Ww = workspaceRect.width;
  const Wh = workspaceRect.height;

  switch (corner) {
    case "se": return Math.min(Ww - startLeft, (Wh - startTop) * aspect);
    case "sw": return Math.min(right, (Wh - startTop) * aspect);
    case "ne": return Math.min(Ww - startLeft, bottom * aspect);
    case "nw": return Math.min(right, bottom * aspect);
    default: return Ww;
  }
}

// ==========================
// Animation Frame Loop
// ==========================
function requestRender() {
  if (rafId == null) {
    rafId = requestAnimationFrame(applyActiveAction);
  }
}

function applyActiveAction() {
  rafId = null;
  if (!activeAction) return;

  const { win, type } = activeAction;
  if (!win) return;

  if (type === "move") {
    if (typeof activeAction.left === "number") win.style.left = activeAction.left + "px";
    if (typeof activeAction.top === "number") win.style.top = activeAction.top + "px";
  } else if (type === "resize") {
    const { left, top, width, height } = activeAction;
    if (typeof left === "number" && typeof top === "number" && typeof width === "number" && typeof height === "number") {
      win.style.left = left + "px";
      win.style.top = top + "px";
      win.style.width = width + "px";
      win.style.height = height + "px";

      const sizeIndicator = win.querySelector(".size-indicator");
      if (sizeIndicator) {
        sizeIndicator.textContent = Math.round(width) + " × " + Math.round(height);
      }
    }
  }
}

// ==========================
// Global Mouse Handlers
// ==========================
document.addEventListener("mousemove", (e) => {
  if (!activeAction) return;
  e.preventDefault();

  if (activeAction.type === "move") {
    const { offsetX, offsetY, workspaceRect, width, height } = activeAction;

    let newLeft = e.clientX - offsetX - workspaceRect.left;
    let newTop = e.clientY - offsetY - workspaceRect.top;

    const maxLeft = Math.max(0, workspaceRect.width - width);
    const maxTop = Math.max(0, workspaceRect.height - height);

    activeAction.left = clamp(newLeft, 0, maxLeft);
    activeAction.top = clamp(newTop, 0, maxTop);
    requestRender();
  }

  if (activeAction.type === "resize") {
    const s = activeAction;
    const { corner, startMouseX, startLeft, startTop, startWidth, startHeight, aspect } = s;

    const dx = e.clientX - startMouseX;
    let proposedWidth = corner === "ne" || corner === "se" ? startWidth + dx : startWidth - dx;

    const minWidth = 220;
    const maxWidth = getMaxWidthForCorner(s) || startWidth;

    let newWidth = clamp(proposedWidth, minWidth, maxWidth);
    let newHeight = newWidth / aspect;

    const right = startLeft + startWidth;
    const bottom = startTop + startHeight;

    let newLeft = startLeft;
    let newTop = startTop;

    switch (corner) {
      case "se": break;
      case "sw": newLeft = right - newWidth; break;
      case "ne": newTop = bottom - newHeight; break;
      case "nw": newLeft = right - newWidth; newTop = bottom - newHeight; break;
    }

    activeAction.left = newLeft;
    activeAction.top = newTop;
    activeAction.width = newWidth;
    activeAction.height = newHeight;
    requestRender();
  }
});

document.addEventListener("mouseup", () => {
  if (!activeAction) return;
  const { win, type } = activeAction;

  applyActiveAction();

  if (type === "move") win.classList.remove("moving");
  if (type === "resize") win.classList.remove("resizing");

  clampWindowToWorkspace(win);

  if (type === "resize") {
    triggerResizeEnd(win);
  }

  activeAction = null;
});

let resizeTimeout = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const wins = workspace.querySelectorAll(".video-window");
    wins.forEach((win) => {
      clampWindowToWorkspace(win);
      triggerResizeEnd(win);
    });
  }, 150);
});