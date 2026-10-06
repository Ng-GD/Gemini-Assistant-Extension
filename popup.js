let currentImage = null; 
let chatHistory = [];
const EXPIRATION_TIME = 5 * 60 * 1000;

window.onload = () => {
  chrome.storage.local.get(['savedChat', 'timestamp', 'isGenerating'], (data) => {
    if (data.savedChat && data.timestamp) {
      const now = Date.now();
      if (now - data.timestamp < EXPIRATION_TIME) {
        chatHistory = data.savedChat;
        chatHistory.forEach(msg => {
          addMessage(msg.sender, msg.text, msg.type, msg.image, null, false);
        });
      } else {
        chrome.storage.local.remove(['savedChat', 'timestamp', 'isGenerating']);
      }
    }
    if (data.isGenerating) {
       addMessage('Gemini', 'Thinking...', 'bot', null, 'loading', false);
    }
  });
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generationComplete") {
     const loadingMsg = document.getElementById('loading');
     if (loadingMsg) loadingMsg.remove();
     
     if (request.error) {
         addMessage('System', request.error, 'system', null, null, false);
     } else {
         addMessage('Gemini', request.reply, 'bot', null, null, true);
     }
  }
});

document.getElementById('options-btn').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});

document.getElementById('clear-btn').addEventListener('click', () => {
  chatHistory = [];
  currentImage = null;
  chrome.storage.local.remove(['savedChat', 'timestamp', 'isGenerating']);
  document.getElementById('chat-container').innerHTML = '';
  addMessage('System', 'Chat history cleared.', 'system', null, null, false);
});

document.getElementById('paste-btn').addEventListener('click', async () => {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const clipboardItem of clipboardItems) {
      const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
      if (imageTypes.length > 0) {
        const blob = await clipboardItem.getType(imageTypes[0]);
        processImageFile(blob, "Clipboard Image");
        return;
      }
    }
    addMessage('System', 'No image found in clipboard.', 'system', null, null, false);
  } catch (err) {
    addMessage('System', 'Failed to read clipboard. Try using Ctrl+V / Cmd+V instead.', 'system', null, null, false);
  }
});

document.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      processImageFile(blob, "Pasted Image");
      return;
    }
  }
});

function processImageFile(file, sourceName) {
  const reader = new FileReader();
  reader.onload = (event) => {
    currentImage = event.target.result;
    addMessage('System', `Image "${sourceName}" attached! Ask a question about it or click Send.`, 'system', null, null, false);
  };
  reader.readAsDataURL(file);
}

document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const inputField = document.getElementById('user-input');
  const text = inputField.value.trim();

  if (!text && !currentImage) return;

  const imageToSend = currentImage; 
  currentImage = null; 

  const contents = [];
  
  chatHistory.forEach(msg => {
    if (msg.type === 'user' || msg.type === 'bot') {
       const msgText = msg.text ? msg.text : "[User attached an image]";
       contents.push({
         role: msg.type === 'user' ? 'user' : 'model',
         parts: [{ text: msgText }]
       });
    }
  });

  const currentParts = [];
  if (text) {
    currentParts.push({ text: text });
  } else if (imageToSend) {
    currentParts.push({ text: "Please extract the text from this image and describe what is happening." });
  }

  if (imageToSend) {
    const mimeType = imageToSend.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1];
    const base64Data = imageToSend.split(',')[1];
    currentParts.push({
      inline_data: { mime_type: mimeType, data: base64Data }
    });
  }

  contents.push({ role: "user", parts: currentParts });

  addMessage('You', text, 'user', imageToSend, null, true);
  inputField.value = '';
  addMessage('Gemini', 'Thinking...', 'bot', null, 'loading', false);

  chrome.runtime.sendMessage({
    action: "generateContent",
    contents: contents
  });
}

function formatText(text) {
  if (!text) return "";
  let formatted = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

function addMessage(sender, text, type, image = null, id = null, saveToHistory = true) {
  const container = document.getElementById('chat-container');
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${type}`;
  if (id) msgDiv.id = id;

  let html = ``;
  if (type !== 'system') html += `<strong>${sender}:</strong><br>`;
  
  if (text) {
    html += type === 'bot' ? formatText(text) : text;
  }
  
  if (image) {
    html += `<br><img src="${image}" class="image-preview">`;
  }
  
  msgDiv.innerHTML = html;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  if (saveToHistory) {
    chatHistory.push({ sender, text, type, image });
    chrome.storage.local.set({
      savedChat: chatHistory,
      timestamp: Date.now()
    });
  }
}