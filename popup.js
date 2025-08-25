const input = document.getElementById("keyword");
const addBtn = document.getElementById("add");
const list = document.getElementById("list");

function renderList(words) {
  list.innerHTML = "";
  words.forEach((word, i) => {
    const li = document.createElement("li");
    li.textContent = word;
    const delBtn = document.createElement("button");
    delBtn.textContent = "x";
    delBtn.onclick = () => {
      words.splice(i, 1);
      chrome.storage.sync.set({ blockedWords: words }, () => renderList(words));
    };
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

chrome.storage.sync.get(["blockedWords"], result => {
  renderList(result.blockedWords || []);
});

addBtn.onclick = () => {
  const newWord = input.value.trim();
  if (!newWord) return;
  chrome.storage.sync.get(["blockedWords"], result => {
    const words = result.blockedWords || [];
    words.push(newWord);
    chrome.storage.sync.set({ blockedWords: words }, () => renderList(words));
  });
  input.value = "";
};
