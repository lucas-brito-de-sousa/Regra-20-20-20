class FloatingWidget {
  constructor() {
    this.widget = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.isMinimized = false;
    this.audio = null;
    this.volume = 0.5; // Volume padrão (50%)
    this.tooltip = null;
    this.syncTooltip = null;
    this.createWidget();
    this.loadSettings();
    this.setupMessageListener();
    this.setupAudio();
    this.createTooltips();
  }

  setupAudio() {
    // Criar elemento de áudio
    this.audio = new Audio(chrome.runtime.getURL('alert.mp3'));
    this.audio.preload = 'auto';
    this.audio.volume = this.volume;
    
    // Tentar carregar o áudio silenciosamente
    this.audio.load();
  }

  playAlertSound() {
    if (this.audio) {
      // Aplicar volume atual e tocar o som
      this.audio.volume = this.volume;
      this.audio.currentTime = 0;
      this.audio.play().catch(error => {
        console.log('Não foi possível tocar o som:', error);
      });
    }
  }

  updateVolume(volumePercent) {
    // Converter percentual (0-100) para volume (0.0-1.0)
    this.volume = volumePercent / 100;
    
    // Aplicar volume atual ao áudio se existir
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    
    // Salvar volume localmente
    this.saveVolume(volumePercent);
  }

  createTooltips() {
    // Criar tooltip para o botão toggle
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'widget-tooltip';
    this.tooltip.textContent = 'Minimizar';
    document.body.appendChild(this.tooltip);

    // Criar tooltip para o botão sync
    this.syncTooltip = document.createElement('div');
    this.syncTooltip.className = 'sync-tooltip';
    this.syncTooltip.textContent = 'Sincronizar com todas as abas';
    document.body.appendChild(this.syncTooltip);
  }

  createWidget() {
    this.widget = document.createElement('div');
    this.widget.id = 'eye-care-widget';
    this.widget.innerHTML = `
      <div class="widget-header">
        <span class="widget-title">Descanso Visual</span>
        <div class="widget-toggle-container">
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
    const toggleBtn = this.widget.querySelector('.widget-toggle');
    const syncBtn = this.widget.querySelector('.sync-button');

    // Tooltip para o botão toggle
    toggleBtn.addEventListener('mouseenter', (e) => {
      this.showTooltip(e.target, this.isMinimized ? 'Expandir' : 'Minimizar');
    });

    toggleBtn.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    // Tooltip para o botão sync
    syncBtn.addEventListener('mouseenter', (e) => {
      this.showSyncTooltip(e.target);
    });

    syncBtn.addEventListener('mouseleave', () => {
      this.hideSyncTooltip();
    });

    // Arrastar
    this.widget.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('widget-toggle') || 
          e.target.classList.contains('sync-button') ||
          e.target.closest('.widget-toggle-container')) return;
      
      this.isDragging = true;
      this.dragOffset.x = e.clientX - this.widget.getBoundingClientRect().left;
      this.dragOffset.y = e.clientY - this.widget.getBoundingClientRect().top;
      this.widget.style.cursor = 'grabbing';
      
      // Esconder tooltips durante o arrasto
      this.hideTooltip();
      this.hideSyncTooltip();
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
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    // Botão sincronizar
    syncBtn.addEventListener('click', () => {
      this.syncWithPopup();
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'timerUpdate') {
        this.updateDisplay(request.state);
      } else if (request.action === 'playAlertSound') {
        this.playAlertSound();
      } else if (request.action === 'updateVolume') {
        this.updateVolume(request.volume);
      }
    });
  }

  showTooltip(element, text) {
    if (!this.tooltip) return;
    
    const rect = element.getBoundingClientRect();
    this.tooltip.textContent = text;
    this.tooltip.style.opacity = '1';
    
    // Posicionar o tooltip acima do botão
    this.tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    this.tooltip.style.top = (rect.top - 10) + 'px';
    this.tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.opacity = '0';
    }
  }

  showSyncTooltip(element) {
    if (!this.syncTooltip) return;
    
    const rect = element.getBoundingClientRect();
    this.syncTooltip.style.opacity = '1';
    
    // Posicionar o tooltip acima do botão sync
    this.syncTooltip.style.left = (rect.left + rect.width / 2) + 'px';
    this.syncTooltip.style.top = (rect.top - 10) + 'px';
    this.syncTooltip.style.transform = 'translateX(-50%) translateY(-100%)';
  }

  hideSyncTooltip() {
    if (this.syncTooltip) {
      this.syncTooltip.style.opacity = '0';
    }
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    const toggleBtn = this.widget.querySelector('.widget-toggle');
    const content = this.widget.querySelector('.widget-content');
    
    if (this.isMinimized) {
      // Minimizar - esconder conteúdo
      content.style.display = 'none';
      this.widget.classList.add('minimized');
      toggleBtn.textContent = '▶';
    } else {
      // Expandir - mostrar conteúdo
      content.style.display = 'block';
      this.widget.classList.remove('minimized');
      toggleBtn.textContent = '▼';
    }
    
    this.saveMinimizeState();
  }

  requestState() {
    chrome.runtime.sendMessage({ action: 'getTimerState' }, (state) => {
      if (state) {
        this.updateDisplay(state);
      }
    });
  }

  updateDisplay(state) {
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

  saveVolume(volumePercent) {
    chrome.storage.local.set({
      alarmVolume: volumePercent
    });
  }

  loadSettings() {
    chrome.storage.local.get(['widgetPosition', 'widgetMinimized', 'alarmVolume'], (data) => {
      if (data.widgetPosition) {
        this.widget.style.left = data.widgetPosition.x + 'px';
        this.widget.style.top = data.widgetPosition.y + 'px';
      }
      
      if (data.widgetMinimized) {
        this.isMinimized = true;
        const content = this.widget.querySelector('.widget-content');
        const toggleBtn = this.widget.querySelector('.widget-toggle');
        content.style.display = 'none';
        this.widget.classList.add('minimized');
        toggleBtn.textContent = '▶';
      }

      // Carregar volume salvo
      if (data.alarmVolume !== undefined) {
        this.updateVolume(data.alarmVolume);
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