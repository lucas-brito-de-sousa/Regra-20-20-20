// Service worker para gerenciar o timer centralizado
class TimerManager {
  constructor() {
    this.workDuration = 20 * 60; // 20 minutos em segundos
    this.breakDuration = 20; // 20 segundos
    this.currentTime = 0;
    this.isBreakTime = false;
    this.isRunning = false;
    this.intervalId = null;
    this.startTimestamp = null;
    this.expectedTime = null;
    
    this.loadSettings();
    this.setupAlarms();
  }

  async loadSettings() {
    const data = await chrome.storage.local.get([
      'workTime', 
      'breakTime', 
      'isRunning',
      'timerState'
    ]);
    
    if (data.workTime) this.workDuration = data.workTime * 60;
    if (data.breakTime) this.breakDuration = data.breakTime;
    if (data.isRunning !== undefined) this.isRunning = data.isRunning;
    
    // Restaurar estado do timer se existir
    if (data.timerState && data.isRunning) {
      const state = data.timerState;
      const elapsed = Math.floor((Date.now() - state.timestamp) / 1000);
      this.currentTime = Math.max(0, state.currentTime - elapsed);
      this.isBreakTime = state.isBreakTime;
      
      if (this.currentTime > 0) {
        this.startTimerInternal();
      } else {
        this.handleTimerComplete();
      }
    } else if (this.isRunning) {
      this.start();
    }
  }

  setupAlarms() {
    chrome.alarms.create('timerTick', { periodInMinutes: 1/60 }); // 1 segundo
  }

  start(workTime = this.workDuration / 60, breakTime = this.breakDuration) {
    this.workDuration = workTime * 60;
    this.breakDuration = breakTime;
    this.currentTime = this.workDuration;
    this.isBreakTime = false;
    this.isRunning = true;
    
    this.saveSettings();
    this.startTimerInternal();
    this.broadcastState();
  }

  startTimerInternal() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.startTimestamp = Date.now();
    this.expectedTime = this.currentTime;
    
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  tick() {
    if (!this.isRunning) return;
    
    const elapsed = Math.floor((Date.now() - this.startTimestamp) / 1000);
    this.currentTime = Math.max(0, this.expectedTime - elapsed);
    
    this.saveTimerState();
    this.broadcastState();
    
    if (this.currentTime <= 0) {
      this.handleTimerComplete();
    }
  }

  handleTimerComplete() {
    if (!this.isBreakTime) {
      // Fim do tempo de trabalho, iniciar descanso
      this.isBreakTime = true;
      this.currentTime = this.breakDuration;
      this.showBreakNotification();
    } else {
      // Fim do descanso, reiniciar ciclo
      this.isBreakTime = false;
      this.currentTime = this.workDuration;
      this.showWorkNotification();
    }
    
    this.startTimestamp = Date.now();
    this.expectedTime = this.currentTime;
    this.broadcastState();
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.saveSettings();
    this.broadcastState();
  }

  reset() {
    this.stop();
    this.currentTime = this.workDuration;
    this.isBreakTime = false;
    this.broadcastState();
  }

  broadcastState() {
    const state = {
      currentTime: this.currentTime,
      isBreakTime: this.isBreakTime,
      isRunning: this.isRunning,
      workDuration: this.workDuration,
      breakDuration: this.breakDuration
    };
    
    // Enviar para todas as abas
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'timerUpdate',
          state: state
        }).catch(() => {}); // Ignorar erros em abas que não suportam content scripts
      });
    });
    
    // Enviar para popup se estiver aberto
    chrome.runtime.sendMessage({
      action: 'timerUpdate',
      state: state
    }).catch(() => {}); // Ignorar erro se popup não estiver aberto
  }

  saveSettings() {
    chrome.storage.local.set({
      workTime: this.workDuration / 60,
      breakTime: this.breakDuration,
      isRunning: this.isRunning
    });
  }

  saveTimerState() {
    if (this.isRunning) {
      chrome.storage.local.set({
        timerState: {
          currentTime: this.currentTime,
          isBreakTime: this.isBreakTime,
          timestamp: Date.now()
        }
      });
    }
  }

  showBreakNotification() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Hora do Descanso!',
      message: 'Olhe para algo a 20 pés de distância por 20 segundos'
    });
  }

  showWorkNotification() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Volte ao Trabalho!',
      message: 'Tempo de descanso terminou'
    });
  }

  getState() {
    return {
      currentTime: this.currentTime,
      isBreakTime: this.isBreakTime,
      isRunning: this.isRunning,
      workDuration: this.workDuration,
      breakDuration: this.breakDuration
    };
  }
}

// Instância global do gerenciador de timer
const timerManager = new TimerManager();

// Listeners de mensagens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startTimer':
      timerManager.start(request.workTime, request.breakTime);
      sendResponse(timerManager.getState());
      break;
      
    case 'stopTimer':
      timerManager.stop();
      sendResponse(timerManager.getState());
      break;
      
    case 'resetTimer':
      timerManager.reset();
      sendResponse(timerManager.getState());
      break;
      
    case 'getTimerState':
      sendResponse(timerManager.getState());
      break;
      
    case 'syncTimer':
      timerManager.broadcastState();
      sendResponse(timerManager.getState());
      break;
  }
  
  return true; // Manter a mensagem aberta para async
});

// Atualizar todas as abas quando uma nova aba é aberta
chrome.tabs.onCreated.addListener((tab) => {
  setTimeout(() => {
    timerManager.broadcastState();
  }, 1000);
});