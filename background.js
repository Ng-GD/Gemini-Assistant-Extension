chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateContent") {
    chrome.storage.local.set({ isGenerating: true });
    
    chrome.storage.local.get(['geminiApiKey'], (data) => {
      const apiKey = data.geminiApiKey;
      
      if (!apiKey) {
        finalizeGeneration(null, "API Key missing. Please click the ⚙️ icon to add your key.");
        return;
      }
      
      handleGeneration(request.contents, apiKey);
    });
  }
});

async function handleGeneration(contents, apiKey) {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    const data = await response.json();
    
    if (data.error) {
      finalizeGeneration(null, `API Error: ${data.error.message}`);
      return;
    }

    const reply = data.candidates[0].content.parts[0].text;
    finalizeGeneration(reply, null);

  } catch (error) {
     finalizeGeneration(null, 'Connection Error: ' + error.message);
  }
}

function finalizeGeneration(reply, errorText) {
   chrome.storage.local.set({ isGenerating: false });

   if (reply) {
     chrome.storage.local.get(['savedChat'], (storageData) => {
        const chatHistory = storageData.savedChat || [];
        chatHistory.push({ sender: 'Gemini', text: reply, type: 'bot', image: null });
        chrome.storage.local.set({ savedChat: chatHistory, timestamp: Date.now() });
     });
   }

   chrome.runtime.sendMessage({
     action: "generationComplete",
     reply: reply,
     error: errorText
   }).catch(() => {
     // Expected error if the popup is closed; data is already safely stored.
   });
}