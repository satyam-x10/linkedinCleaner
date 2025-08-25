function shouldBlockPost(text) {
  return true; // for debugging, block everything
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

setInterval(() => {
  document.querySelectorAll("div.feed-shared-update-v2").forEach(post => {
    if (!post.dataset.filtered) {
      const text = post.innerText.toLowerCase();
      if (shouldBlockPost(text)) {
        hidePost(post, "Irrelevant/Off-topic");
      }
    }
  });
}, 2000);
