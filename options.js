document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');

  // Load existing API key
  chrome.storage.sync.get(['huggingface_api_key'], function(result) {
    if (result.huggingface_api_key) {
      apiKeyInput.value = result.huggingface_api_key;
    }
  });

  // Save button click handler
  saveBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', false);
      return;
    }

    if (!apiKey.startsWith('hf_')) {
      showStatus('Invalid API key format. Should start with "hf_"', false);
      return;
    }

    // Save to Chrome storage
    chrome.storage.sync.set({
      huggingface_api_key: apiKey
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        showStatus('Failed to save API key. Please try again.', false);
      } else {
        showStatus('Settings saved successfully!', true);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          hideStatus();
        }, 3000);
      }
    });
  });

  // Enter key support
  apiKeyInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });

  function showStatus(message, isSuccess) {
    statusEl.textContent = message;
    statusEl.className = `status ${isSuccess ? 'success' : 'error'}`;
  }

  function hideStatus() {
    statusEl.className = 'status';
    statusEl.textContent = '';
  }
});
