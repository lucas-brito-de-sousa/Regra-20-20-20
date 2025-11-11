class FloatingWidget {
  constructor() {
    this.widget = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.isMinimized = false;
    this.createWidget();
    this.loadSettings();
    this.setupMessageListener();
  }

  createWidget() {
    this.widget = document.createElement('div');
    this.widget.id = 'eye-care-widget';
    this.widget.innerHTML = `
      <div class="widget-header">
        <span class="widget-title">Descanso Visual</span>
        <div class="widget-toggle-container" data-tooltip="Minimizar">
          <button class="widget-toggle">▼</button>
        </div>
      </div>
      <div class="widget-content">
        <div class="timer-display">--:--</div>
        <div class="status-message">Parado</div>
        <button class="sync-button">Sincronizar</button>
      </div>
    `;
    
    document.body.appendChild(this.widget);
    this.addEventListeners();
    this.requestState();
  }

  addEventListeners() {
    // Arrastar
    this.widget.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('widget-toggle') || 
          e.target.classList.contains('sync-button') ||
          e.target.closest('.widget-toggle-container')) return;
      
      this.isDragging = true;
      this.dragOffset.x = e.clientX - this.widget.getBoundingClientRect().left;
      this.dragOffset.y = e.clientY - this.widget.getBoundingClientRect().top;
      this.widget.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      this.widget.style.left = (e.clientX - this.dragOffset.x) + 'px';
      this.widget.style.top = (e.clientY - this.dragOffset.y) + 'px';
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.widget.style.cursor = 'grab';
      this.savePosition();
    });

    // Botão toggle minimizar/expandir
    this.widget.querySelector('.widget-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    // Botão sincronizar
    this.widget.querySelector('.sync-button').addEventListener('click', () => {
      this.syncWithPopup();
    });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    const toggleBtn = this.widget.querySelector('.widget-toggle');
    const toggleContainer = this.widget.querySelector('.widget-toggle-container');
    const content = this.widget.querySelector('.widget-content');
    
    if (this.isMinimized) {
      // Minimizar - esconder conteúdo
      content.style.display = 'none';
      this.widget.classList.add('minimized');
      toggleBtn.textContent = '▶'; // Seta para direita quando minimizado
      toggleContainer.setAttribute('data-tooltip', 'Expandir');
    } else {
      // Expandir - mostrar conteúdo
      content.style.display = 'block';
      this.widget.classList.remove('minimized');
      toggleBtn.textContent = '▼'; // Seta para baixo quando expandido
      toggleContainer.setAttribute('data-tooltip', 'Minimizar');
    }
    
    this.saveMinimizeState();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'timerUpdate') {
        this.updateDisplay(request.state);
      }
    });
  }

  requestState() {
    chrome.runtime.sendMessage({ action: 'getTimerState' }, (state) => {
      if (state) {
        this.updateDisplay(state);
      }
    });
  }

  updateDisplay(state) {
    // Atualizar mesmo quando minimizado (para quando expandir novamente)
    const timerDisplay = this.widget.querySelector('.timer-display');
    const statusMessage = this.widget.querySelector('.status-message');
    
    const minutes = Math.floor(state.currentTime / 60);
    const seconds = state.currentTime % 60;
    
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (state.isRunning) {
      if (state.isBreakTime) {
        statusMessage.textContent = 'Tempo de descanso!';
        this.widget.classList.add('break-mode');
      } else {
        statusMessage.textContent = 'Tempo de trabalho';
        this.widget.classList.remove('break-mode');
      }
    } else {
      statusMessage.textContent = 'Parado';
      this.widget.classList.remove('break-mode');
    }
  }

  syncWithPopup() {
    chrome.runtime.sendMessage({ action: 'syncTimer' });
    
    // Feedback visual
    const syncBtn = this.widget.querySelector('.sync-button');
    const originalText = syncBtn.textContent;
    syncBtn.textContent = '✓ Sincronizado';
    syncBtn.disabled = true;
    
    setTimeout(() => {
      syncBtn.textContent = originalText;
      syncBtn.disabled = false;
    }, 2000);
  }

  savePosition() {
    const rect = this.widget.getBoundingClientRect();
    chrome.storage.local.set({
      widgetPosition: {
        x: rect.left,
        y: rect.top
      }
    });
  }

  saveMinimizeState() {
    chrome.storage.local.set({
      widgetMinimized: this.isMinimized
    });
  }

  loadSettings() {
    chrome.storage.local.get(['widgetPosition', 'widgetMinimized'], (data) => {
      if (data.widgetPosition) {
        this.widget.style.left = data.widgetPosition.x + 'px';
        this.widget.style.top = data.widgetPosition.y + 'px';
      }
      
      if (data.widgetMinimized) {
        this.isMinimized = true;
        const content = this.widget.querySelector('.widget-content');
        const toggleBtn = this.widget.querySelector('.widget-toggle');
        const toggleContainer = this.widget.querySelector('.widget-toggle-container');
        content.style.display = 'none';
        this.widget.classList.add('minimized');
        toggleBtn.textContent = '▶';
        toggleContainer.setAttribute('data-tooltip', 'Expandir');
      }
    });
  }
}

// Inicializar widget quando a página carregar
let widget;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    widget = new FloatingWidget();
  });
} else {
  widget = new FloatingWidget();
}