document.addEventListener('DOMContentLoaded', function() {
  const fillButton = document.getElementById('fillButton');
  const optionsButton = document.getElementById('optionsButton');
  const status = document.getElementById('status');
  const apiStatus = document.getElementById('apiStatus');
  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  // Check API key status on popup open
  checkApiKeyStatus();

  function checkApiKeyStatus() {
    chrome.storage.sync.get(['huggingface_api_key'], function(result) {
      if (result.huggingface_api_key) {
        apiStatus.textContent = '✓ API Key configured';
        apiStatus.className = 'api-status api-connected';
      } else {
        apiStatus.textContent = '⚠ API Key required - Click Settings';
        apiStatus.className = 'api-status api-error';
      }
    });
  }

  fillButton.addEventListener('click', async function() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a Google Forms page
      if (!tab.url.includes('docs.google.com/forms')) {
        updateStatus('Please navigate to a Google Forms page', 'error');
        return;
      }

      // Check API key
      const result = await chrome.storage.sync.get(['huggingface_api_key']);
      if (!result.huggingface_api_key) {
        updateStatus('API Key required. Click Settings first.', 'error');
        return;
      }

      // Start processing
      setProcessingState(true);
      updateStatus('Analyzing questions...', '');
      showProgress(true);

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'fillFormWithAI',
        apiKey: result.huggingface_api_key
      });
      
      // Hide progress and show results
      showProgress(false);
      
      if (response && response.success) {
        updateStatus(`✓ Filled ${response.filled}/${response.total} questions correctly!`, 'success');
      } else {
        updateStatus(response?.message || 'Failed to process questions', 'error');
      }

    } catch (error) {
      console.error('Error:', error);
      updateStatus('Error: Make sure you\'re on a Google Forms page and try refreshing', 'error');
      showProgress(false);
    } finally {
      setProcessingState(false);
    }
  });

  optionsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Listen for progress updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateProgress') {
      updateProgressBar(request.current, request.total);
    }
  });

  function updateStatus(message, type) {
    status.textContent = message;
    status.className = type ? `status ${type}` : 'status';
  }

  function setProcessingState(processing) {
    fillButton.disabled = processing;
    fillButton.textContent = processing ? 'Processing...' : 'Fill with AI';
  }

  function showProgress(show) {
    progress.style.display = show ? 'block' : 'none';
    if (!show) {
      progressFill.style.width = '0%';
      progressText.textContent = '0/0';
    }
  }

  function updateProgressBar(current, total) {
    const percent = (current / total) * 100;
    progressFill.style.width = percent + '%';
    progressText.textContent = `${current}/${total}`;
  }
});
