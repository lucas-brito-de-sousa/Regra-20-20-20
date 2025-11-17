document.addEventListener('DOMContentLoaded', function() {
  const workTimeInput = document.getElementById('workTime');
  const breakTimeInput = document.getElementById('breakTime');
  const volumeSlider = document.getElementById('volume');
  const volumeValue = document.getElementById('volumeValue');
  const startStopBtn = document.getElementById('startStop');
  const resetBtn = document.getElementById('reset');
  const statusDiv = document.getElementById('status');
  const timerDisplay = document.getElementById('timerDisplay');
  const syncAllBtn = document.getElementById('syncAll');

  // Carregar configurações e estado atual
  loadState();

  // Ouvir atualizações do timer em tempo real
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'timerUpdate') {
      updateTimerDisplay(request.state);
      updateUI(request.state.isRunning);
    }
  });

  // Controle de volume
  volumeSlider.addEventListener('input', function() {
    const volume = parseInt(this.value);
    volumeValue.textContent = volume + '%';
    saveVolume(volume);
  });

  startStopBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'getTimerState'
    }, function(state) {
      if (state.isRunning) {
        // Parar timer
        chrome.runtime.sendMessage({ action: 'stopTimer' });
      } else {
        // Iniciar timer
        const workTime = parseInt(workTimeInput.value);
        const breakTime = parseInt(breakTimeInput.value);
        chrome.runtime.sendMessage({
          action: 'startTimer',
          workTime: workTime,
          breakTime: breakTime
        });
      }
    });
  });

  resetBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'resetTimer' });
  });

  // Sincronizar com todas as abas
  syncAllBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'syncTimer' });
  });

  function loadState() {
    // Carregar configurações salvas
    chrome.storage.local.get(['workTime', 'breakTime', 'alarmVolume'], function(data) {
      workTimeInput.value = data.workTime || 20;
      breakTimeInput.value = data.breakTime || 20;
      
      // Configurar volume
      const volume = data.alarmVolume || 50;
      volumeSlider.value = volume;
      volumeValue.textContent = volume + '%';
    });

    // Carregar estado atual do timer
    chrome.runtime.sendMessage({ action: 'getTimerState' }, function(state) {
      updateTimerDisplay(state);
      updateUI(state.isRunning);
    });
  }


  function saveVolume(volume) {
  chrome.storage.local.set({
    alarmVolume: volume
  });

  // Enviar volume atualizado apenas para a aba ativa
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateVolume',
        volume: volume
      }).catch(() => {
        // Se falhar na aba ativa, tentar em qualquer aba
        this.updateVolumeInAnyTab(volume);
      });
    } else {
      this.updateVolumeInAnyTab(volume);
    }
  });
}

function updateVolumeInAnyTab(volume) {
  // Fallback: atualizar volume em qualquer aba disponível
  chrome.tabs.query({}, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateVolume',
        volume: volume
      }).catch(() => {}); // Ignorar erro se não conseguir
    }
  });
}



  function updateTimerDisplay(state) {
    if (!timerDisplay) return;
    
    const minutes = Math.floor(state.currentTime / 60);
    const seconds = state.currentTime % 60;
    
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (state.isBreakTime) {
      timerDisplay.className = 'timer-display break-mode';
      statusDiv.textContent = 'Tempo de Descanso';
    } else {
      timerDisplay.className = 'timer-display';
      statusDiv.textContent = 'Tempo de Trabalho';
    }
  }

  function updateUI(isRunning) {
    if (isRunning) {
      startStopBtn.textContent = 'Parar';
      statusDiv.className = 'status active';
    } else {
      startStopBtn.textContent = 'Iniciar';
      statusDiv.className = 'status inactive';
    }
  }

  // Atualizar a cada segundo para manter sincronizado
  setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getTimerState' }, function(state) {
      updateTimerDisplay(state);
    });
  }, 1000);
});