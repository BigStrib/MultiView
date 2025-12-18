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

const TWITCH_PARENT_DOMAIN = "bigstrib.github.io";

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

function getDisplayTitle(provider, url) {
  const providerNames = {
    "youtube": "YouTube",
    "twitch-live": "Twitch",
    "twitch-vod": "Twitch",
    "twitch-clip": "Twitch",
    "kick": "Kick",
    "vimeo": "Vimeo",
    "twitter": "X",
    "facebook": "Facebook",
    "rumble": "Rumble",
    "generic": null
  };

  if (provider && providerNames[provider]) {
    return providerNames[provider];
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

  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.display = "block";
  
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
// Copy URL to Clipboard
// ==========================
function copyWindowUrl(win) {
  const meta = winMeta.get(win);
  if (!meta?.url) return;

  navigator.clipboard.writeText(meta.url).then(() => {
    const copyBtn = win.querySelector(".copy-btn");
    if (copyBtn) {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = "✓";
      copyBtn.title = "Copied!";
      setTimeout(() => {
        copyBtn.innerHTML = original;
        copyBtn.title = "Copy URL";
      }, 1500);
    }
  }).catch(() => {
    const textarea = document.createElement("textarea");
    textarea.value = meta.url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  });
}

// ==========================
// Video Creation
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

function extractFirstMatchingLink(root, predicate) {
  const links = root.querySelectorAll("a[href]");
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    if (predicate(href)) return href;
  }
  return "";
}

function createVideoFromEmbed(embedHtml) {
  const html = embedHtml.trim();
  if (!html) return;

  if (!/[<]/.test(html) && /^https?:\/\//i.test(html)) {
    createVideoFromUrl(html);
    return;
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  const twitterBlock = temp.querySelector("blockquote.twitter-tweet, blockquote[data-theme]");
  if (twitterBlock) {
    const tweetUrl = extractFirstMatchingLink(temp, (u) => /https?:\/\/(x\.com|twitter\.com)\//i.test(u));
    if (tweetUrl) {
      createVideoFromUrl(tweetUrl);
      return;
    }
  }

  const fbVideoDiv = temp.querySelector(".fb-video[data-href], .fb-video[data-uri]");
  if (fbVideoDiv) {
    const href = fbVideoDiv.getAttribute("data-href") || fbVideoDiv.getAttribute("data-uri") || "";
    if (href) {
      createVideoFromUrl(href);
      return;
    }
  }

  const firstIframe = temp.querySelector("iframe");
  if (firstIframe) {
    const src = firstIframe.getAttribute("src") || "";
    const fbHref = getFacebookHrefFromPluginSrc(src);
    if (fbHref) {
      createVideoFromUrl(fbHref);
      return;
    }
  }

  temp.querySelectorAll("script").forEach((s) => s.remove());

  let aspect = 16 / 9;
  const mediaEls = temp.querySelectorAll("iframe, embed, video");

  if (mediaEls.length > 0) {
    const first = mediaEls[0];
    const wAttr = parseInt(first.getAttribute("width"), 10);
    const hAttr = parseInt(first.getAttribute("height"), 10);

    if (!Number.isNaN(wAttr) && !Number.isNaN(hAttr) && hAttr !== 0) {
      aspect = wAttr / hAttr;
    }

    mediaEls.forEach((el) => {
      el.removeAttribute("width");
      el.removeAttribute("height");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.border = "none";

      if (el.tagName.toLowerCase() === "video") {
        el.style.objectFit = "contain";
        el.setAttribute("playsinline", "true");
      }
      if (el.tagName.toLowerCase() === "iframe") {
        el.style.display = "block";
        el.scrolling = "no";
      }
    });
  }

  let embedUrl = "";
  if (firstIframe) {
    embedUrl = firstIframe.getAttribute("src") || "";
  }

  createVideoWindow({
    aspectRatio: aspect,
    provider: "generic",
    url: embedUrl,
    scrollable: false,
    mountContent(contentEl) {
      contentEl.innerHTML = temp.innerHTML;

      const anyMedia = contentEl.querySelectorAll("iframe, embed, video");
      anyMedia.forEach((el) => {
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.border = "none";
        if (el.tagName.toLowerCase() === "video") {
          el.style.objectFit = "contain";
        }
        if (el.tagName.toLowerCase() === "iframe") {
          el.style.display = "block";
          el.scrolling = "no";
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
  copyBtn.title = "Copy URL";
  copyBtn.setAttribute("aria-label", "Copy URL");

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
    e.stopPropagation();

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