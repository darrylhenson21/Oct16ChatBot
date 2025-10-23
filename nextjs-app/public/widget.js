(function() {
  // Get the script tag that loaded this file
  const currentScript = document.currentScript;
  const scriptSrc = currentScript.src;
  const url = new URL(scriptSrc);
  const baseURL = url.origin;
  
  // Get bot configuration from script attributes
  const botId = currentScript.getAttribute('data-bot-id');
  const title = currentScript.getAttribute('data-title') || 'Chat';
  
  if (!botId) {
    console.error('Chatbot widget: data-bot-id attribute is required');
    return;
  }

  let requirePrechat = false;
  let leadData = null;
  let isOpen = false;

  // Check if bot requires pre-chat form
  async function checkPrechatRequirement() {
    try {
      const response = await fetch(`${baseURL}/api/bots/${botId}`);
      const data = await response.json();
      requirePrechat = data.require_prechat || false;
    } catch (error) {
      console.error('Failed to check pre-chat requirement:', error);
      requirePrechat = false;
    }
  }

  // Create chat button
  const button = document.createElement('button');
  button.innerText = 'Chat';
  button.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    background: #000;
    color: #fff;
    border: none;
    border-radius: 24px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
  `;
  
  button.onmouseenter = () => {
    button.style.transform = 'scale(1.05)';
    button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
  };
  
  button.onmouseleave = () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  };

  // Create chat container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 72px;
    width: 360px;
    height: 560px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    display: none;
    z-index: 999998;
  `;

  // Show pre-chat form
  function showPrechatForm() {
    container.innerHTML = `
      <div style="padding: 24px; height: 100%; display: flex; flex-direction: column; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h3 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1e293b;">Chat with us!</h3>
        <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px;">Please share your details to start the conversation.</p>
        <div>
          <input 
            type="text" 
            id="prechat-name" 
            placeholder="Your name" 
            style="width: 100%; padding: 12px 16px; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; font-family: inherit;"
            required
          />
          <input 
            type="email" 
            id="prechat-email" 
            placeholder="Your email" 
            style="width: 100%; padding: 12px 16px; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; font-family: inherit;"
            required
          />
          <div id="prechat-error" style="color: #ef4444; font-size: 12px; margin-bottom: 8px; display: none;"></div>
          <button 
            id="prechat-submit" 
            style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;"
          >
            Start Chat
          </button>
        </div>
      </div>
    `;

    const nameInput = document.getElementById('prechat-name');
    const emailInput = document.getElementById('prechat-email');
    const submitBtn = document.getElementById('prechat-submit');
    const errorDiv = document.getElementById('prechat-error');

    function validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    submitBtn.addEventListener('click', function() {
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();

      if (!name) {
        errorDiv.textContent = 'Please enter your name';
        errorDiv.style.display = 'block';
        return;
      }

      if (!email || !validateEmail(email)) {
        errorDiv.textContent = 'Please enter a valid email';
        errorDiv.style.display = 'block';
        return;
      }

      leadData = { name, email };
      errorDiv.style.display = 'none';
      loadChat();
    });

    // Allow Enter key to submit
    [nameInput, emailInput].forEach(input => {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          submitBtn.click();
        }
      });
    });
  }

  // Load chat iframe
  function loadChat() {
    let iframeUrl = `${baseURL}/embed/${botId}?title=${encodeURIComponent(title)}`;
    
    if (leadData) {
      iframeUrl += `&name=${encodeURIComponent(leadData.name)}&email=${encodeURIComponent(leadData.email)}`;
    }

    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = iframeUrl;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;
    iframe.setAttribute('allow', 'clipboard-write');
    container.appendChild(iframe);
  }

  // Toggle chat visibility
  button.onclick = () => {
    isOpen = !isOpen;
    container.style.display = isOpen ? 'block' : 'none';
    button.innerText = isOpen ? 'Close' : 'Chat';

    if (isOpen) {
      if (requirePrechat && !leadData) {
        showPrechatForm();
      } else {
        loadChat();
      }
    }
  };

  // Append to body when DOM is ready
  function init() {
    document.body.appendChild(button);
    document.body.appendChild(container);
    checkPrechatRequirement();
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
