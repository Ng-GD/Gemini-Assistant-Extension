document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['geminiApiKey'], (data) => {
    if (data.geminiApiKey) {
      document.getElementById('api-key').value = data.geminiApiKey;
    }
  });
});

document.getElementById('save-btn').addEventListener('click', () => {
  const apiKey = document.getElementById('api-key').value.trim();
  const statusEl = document.getElementById('status');

  if (apiKey) {
    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
      statusEl.textContent = 'Options saved successfully!';
      statusEl.style.color = '#107c41'; 
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });
  } else {
    statusEl.textContent = 'Please enter a valid key.';
    statusEl.style.color = '#d13438'; 
  }
});