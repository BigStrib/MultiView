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

// Twitch embed configuration
const TWITCH_PARENT_DOMAIN = "bigstrib.github.io";
const TWITCH_ORIGIN = "https://bigstrib.github.io/MultiView/";

let zCounter = 10;

// Drag / resize state
let activeAction = null; // { type: 'move'|'resize', win, ... }
let rafId = null;        // requestAnimationFrame id

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

sidebarTab.addEventListener("click", () => {
  toggleSidebar();
});

// Shift key to open/close menu (ignore when typing in inputs/textareas)
document.addEventListener("keydown", (e) => {
  if (e.key === "Shift" && !e.repeat) {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    toggleSidebar();
  }
});

// ==========================
// Smart Paste & Controls
// ==========================

// ---- URL section ----

addUrlBtn.addEventListener("click", () => {
  const raw = urlInput.value.trim();
  if (!raw) return;
  createVideoFromUrl(raw);
  urlInput.value = "";
  closeSidebar();
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const raw = urlInput.value.trim();
    if (!raw) return;
    createVideoFromUrl(raw);
    urlInput.value = "";
    closeSidebar();
  }
});

// Smart paste: paste URL -> add -> close
urlInput.addEventListener("paste", (e) => {
  const pasted =
    (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const value = pasted.trim();
  if (!value) return;

  if (!urlInput.value.trim()) {
    e.preventDefault();
    createVideoFromUrl(value);
    urlInput.value = "";
    closeSidebar();
  }
});

// ---- Embed section ----

addEmbedBtn.addEventListener("click", () => {
  const raw = embedInput.value.trim();
  if (!raw) return;
  createVideoFromEmbed(raw);
  embedInput.value = "";
  closeSidebar();
});

// Smart paste: paste embed -> add -> close
embedInput.addEventListener("paste", (e) => {
  const pasted =
    (e.clipboardData || window.clipboardData)?.getData("text") || "";
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
// URL Parsing / Provider Logic
// ==========================

function safeParseURL(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Build an iframe src + aspect ratio for a given URL.
 * Uses provider-specific embed endpoints for:
 *  - YouTube
 *  - Twitch (channel, vod, clips)
 *  - Kick
 *  - Vimeo
 *  - X / Twitter
 *
 * Rumble and Facebook URLs are NOT handled here anymore:
 *  - For those, users should paste the official embed iframe into the Embed box.
 */
function buildEmbedFromUrl(urlObj, raw) {
  const fallback = {
    src: raw,
    aspect: 16 / 9,
  };

  if (!urlObj) return fallback;

  const host = urlObj.hostname.replace(/^www\./, "").toLowerCase();
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  // ===== YouTube =====
  if (
    host.includes("youtube.com") ||
    host === "youtu.be" ||
    host === "m.youtube.com"
  ) {
    let videoId = "";

    if (host === "youtu.be") {
      videoId = pathParts[0] || "";
    } else {
      videoId = urlObj.searchParams.get("v") || "";

      if (!videoId) {
        const first = pathParts[0];
        const second = pathParts[1];
        if (["shorts", "embed", "live"].includes(first) && second) {
          videoId = second;
        } else if (first && /^[A-Za-z0-9_-]{6,}$/.test(first)) {
          videoId = first;
        }
      }
    }

    if (videoId) {
      return {
        src: `https://www.youtube.com/embed/${videoId}`,
        aspect: 16 / 9,
      };
    }
    return fallback;
  }

  // ===== Twitch =====
  const twitchParams =
    `parent=${encodeURIComponent(TWITCH_PARENT_DOMAIN)}` +
    `&origin=${encodeURIComponent(TWITCH_ORIGIN)}`;

  if (host === "twitch.tv" || host.endsWith(".twitch.tv")) {
    // Clip: https://www.twitch.tv/clip/Slug
    if (pathParts[0] === "clip" && pathParts[1]) {
      const slug = pathParts[1];
      return {
        src: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(
          slug
        )}&${twitchParams}`,
        aspect: 16 / 9,
      };
    }

    // Clip via ?clip=Slug
    const clipParam = urlObj.searchParams.get("clip");
    if (clipParam) {
      return {
        src: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(
          clipParam
        )}&${twitchParams}`,
        aspect: 16 / 9,
      };
    }

    // VOD: /videos/ID
    if (pathParts[0] === "videos" && pathParts[1]) {
      const videoId = pathParts[1];
      return {
        src: `https://player.twitch.tv/?video=${encodeURIComponent(
          videoId
        )}&${twitchParams}`,
        aspect: 16 / 9,
      };
    }

    // Channel: /CHANNEL
    const channel = pathParts[0] || "";
    if (channel) {
      return {
        src: `https://player.twitch.tv/?channel=${encodeURIComponent(
          channel
        )}&${twitchParams}`,
        aspect: 16 / 9,
      };
    }

    return fallback;
  }

  // Twitch clips direct host
  if (host === "clips.twitch.tv") {
    const slug = pathParts[0] || "";
    if (slug) {
      return {
        src: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(
          slug
        )}&${twitchParams}`,
        aspect: 16 / 9,
      };
    }
    return fallback;
  }

  // ===== Kick =====
  if (host.includes("kick.com")) {
    const first = pathParts[0] || "";
    if (first) {
      return {
        src: `https://player.kick.com/${encodeURIComponent(first)}`,
        aspect: 16 / 9,
      };
    }
    return fallback;
  }

  // ===== Rumble (removed) =====
  if (host.includes("rumble.com")) {
    // No automatic handling; require the official Rumble embed iframe instead.
    alert(
      "Rumble URLs are not added directly. Please copy the official Rumble embed code and paste it into the Embed box."
    );
    return null;
  }

  // ===== Facebook (removed) =====
  if (host.includes("facebook.com") || host === "fb.watch") {
    // No automatic handling; require official Facebook embed iframe instead.
    alert(
      "Facebook URLs are not added directly. Please copy the official Facebook embed code and paste it into the Embed box."
    );
    return null;
  }

  // ===== X / Twitter =====
  if (
    host === "twitter.com" ||
    host === "x.com" ||
    host === "mobile.twitter.com"
  ) {
    const full = urlObj.toString();
    let tweetId = null;

    for (let i = 0; i < pathParts.length; i++) {
      const seg = pathParts[i].toLowerCase();
      if ((seg === "status" || seg === "statuses") && pathParts[i + 1]) {
        const candidate = pathParts[i + 1].split("?")[0];
        if (/^\d+$/.test(candidate)) {
          tweetId = candidate;
          break;
        }
      }
    }

    if (tweetId) {
      // Official tweet embed (Twitter controls layout; usually text + video).
      return {
        src:
          "https://platform.twitter.com/embed/Tweet.html?id=" +
          encodeURIComponent(tweetId) +
          "&theme=dark&hide_thread=true&dnt=false",
        aspect: 16 / 9,
      };
    }

    // Fallback: Twitframe (full tweet in an iframe)
    return {
      src:
        "https://twitframe.com/show?url=" +
        encodeURIComponent(full) +
        "&theme=dark",
      aspect: 16 / 9,
    };
  }

  // ===== Vimeo main site =====
  if (host === "vimeo.com") {
    const id = pathParts[0];
    if (id && /^\d+$/.test(id)) {
      return {
        src: `https://player.vimeo.com/video/${id}`,
        aspect: 16 / 9,
      };
    }
    return fallback;
  }

  // ===== Vimeo player =====
  if (host === "player.vimeo.com") {
    return {
      src: urlObj.toString(),
      aspect: 16 / 9,
    };
  }

  // ===== Generic fallback =====
  return fallback;
}

function createVideoFromUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  const urlObj = safeParseURL(trimmed);
  const cfg = buildEmbedFromUrl(urlObj, trimmed);

  // Host was explicitly unsupported (Rumble/Facebook): nothing to create.
  if (!cfg) return;

  createVideoWindow({
    type: "iframe",
    src: cfg.src,
    aspectRatio: cfg.aspect,
  });
}

/**
 * Accept arbitrary embed code from platforms.
 * - Detect aspect ratio from width/height (or styles)
 * - Force all iframes/videos to fill the window area
 * - Keep window resizing locked to that aspect ratio
 */
function createVideoFromEmbed(embedHtml) {
  const html = embedHtml.trim();

  // If user pasted a plain URL, treat as URL
  if (!/[<]/.test(html) && /^https?:\/\//i.test(html)) {
    createVideoFromUrl(html);
    return;
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  let aspect = 16 / 9;

  const mediaEls = temp.querySelectorAll("iframe, embed, video");
  if (mediaEls.length > 0) {
    const first = mediaEls[0];

    const wAttr = parseInt(first.getAttribute("width"), 10);
    const hAttr = parseInt(first.getAttribute("height"), 10);

    if (!isNaN(wAttr) && !isNaN(hAttr) && hAttr !== 0) {
      aspect = wAttr / hAttr;
    } else {
      const styleWidth = parseInt(first.style.width, 10);
      const styleHeight = parseInt(first.style.height, 10);
      if (!isNaN(styleWidth) && !isNaN(styleHeight) && styleHeight !== 0) {
        aspect = styleWidth / styleHeight;
      }
    }

    mediaEls.forEach((el) => {
      el.removeAttribute("width");
      el.removeAttribute("height");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.border = "none";
      if (el.tagName.toLowerCase() === "video") {
        el.style.objectFit = "contain";
      }
      if (el.tagName.toLowerCase() === "iframe") {
        el.scrolling = "no";
      }
    });
  }

  createVideoWindow({
    type: "html",
    html: temp.innerHTML,
    aspectRatio: aspect,
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

function createVideoWindow(options) {
  if (welcome && welcome.style.display !== "none") {
    welcome.style.display = "none";
  }

  const win = document.createElement("div");
  win.className = "video-window";

  const ratio = options.aspectRatio || 16 / 9;
  win.dataset.aspectRatio = String(ratio);

  const existingCount = workspace.querySelectorAll(".video-window").length;
  const { width, height } = computeInitialSize(ratio);

  win.style.width = width + "px";
  win.style.height = height + "px";
  win.style.left = 40 + existingCount * 24 + "px";
  win.style.top = 40 + existingCount * 24 + "px";
  win.style.zIndex = String(zCounter++);

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "video-toolbar";

  const moveHandle = document.createElement("button");
  moveHandle.className = "move-handle";
  moveHandle.type = "button";
  moveHandle.innerHTML = "⠿";
  moveHandle.title = "Move video";
  moveHandle.setAttribute("aria-label", "Move video");

  const sizeIndicator = document.createElement("div");
  sizeIndicator.className = "size-indicator";

  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.type = "button";
  closeBtn.innerHTML = "✕";
  closeBtn.title = "Close video";
  closeBtn.setAttribute("aria-label", "Close video");

  toolbar.appendChild(moveHandle);
  toolbar.appendChild(sizeIndicator);
  toolbar.appendChild(closeBtn);

  const content = document.createElement("div");
  content.className = "video-content";

  if (options.type === "iframe") {
    const iframe = document.createElement("iframe");
    iframe.src = options.src;
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    );
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.scrolling = "no";
    content.appendChild(iframe);
  } else if (options.type === "html") {
    content.innerHTML = options.html;
    const anyMedia = content.querySelectorAll("iframe, embed, video");
    anyMedia.forEach((el) => {
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.border = "none";
      if (el.tagName.toLowerCase() === "video") {
        el.style.objectFit = "contain";
      }
      if (el.tagName.toLowerCase() === "iframe") {
        el.scrolling = "no";
      }
    });
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

  ["nw", "ne", "sw", "se"].forEach((corner) => {
    const h = document.createElement("div");
    h.className = `resize-handle resize-${corner}`;
    h.dataset.corner = corner;
    win.appendChild(h);
  });

  win.appendChild(toolbar);
  win.appendChild(content);
  workspace.appendChild(win);

  attachWindowEvents(win);
  clampWindowToWorkspace(win);
}

// ==========================
// Window Events (Move/Resize/Close)
// ==========================

function attachWindowEvents(win) {
  const moveHandle = win.querySelector(".move-handle");
  const closeBtn = win.querySelector(".close-btn");
  const overlay = win.querySelector(".confirm-overlay");
  const confirmYes = overlay.querySelector(".confirm-yes");
  const confirmNo = overlay.querySelector(".confirm-no");
  const sizeIndicator = win.querySelector(".size-indicator");

  win.addEventListener("mousedown", () => {
    win.style.zIndex = String(zCounter++);
  });

  // Smooth MOVE: store fixed geometry at start; update only via rAF
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

  // Smooth RESIZE: same pattern, all geometry stored once at mousedown
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
        sizeIndicator.textContent =
          Math.round(startWidth) + " x " + Math.round(startHeight);
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
    const scale = Math.min(
      workspaceRect.width / width,
      workspaceRect.height / height,
      1
    );
    width *= scale;
    height *= scale;
    win.style.width = width + "px";
    win.style.height = height + "px";
  }

  const maxLeft = Math.max(0, workspaceRect.width - width);
  const maxTop = Math.max(0, workspaceRect.height - height);

  if (left < 0) left = 0;
  if (top < 0) top = 0;
  if (left > maxLeft) left = maxLeft;
  if (top > maxTop) top = maxTop;

  win.style.left = left + "px";
  win.style.top = top + "px";
}

function getMaxWidthForCorner(action) {
  const {
    startLeft,
    startTop,
    startWidth,
    startHeight,
    aspect,
    corner,
    workspaceRect,
  } = action;

  const right = startLeft + startWidth;
  const bottom = startTop + startHeight;
  const Ww = workspaceRect.width;
  const Wh = workspaceRect.height;

  switch (corner) {
    case "se":
      return Math.min(Ww - startLeft, (Wh - startTop) * aspect);
    case "sw":
      return Math.min(right, (Wh - startTop) * aspect);
    case "ne":
      return Math.min(Ww - startLeft, bottom * aspect);
    case "nw":
      return Math.min(right, bottom * aspect);
    default:
      return Ww;
  }
}

// ==========================
// rAF Update Loop (smooth drag/resize)
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
    if (typeof activeAction.left === "number") {
      win.style.left = activeAction.left + "px";
    }
    if (typeof activeAction.top === "number") {
      win.style.top = activeAction.top + "px";
    }
  } else if (type === "resize") {
    const { left, top, width, height } = activeAction;
    if (
      typeof left === "number" &&
      typeof top === "number" &&
      typeof width === "number" &&
      typeof height === "number"
    ) {
      win.style.left = left + "px";
      win.style.top = top + "px";
      win.style.width = width + "px";
      win.style.height = height + "px";

      const sizeIndicator = win.querySelector(".size-indicator");
      if (sizeIndicator) {
        sizeIndicator.textContent =
          Math.round(width) + " x " + Math.round(height);
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

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;
    if (newTop > maxTop) newTop = maxTop;

    activeAction.left = newLeft;
    activeAction.top = newTop;
    requestRender();
  }

  if (activeAction.type === "resize") {
    const s = activeAction;
    const {
      corner,
      startMouseX,
      startLeft,
      startTop,
      startWidth,
      startHeight,
      aspect,
      workspaceRect,
    } = s;

    const dx = e.clientX - startMouseX;

    let proposedWidth =
      corner === "ne" || corner === "se"
        ? startWidth + dx
        : startWidth - dx;

    const minWidth = 220;
    const maxWidth = getMaxWidthForCorner(s) || startWidth;

    let newWidth = Math.max(minWidth, Math.min(proposedWidth, maxWidth));
    let newHeight = newWidth / aspect;

    const right = startLeft + startWidth;
    const bottom = startTop + startHeight;

    let newLeft = startLeft;
    let newTop = startTop;

    switch (corner) {
      case "se":
        newLeft = startLeft;
        newTop = startTop;
        break;
      case "sw":
        newLeft = right - newWidth;
        newTop = startTop;
        break;
      case "ne":
        newLeft = startLeft;
        newTop = bottom - newHeight;
        break;
      case "nw":
        newLeft = right - newWidth;
        newTop = bottom - newHeight;
        break;
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
  activeAction = null;
});

window.addEventListener("resize", () => {
  const wins = workspace.querySelectorAll(".video-window");
  wins.forEach((win) => clampWindowToWorkspace(win));
});


const sidebarBackdrop = document.getElementById("sidebar-backdrop");

sidebarBackdrop.addEventListener("click", () => {
  document.body.classList.remove("sidebar-open");
});