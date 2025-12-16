// app.js
// MultiView – draggable, resizable multi-iframe workspace

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

// Twitch embed requires parent to match your domain
const TWITCH_PARENT = "bigstrib.github.io";

let zCounter = 10;
let activeAction = null; // { type: 'move'|'resize', ... }

// ==========================
// Sidebar Helpers
// ==========================

function openSidebar() {
  document.body.classList.add("sidebar-open");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

// Toggle sidebar when clicking the edge tab
sidebarTab.addEventListener("click", () => {
  if (document.body.classList.contains("sidebar-open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

// ==========================
// Smart Paste & Button Events
// ==========================

// --- URL section ---

addUrlBtn.addEventListener("click", () => {
  const raw = urlInput.value.trim();
  if (!raw) return;
  createVideoFromUrl(raw);
  urlInput.value = "";
  closeSidebar();
});

// Press Enter inside URL input
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

// Smart paste for URL input: paste -> create video -> close menu
urlInput.addEventListener("paste", (e) => {
  const pasted =
    (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const value = pasted.trim();
  if (!value) return;

  // If input is empty, treat as "smart paste"
  if (!urlInput.value.trim()) {
    e.preventDefault();
    createVideoFromUrl(value);
    urlInput.value = "";
    closeSidebar();
  }
});

// --- Embed code section ---

addEmbedBtn.addEventListener("click", () => {
  const raw = embedInput.value.trim();
  if (!raw) return;
  createVideoFromEmbed(raw);
  embedInput.value = "";
  closeSidebar();
});

// Smart paste for embed input: paste -> create iframe(s) -> close menu
embedInput.addEventListener("paste", (e) => {
  const pasted =
    (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const value = pasted.trim();
  if (!value) return;

  // Only auto-add when field is empty (smart paste behavior)
  if (!embedInput.value.trim()) {
    e.preventDefault();
    createVideoFromEmbed(value);
    embedInput.value = "";
    closeSidebar();
  }
});

// ==========================
// URL Parsing & Embeds
// ==========================

function createVideoFromUrl(rawUrl) {
  let embedSrc = rawUrl.trim();
  let aspect = 16 / 9; // default aspect ratio

  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const pathParts = u.pathname.split("/").filter(Boolean);

    // ---- YouTube ----
    if (host.includes("youtube.com") || host === "youtu.be") {
      let videoId = "";

      if (host === "youtu.be") {
        videoId = pathParts[0] || "";
      } else {
        // watch?v=ID
        videoId = u.searchParams.get("v") || "";

        // /shorts/ID, /embed/ID, /live/ID, or /ID
        if (!videoId) {
          if (
            ["shorts", "embed", "live"].includes(pathParts[0]) &&
            pathParts[1]
          ) {
            videoId = pathParts[1];
          } else if (pathParts[0]) {
            videoId = pathParts[0];
          }
        }
      }

      if (videoId) {
        embedSrc = `https://www.youtube.com/embed/${videoId}`;
      }
      aspect = 16 / 9;
    }

    // ---- Twitch ----
    else if (host.includes("twitch.tv")) {
      // Basic channel embeds
      let channel = pathParts[0] || "";
      if (channel === "videos" || channel === "clip") {
        channel = pathParts[1] || channel;
      }

      if (channel) {
        embedSrc = `https://player.twitch.tv/?channel=${encodeURIComponent(
          channel
        )}&parent=${encodeURIComponent(TWITCH_PARENT)}`;
        aspect = 16 / 9;
      }
    }

    // ---- Kick ----
    else if (host.includes("kick.com")) {
      // kick.com/channel or other variations – use first segment as channel/id
      const channel = pathParts[0] || "";
      if (channel) {
        embedSrc = `https://player.kick.com/${encodeURIComponent(channel)}`;
        aspect = 16 / 9;
      }
    }

    // ---- Rumble ----
    else if (host.includes("rumble.com")) {
      // Recorded videos: /vID-some-title.html?...
      // Example: /v71i3ym-gangs-order-kill-on-sight-dhs-agents-chicago-is-a-war-zone.html
      if (pathParts[0]) {
        const match = pathParts[0].match(/^(v[a-zA-Z0-9]+)/);
        if (match && match[1]) {
          const id = match[1]; // e.g. v71i3ym
          embedSrc = `https://rumble.com/embed/${id}/`;
          aspect = 16 / 9;
        }
        // Live streams (channel URLs) are best embedded using Rumble's own
        // embed code. If the user pastes that code, createVideoFromEmbed()
        // will handle it. Here we fall back to raw URL.
      }
    }

    // ---- Vimeo (page URL) ----
    else if (host === "vimeo.com") {
      // vimeo.com/VIDEOID
      const id = pathParts[0];
      if (id && /^\d+$/.test(id)) {
        embedSrc = `https://player.vimeo.com/video/${id}`;
        aspect = 16 / 9;
      }
    }

    // ---- Vimeo player URL ----
    else if (host === "player.vimeo.com") {
      // Already an embed URL; use as-is
      aspect = 16 / 9;
    }

    // Other providers: keep as direct iframe src
  } catch (err) {
    // If URL parsing fails, just use the raw string as iframe src
  }

  createVideoWindow({
    type: "iframe",
    src: embedSrc,
    aspectRatio: aspect,
  });
}

function createVideoFromEmbed(embedHtml) {
  // Accept any iframe/embed/video HTML; show as-is in the window
  const temp = document.createElement("div");
  temp.innerHTML = embedHtml.trim();

  let aspect = 16 / 9;

  // Try to find the first media element and derive aspect ratio
  const mediaEl = temp.querySelector("iframe, embed, video");

  if (mediaEl) {
    const wAttr = parseInt(mediaEl.getAttribute("width"), 10);
    const hAttr = parseInt(mediaEl.getAttribute("height"), 10);

    if (!isNaN(wAttr) && !isNaN(hAttr) && hAttr !== 0) {
      aspect = wAttr / hAttr;
    } else {
      const styleWidth = parseInt(mediaEl.style.width, 10);
      const styleHeight = parseInt(mediaEl.style.height, 10);
      if (!isNaN(styleWidth) && !isNaN(styleHeight) && styleHeight !== 0) {
        aspect = styleWidth / styleHeight;
      }
    }

    // Force the media element to fill our container, regardless of its original attributes
    mediaEl.removeAttribute("width");
    mediaEl.removeAttribute("height");
    mediaEl.style.width = "100%";
    mediaEl.style.height = "100%";
    mediaEl.style.border = "none";
  } else {
    // If no iframe/embed/video is found but the user pasted a plain URL,
    // fall back to treating it as a URL.
    if (/^https?:\/\//i.test(embedHtml.trim())) {
      createVideoFromUrl(embedHtml.trim());
      return;
    }
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

function createVideoWindow(options) {
  // Hide welcome overlay on first video
  if (welcome && welcome.style.display !== "none") {
    welcome.style.display = "none";
  }

  const win = document.createElement("div");
  win.className = "video-window";

  const ratio = options.aspectRatio || 16 / 9;
  win.dataset.aspectRatio = String(ratio);

  // Default size and staggered starting position
  const baseWidth = 480;
  const baseHeight = baseWidth / ratio;

  const existingCount = workspace.querySelectorAll(".video-window").length;

  win.style.width = baseWidth + "px";
  win.style.height = baseHeight + "px";
  win.style.left = 40 + existingCount * 24 + "px";
  win.style.top = 40 + existingCount * 24 + "px";
  win.style.zIndex = String(zCounter++);

  // ----- Toolbar -----
  const toolbar = document.createElement("div");
  toolbar.className = "video-toolbar";

  // Move button with icon-like appearance
  const moveHandle = document.createElement("button");
  moveHandle.className = "move-handle";
  moveHandle.type = "button";
  moveHandle.innerHTML = "⠿"; // drag-style icon
  moveHandle.title = "Move video";
  moveHandle.setAttribute("aria-label", "Move video");

  const sizeIndicator = document.createElement("div");
  sizeIndicator.className = "size-indicator";

  // Close button with X icon
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.type = "button";
  closeBtn.innerHTML = "✕";
  closeBtn.title = "Close video";
  closeBtn.setAttribute("aria-label", "Close video");

  toolbar.appendChild(moveHandle);
  toolbar.appendChild(sizeIndicator);
  toolbar.appendChild(closeBtn);

  // ----- Content container -----
  const content = document.createElement("div");
  content.className = "video-content";

  if (options.type === "iframe") {
    const iframe = document.createElement("iframe");
    iframe.src = options.src;
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    );
    iframe.allowFullscreen = true;
    content.appendChild(iframe);
  } else if (options.type === "html") {
    content.innerHTML = options.html;
    // Ensure any iframe fills the container
    const anyIframe = content.querySelector("iframe, embed, video");
    if (anyIframe) {
      anyIframe.style.width = "100%";
      anyIframe.style.height = "100%";
      anyIframe.style.border = "none";
    }
  }

  // ----- Deletion confirmation overlay -----
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

  // ----- Resize handles (one in each corner) -----
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
}

// ==========================
// Window Events (Move / Resize / Close)
// ==========================

function attachWindowEvents(win) {
  const moveHandle = win.querySelector(".move-handle");
  const closeBtn = win.querySelector(".close-btn");
  const overlay = win.querySelector(".confirm-overlay");
  const confirmYes = overlay.querySelector(".confirm-yes");
  const confirmNo = overlay.querySelector(".confirm-no");
  const sizeIndicator = win.querySelector(".size-indicator");

  // Bring window to front when clicked
  win.addEventListener("mousedown", () => {
    win.style.zIndex = String(zCounter++);
  });

  // ----- Moving -----
  moveHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = win.getBoundingClientRect();

    activeAction = {
      type: "move",
      win,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };

    win.classList.add("moving");
  });

  // ----- Resizing -----
  const handles = win.querySelectorAll(".resize-handle");
  handles.forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const corner = handle.dataset.corner;
      const style = window.getComputedStyle(win);

      activeAction = {
        type: "resize",
        win,
        corner,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startLeft: parseFloat(style.left),
        startTop: parseFloat(style.top),
        startWidth: parseFloat(style.width),
        startHeight: parseFloat(style.height),
        aspect: parseFloat(win.dataset.aspectRatio) || 16 / 9,
      };

      win.classList.add("resizing");
      if (sizeIndicator) {
        sizeIndicator.textContent =
          Math.round(activeAction.startWidth) +
          " x " +
          Math.round(activeAction.startHeight);
      }
    });
  });

  // ----- Close / Confirm -----
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

    // If no videos remain, show the welcome screen again
    if (!workspace.querySelector(".video-window")) {
      if (welcome) {
        welcome.style.display = "";
      }
    }
  });
}

// ==========================
// Global Mouse Handlers
// ==========================

document.addEventListener("mousemove", (e) => {
  if (!activeAction) return;

  e.preventDefault();

  if (activeAction.type === "move") {
    const { win, offsetX, offsetY } = activeAction;
    const workspaceRect = workspace.getBoundingClientRect();

    let newLeft = e.clientX - offsetX - workspaceRect.left;
    let newTop = e.clientY - offsetY - workspaceRect.top;

    const style = window.getComputedStyle(win);
    const w = parseFloat(style.width);
    const h = parseFloat(style.height);
    const minVisible = 40;

    // Constrain so at least part of the window stays visible
    if (newLeft > workspaceRect.width - minVisible) {
      newLeft = workspaceRect.width - minVisible;
    }
    if (newTop > workspaceRect.height - minVisible) {
      newTop = workspaceRect.height - minVisible;
    }
    if (newLeft < -w + minVisible) {
      newLeft = -w + minVisible;
    }
    if (newTop < -h + minVisible) {
      newTop = -h + minVisible;
    }

    win.style.left = newLeft + "px";
    win.style.top = newTop + "px";
  }

  if (activeAction.type === "resize") {
    const s = activeAction;
    const { win, corner, startWidth, startHeight, startLeft, startTop, aspect } =
      s;

    const dx = e.clientX - s.startMouseX;
    let newWidth = startWidth;
    let newLeft = startLeft;
    let newTop = startTop;

    const minWidth = 220;

    if (corner.includes("e")) {
      newWidth = startWidth + dx;
    } else if (corner.includes("w")) {
      newWidth = startWidth - dx;
      newLeft = startLeft + dx;
    }

    if (newWidth < minWidth) {
      if (corner.includes("w")) {
        newLeft += newWidth - minWidth;
      }
      newWidth = minWidth;
    }

    const newHeight = newWidth / aspect;

    if (corner.includes("n")) {
      newTop = startTop + (startHeight - newHeight);
    } else {
      newTop = startTop;
    }

    win.style.width = newWidth + "px";
    win.style.height = newHeight + "px";
    win.style.left = newLeft + "px";
    win.style.top = newTop + "px";

    const sizeIndicator = win.querySelector(".size-indicator");
    if (sizeIndicator) {
      sizeIndicator.textContent =
        Math.round(newWidth) + " x " + Math.round(newHeight);
    }
  }
});

document.addEventListener("mouseup", () => {
  if (!activeAction) return;

  const { win, type } = activeAction;
  if (type === "move") {
    win.classList.remove("moving");
  }
  if (type === "resize") {
    win.classList.remove("resizing");
  }
  activeAction = null;
});