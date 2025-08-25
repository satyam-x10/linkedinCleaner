const GEMINI_API_KEY = "meow"; // ⚠️ Replace with a new key later
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
  GEMINI_API_KEY;


// ==== Keep your existing GEMINI_API_KEY + GEMINI_API_URL lines above this ====
// const GEMINI_API_KEY = ".....";
// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + GEMINI_API_KEY;

// =======================
// State
// =======================
const decisionById = new Map();   // postId -> boolean (true = BLOCK, false = ALLOW)
const inFlight = new Set();       // postIds currently querying

// =======================
// Helpers
// =======================
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function getLinkedInPostId(postEl) {
  // 1) Common LinkedIn attributes
  const attrCandidates = ["data-urn", "data-id", "data-entity-urn", "data-activity-urn"];
  for (const a of attrCandidates) {
    const v = postEl.getAttribute(a);
    if (v) return v;
  }
  const anyAttrEl = postEl.querySelector("[data-urn],[data-id],[data-entity-urn],[data-activity-urn]");
  if (anyAttrEl) {
    for (const a of attrCandidates) {
      const v = anyAttrEl.getAttribute(a);
      if (v) return v;
    }
  }

  // 2) Try to parse from post links
  const link = postEl.querySelector('a[href*="activity"], a[href*="/posts/"]');
  if (link) {
    const href = link.getAttribute("href") || "";
    const m1 = href.match(/activity:(\d+)/i);
    if (m1) return "act:" + m1[1];
    const m2 = href.match(/\/posts\/([^/?#]+)/i);
    if (m2) return "post:" + m2[1];
    return "href:" + href;
  }

  // 3) Fallback: hash of text + first image
  const text = (postEl.innerText || "").slice(0, 200);
  const imgSrc = postEl.querySelector("img")?.src || "";
  return "hash:" + hashString(text + "|" + imgSrc);
}

// Ask Gemini if this post should be BLOCKED or ALLOWED
async function shouldBlockPost(text) {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  `You are a content filter for LinkedIn posts.\n` +
                  `If the text is irrelevant to the professional context, please filter it out.\n` +
                  `Only allow professional content and Hiring and Networking posts ,someone achieving career growth or sharing job opportunities.\n` +
                  `Strictly remove NEWS , politics, and personal opinions which feel like methods of content creation just for reach.\n` +
                  `Also remove posts that are purely promotional or not adding value to the professional community.\n` +
                  `Also remove posts that are advertisment and complaint such as Blinkit and any other delivery services.\n` +
                  `Dont remove posts that are relevant to professional development.\n` +
                  `Reply with ONLY one word: BLOCK or ALLOW.\n\n` +
                  `Post:\n${text}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const modelReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const verdict = modelReply.toUpperCase().startsWith("BLOCK");
    console.log("[OrmaFilter] Gemini:", verdict ? "BLOCK" : "ALLOW", "—", modelReply);
    return verdict;
  } catch (err) {
    console.error("[OrmaFilter ERROR]", err);
    return false; // fail open = ALLOW
  }
}

function hidePost(post, reason = "Filtered content") {
  if (post.dataset.filtered === "true") return; // already processed
  post.dataset.filtered = "true";

  // Store the original post separately
  const original = post.cloneNode(true);
  original.style.display = "none";

  const container = document.createElement("div");

  // Create placeholder
  const placeholder = document.createElement("div");
  placeholder.style.cssText = `
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    font-family: Arial, sans-serif;
    background: #f9fafb;
    color: #374151;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const text = document.createElement("span");
  text.textContent = `🚫 This post was hidden: ${reason}`;

  const button = document.createElement("button");
  button.textContent = "View Post";
  button.style.cssText = `
    background: #10b981;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  `;
  button.addEventListener("click", () => {
    placeholder.replaceWith(original);
    original.style.display = "block";
  });

  placeholder.appendChild(text);
  placeholder.appendChild(button);

  container.appendChild(placeholder);
  container.appendChild(original);

  post.replaceWith(container);
}

function applyDecision(post, postId, block) {
  if (post.dataset.filtered === "true") return; // already applied
  if (block) {
    hidePost(post, "Filtered by AI");
  } else {
    // Mark allowed so we don't reprocess
    post.dataset.filtered = "true";
  }
}

// =======================
// Scanner (uses ID + single fetch per post)
// =======================
async function processPost(post) {
  if (post.dataset.filtered === "true") return;

  const postId = getLinkedInPostId(post);
  if (!postId) return;

  // If we already have a decision for this postId, apply and exit
  if (decisionById.has(postId)) {
    applyDecision(post, postId, decisionById.get(postId));
    return;
  }

  // If a request is already in-flight for this postId, skip
  if (inFlight.has(postId)) return;

  const text = (post.innerText || "").trim();
  if (!text) {
    post.dataset.filtered = "true";
    return;
  }

  inFlight.add(postId);
  const block = await shouldBlockPost(text);
  inFlight.delete(postId);
  decisionById.set(postId, block);
  applyDecision(post, postId, block);
}

// Run every 2s (you can switch to MutationObserver later)
setInterval(() => {
  // Use LinkedIn feed item selector; adjust if needed
  const posts = document.querySelectorAll("div.feed-shared-update-v2");
  posts.forEach(p => processPost(p)); // fire-and-forget; each call awaits internally
}, 2000);
