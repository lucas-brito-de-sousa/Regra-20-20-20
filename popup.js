document.addEventListener('DOMContentLoaded', function() {
  const workTimeInput = document.getElementById('workTime');
  const breakTimeInput = document.getElementById('breakTime');
  const startStopBtn = document.getElementById('startStop');
  const resetBtn = document.getElementById('reset');
  const statusDiv = document.getElementById('status');
  const timerDisplay = document.getElementById('timerDisplay');

  // Carregar configurações e estado atual
  loadState();

  // Ouvir atualizações do timer em tempo real
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'timerUpdate') {
      updateTimerDisplay(request.state);
      updateUI(request.state.isRunning);
    }
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
  document.getElementById('syncAll').addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'syncTimer' });
  });

  function loadState() {
    // Carregar configurações salvas
    chrome.storage.local.get(['workTime', 'breakTime'], function(data) {
      workTimeInput.value = data.workTime || 20;
      breakTimeInput.value = data.breakTime || 20;
    });

    // Carregar estado atual do timer
    chrome.runtime.sendMessage({ action: 'getTimerState' }, function(state) {
      updateTimerDisplay(state);
      updateUI(state.isRunning);
    });
  }

  function updateTimerDisplay(state) {
    if (!timerDisplay) return;
    
    const minutes = Math.floor(state.currentTime / 60);
    const seconds = state.currentTime % 60;
    
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (state.isBreakTime) {
      timerDisplay.className = 'break-mode';
      statusDiv.textContent = 'Tempo de Descanso';
    } else {
      timerDisplay.className = '';
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