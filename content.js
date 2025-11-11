class FloatingWidget {
  constructor() {
    this.widget = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.isHidden = false;
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
        <button class="widget-hide">−</button>
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
      if (e.target.classList.contains('widget-hide') || 
          e.target.classList.contains('sync-button')) return;
      
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

    // Ocultar/mostrar
    this.widget.querySelector('.widget-hide').addEventListener('click', () => {
      this.toggleVisibility();
    });

    // Botão sincronizar
    this.widget.querySelector('.sync-button').addEventListener('click', () => {
      this.syncWithPopup();
    });
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
    if (this.isHidden) return;
    
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

  toggleVisibility() {
    this.isHidden = !this.isHidden;
    if (this.isHidden) {
      this.widget.classList.add('hidden');
      this.widget.querySelector('.widget-hide').textContent = '+';
    } else {
      this.widget.classList.remove('hidden');
      this.widget.querySelector('.widget-hide').textContent = '−';
      this.requestState(); // Atualizar display quando mostrar
    }
    this.saveVisibility();
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

  saveVisibility() {
    chrome.storage.local.set({
      widgetHidden: this.isHidden
    });
  }

  loadSettings() {
    chrome.storage.local.get(['widgetPosition', 'widgetHidden'], (data) => {
      if (data.widgetPosition) {
        this.widget.style.left = data.widgetPosition.x + 'px';
        this.widget.style.top = data.widgetPosition.y + 'px';
      }
      
      if (data.widgetHidden) {
        this.isHidden = true;
        this.widget.classList.add('hidden');
        this.widget.querySelector('.widget-hide').textContent = '+';
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