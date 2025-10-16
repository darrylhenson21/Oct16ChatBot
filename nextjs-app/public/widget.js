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

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = `${baseURL}/embed/${botId}?title=${encodeURIComponent(title)}`;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;
  iframe.setAttribute('allow', 'clipboard-write');

  container.appendChild(iframe);

  // Toggle chat visibility
  let isOpen = false;
  button.onclick = () => {
    isOpen = !isOpen;
    container.style.display = isOpen ? 'block' : 'none';
    button.innerText = isOpen ? 'Close' : 'Chat';
  };

  // Append to body when DOM is ready
  if (document.body) {
    document.body.appendChild(button);
    document.body.appendChild(container);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(button);
      document.body.appendChild(container);
    });
  }
})();
