'use strict';

const elements = {
  appShell: document.getElementById('appShell'),
  authOverlay: document.getElementById('authOverlay'),
  authError: document.getElementById('authError'),
  loginForm: document.getElementById('loginForm'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  coreStage: document.getElementById('coreStage'),
  coreMicButton: document.getElementById('coreMicButton'),
  coreMicCaption: document.getElementById('coreMicCaption'),
  stateLabel: document.getElementById('stateLabel'),
  stateHint: document.getElementById('stateHint'),
  systemState: document.getElementById('systemState'),
  microphoneStatus: document.getElementById('microphoneStatus'),
  backendStatus: document.getElementById('backendStatus'),
  ollamaStatus: document.getElementById('ollamaStatus'),
  recognitionSupport: document.getElementById('recognitionSupport'),
  permissionHint: document.getElementById('permissionHint'),
  wakeToggle: document.getElementById('wakeToggle'),
  wakeCaption: document.getElementById('wakeCaption'),
  brandName: document.getElementById('brandName'),
  authTitle: document.getElementById('authTitle'),
  helpSectionKicker: document.getElementById('helpSectionKicker'),
  voiceHelpText: document.getElementById('voiceHelpText'),
  systemHelpText: document.getElementById('systemHelpText'),
  activityList: document.getElementById('activityList'),
  taskList: document.getElementById('taskList'),
  taskCount: document.getElementById('taskCount'),
  responseLabel: document.getElementById('responseLabel'),
  responseTime: document.getElementById('responseTime'),
  responseText: document.getElementById('responseText'),
  recognizedText: document.getElementById('recognizedText'),
  liveClock: document.getElementById('liveClock'),
  liveDate: document.getElementById('liveDate'),
  providerName: document.getElementById('providerName'),
  modelName: document.getElementById('modelName'),
  hostInfo: document.getElementById('hostInfo'),
  connectionStatus: document.getElementById('connectionStatus'),
  modelHealth: document.getElementById('modelHealth'),
  topSignal: document.getElementById('topSignal'),
  topConnection: document.getElementById('topConnection'),
  stageLinkStatus: document.getElementById('stageLinkStatus'),
  networkList: document.getElementById('networkList'),
  deviceList: document.getElementById('deviceList'),
  deviceCount: document.getElementById('deviceCount'),
  commandForm: document.getElementById('commandForm'),
  commandInput: document.getElementById('commandInput'),
  micButton: document.getElementById('micButton'),
  sendButton: document.getElementById('sendButton'),
  dockState: document.getElementById('dockState'),
  dockIndicator: document.getElementById('dockIndicator'),
  dockMicStatus: document.getElementById('dockMicStatus'),
  historyDialog: document.getElementById('historyDialog'),
  historyList: document.getElementById('historyList'),
  helpDialog: document.getElementById('helpDialog'),
  voiceDialog: document.getElementById('voiceDialog'),
  voiceForm: document.getElementById('voiceForm'),
  assistantName: document.getElementById('assistantName'),
  voiceSelect: document.getElementById('voiceSelect'),
  rateRange: document.getElementById('rateRange'),
  pitchRange: document.getElementById('pitchRange'),
  rateValue: document.getElementById('rateValue'),
  pitchValue: document.getElementById('pitchValue'),
  toastRegion: document.getElementById('toastRegion'),
  ambientCanvas: document.getElementById('ambientCanvas')
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SESSION_STORAGE_KEY = 'personalAssistantSessionHistory';
const AUTH_STORAGE_KEY = 'personalAssistantAuthState';
let sessionHistory = [];
let activeProvider = '';
let assistantName = 'Jarvis';
let currentState = 'idle';
let activeRecognition = null;
let wakeRecognition = null;
let wakeEnabled = false;
let requestPending = false;
let toastSequence = 0;
let taskItems = [];
let offlineWakeFallback = false;

function setState(state, hint) {
  currentState = state;
  elements.coreStage.dataset.state = state;
  const labels = {
    idle: ['SYSTEM READY', 'Your local assistant is standing by.'],
    listening: ['LISTENING', 'Speak clearly. Speech recognition is provided by your browser and may require its online service.'],
    thinking: ['THINKING', 'Routing your request to the local Ollama model.'],
    speaking: ['SPEAKING', 'Response synthesized by your browser.'],
    error: ['ATTENTION REQUIRED', 'Check the system notification for details.']
  };
  const [label, defaultHint] = labels[state] || labels.idle;
  elements.stateLabel.textContent = label;
  elements.stateHint.textContent = hint || defaultHint;
  elements.systemState.textContent = state.toUpperCase();
  elements.dockState.textContent = state === 'idle' ? 'READY' : state.toUpperCase();
  elements.dockIndicator.style.background = state === 'error' ? 'var(--red)' : state === 'speaking' ? 'var(--green)' : 'var(--cyan)';
  elements.dockIndicator.style.boxShadow = state === 'error' ? '0 0 10px rgba(223,125,120,.55)' : '';
  elements.micButton.classList.toggle('is-active', state === 'listening');
  elements.coreMicButton.classList.toggle('is-active', state === 'listening');
  elements.micButton.setAttribute('aria-label', state === 'listening' ? 'Stop voice input' : state === 'speaking' ? 'Stop speaking' : 'Start voice input');
  elements.coreMicButton.setAttribute('aria-label', state === 'listening' ? 'Stop voice input' : state === 'speaking' ? 'Stop speaking' : 'Start voice input');
  elements.coreMicCaption.textContent = state === 'listening' ? 'LISTENING' : state === 'speaking' ? 'STOP SPEECH' : 'ACTIVATE VOICE';
  elements.micButton.title = state === 'listening' ? 'Stop voice input' : state === 'speaking' ? 'Stop speaking' : 'Start voice input';
  elements.coreMicButton.title = elements.micButton.title;
  elements.microphoneStatus.textContent = state === 'listening' ? 'LISTENING' : wakeEnabled ? 'WAKE ARMED' : 'STANDBY';
  elements.microphoneStatus.className = `telemetry-value${state === 'listening' ? '' : ''}`;
  elements.dockMicStatus.textContent = state === 'listening' ? 'MIC ACTIVE' : wakeEnabled ? 'WAKE ARMED' : 'MIC STANDBY';
  elements.sendButton.disabled = requestPending;
  elements.commandInput.disabled = requestPending;
  elements.micButton.disabled = requestPending && state !== 'speaking';
  elements.coreMicButton.disabled = requestPending && state !== 'speaking';
}

function showToast(title, message, isError = false, duration = 5200) {
  const toast = document.createElement('div');
  const id = ++toastSequence;
  toast.className = `toast${isError ? ' is-error' : ''}`;
  toast.dataset.toastId = String(id);
  const heading = document.createElement('span');
  heading.className = 'toast-title';
  heading.textContent = title.toUpperCase();
  const body = document.createElement('span');
  body.textContent = message;
  toast.append(heading, body);
  elements.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), duration);
}

function setServiceState(status, isError = false) {
  elements.backendStatus.textContent = status;
  elements.connectionStatus.textContent = status;
  elements.backendStatus.classList.toggle('is-error', isError);
  elements.backendStatus.classList.toggle('is-warning', !isError && status !== 'ONLINE');
  elements.topSignal.style.background = isError ? 'var(--red)' : status === 'ONLINE' ? 'var(--green)' : 'var(--amber)';
  elements.topSignal.style.boxShadow = isError ? '0 0 10px rgba(223,125,120,.65)' : '';
  elements.topConnection.textContent = isError ? 'LOCAL LINK OFFLINE' : status === 'ONLINE' ? 'LOCAL LINK ESTABLISHED' : 'ESTABLISHING LOCAL LINK';
  elements.stageLinkStatus.textContent = isError ? 'LINK OFFLINE' : status === 'ONLINE' ? 'LINK ESTABLISHED' : 'LINK STANDBY';
}

function setPermissionHint(message) {
  if (!elements.permissionHint) return;
  if (!message) {
    elements.permissionHint.hidden = true;
    elements.permissionHint.textContent = 'Microphone permission required: allow access in your browser site settings, then refresh.';
    return;
  }
  elements.permissionHint.hidden = false;
  elements.permissionHint.textContent = message;
}

function getWakePhraseMatch(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  const patterns = getWakeCommandPatterns();
  const match = patterns.find(({ regex }) => regex.test(input));
  if (!match) return null;

  const command = input
    .replace(new RegExp(`.*?${escapeRegExp(match.phrase)}`, 'i'), '')
    .replace(/^[\s,.:;!?-]+/, '')
    .trim();
  return { match, command };
}

function getUserAgentLabel() {
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Unknown platform';
  const browser = /Edg\//.test(navigator.userAgent) ? 'Edge' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : /Firefox\//.test(navigator.userAgent) ? 'Firefox' : /Safari\//.test(navigator.userAgent) ? 'Safari' : 'Browser';
  return `${platform} · ${browser}`;
}

function updateClock() {
  const now = new Date();
  elements.liveClock.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  elements.liveDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: '2-digit' }).format(now).toUpperCase();
}

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `Request failed (${response.status})`);
    }
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchStream(url, options, onText, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || `Request failed (${response.status})`);
    }
    if (!response.body) throw new Error('Streaming responses are not supported by this browser.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    const consumeLine = (line) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.error) throw new Error(event.error);
      if (typeof event.token === 'string') {
        text += event.token;
        onText(text);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(consumeLine);
      if (done) {
        consumeLine(buffer);
        break;
      }
    }
    return text;
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadSystemInfo() {
  try {
    const health = await fetchJson('/api/health', {}, 7000);
    activeProvider = String(health.provider || '').toLowerCase();
    elements.providerName.textContent = activeProvider ? activeProvider.toUpperCase() : 'UNKNOWN';
    elements.modelName.textContent = health.model || 'llama3.2:3b';
    elements.hostInfo.textContent = getUserAgentLabel();
    setServiceState('ONLINE');
    if (['ollama', 'local'].includes(activeProvider)) {
      elements.ollamaStatus.textContent = 'CONFIGURED';
      elements.ollamaStatus.className = 'telemetry-value';
      elements.modelHealth.textContent = 'LOCAL / CONFIGURED';
      elements.modelHealth.className = '';
    } else {
      elements.ollamaStatus.textContent = 'NOT SELECTED';
      elements.ollamaStatus.className = 'telemetry-value is-warning';
      elements.modelHealth.textContent = 'LOCAL / NOT SELECTED';
      elements.modelHealth.className = 'is-warning';
    }
  } catch (error) {
    activeProvider = '';
    setServiceState('OFFLINE', true);
    elements.ollamaStatus.textContent = 'UNREACHABLE';
    elements.ollamaStatus.className = 'telemetry-value is-error';
    elements.modelHealth.textContent = 'BACKEND UNAVAILABLE';
    elements.modelHealth.className = 'is-error';
    showToast('Backend unavailable', 'The FastAPI service did not respond. Start the local app and retry.', true);
  }
}

async function loadNetworkInfo() {
  try {
    const data = await fetchJson('/api/network');
    const urls = Array.isArray(data.urls) ? data.urls : [];
    elements.networkList.replaceChildren();
    if (!urls.length) {
      const note = document.createElement('span');
      note.className = 'muted-copy';
      note.textContent = 'No local network address reported.';
      elements.networkList.appendChild(note);
      return;
    }
    urls.forEach((address) => {
      const linkUrl = new URL(address, window.location.origin);
      if (window.location.port) linkUrl.port = window.location.port;
      const link = document.createElement('a');
      link.className = 'network-link';
      link.href = linkUrl.href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = linkUrl.href;
      elements.networkList.appendChild(link);
    });
  } catch {
    elements.networkList.textContent = 'Network information unavailable.';
  }
}

function renderDevices(devices) {
  elements.deviceList.replaceChildren();
  elements.deviceCount.textContent = String(devices.length).padStart(2, '0');
  if (!devices.length) {
    const empty = document.createElement('span');
    empty.className = 'muted-copy';
    empty.textContent = 'No devices reported.';
    elements.deviceList.appendChild(empty);
    return;
  }
  devices.forEach((device) => {
    const card = document.createElement('article');
    card.className = 'device-card';
    const main = document.createElement('div');
    main.className = 'device-main';
    const name = document.createElement('div');
    name.className = 'device-name';
    name.textContent = device.name || device.id || 'Unknown device';
    const meta = document.createElement('div');
    meta.className = 'device-meta';
    meta.textContent = `${device.type || 'Device'} · ${device.last_seen || 'Unknown'}`;
    main.append(name, meta);
    const state = document.createElement('span');
    state.className = `device-state${device.online ? '' : ' offline'}`;
    state.textContent = device.online ? 'ONLINE' : 'OFFLINE';
    const actions = document.createElement('div');
    actions.className = 'device-actions';
    [true, false].forEach((approved) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `device-action${device.approved === approved ? ' is-approved' : ''}`;
      button.dataset.deviceId = device.id;
      button.dataset.approved = String(approved);
      button.textContent = approved ? 'ALLOW' : 'BLOCK';
      button.setAttribute('aria-label', `${approved ? 'Allow' : 'Block'} ${device.name || device.id}`);
      actions.appendChild(button);
    });
    card.append(main, state, actions);
    elements.deviceList.appendChild(card);
  });
}

async function loadDevices() {
  try {
    const data = await fetchJson('/api/devices');
    renderDevices(Array.isArray(data.devices) ? data.devices : []);
  } catch {
    elements.deviceList.textContent = 'Device list unavailable.';
    elements.deviceCount.textContent = '--';
  }
}

async function authorizeDevice(deviceId, approved) {
  try {
    await fetchJson('/api/devices/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, approved })
    });
    await loadDevices();
    showToast('Device updated', `${deviceId} access ${approved ? 'allowed' : 'blocked'}.`);
  } catch (error) {
    showToast('Device update failed', error.message, true);
  }
}

function addActivity(command, source = 'TEXT') {
  const item = { command, source, time: new Date() };
  const row = document.createElement('li');
  const text = document.createElement('span');
  text.className = 'activity-command';
  text.textContent = command;
  const meta = document.createElement('div');
  meta.className = 'activity-meta';
  const tag = document.createElement('span');
  tag.className = 'activity-tag';
  tag.textContent = source;
  const time = document.createElement('time');
  time.className = 'activity-time';
  time.dateTime = item.time.toISOString();
  time.textContent = item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.append(tag, time);
  row.append(text, meta);
  const empty = elements.activityList.querySelector('.activity-empty');
  if (empty) empty.remove();
  elements.activityList.prepend(row);
  while (elements.activityList.children.length > 5) elements.activityList.lastElementChild.remove();
}

function saveSessionHistory() {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionHistory.slice(-40)));
  } catch {
    // Ignore storage failures so the UI keeps operating even when local storage is blocked.
  }
}

function loadSessionHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '[]');
    sessionHistory = Array.isArray(saved)
      ? saved
          .filter((entry) => entry && typeof entry.role === 'string' && typeof entry.content === 'string')
          .map((entry) => ({
            role: entry.role,
            content: entry.content,
            time: new Date(entry.time || Date.now())
          }))
          .filter((entry) => !Number.isNaN(entry.time.getTime()))
      : [];
  } catch {
    sessionHistory = [];
  }
  renderHistory();
}

function addHistoryEntry(role, content) {
  const entry = { role, content, time: new Date() };
  sessionHistory.push(entry);
  saveSessionHistory();
  renderHistory();
}

function saveAuthState(userName) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ authenticated: true, userName: userName || 'User' }));
  } catch {
    // Ignore storage failures so the app remains usable even without browser persistence.
  }
}

function loadAuthState() {
  try {
    const state = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
    if (!state || state.authenticated !== true) return null;
    return { userName: String(state.userName || 'User') };
  } catch {
    return null;
  }
}

function applyAuthState(userName) {
  const name = userName || 'User';
  elements.authOverlay.classList.add('is-hidden');
  elements.authOverlay.setAttribute('aria-hidden', 'true');
  elements.appShell.setAttribute('aria-hidden', 'false');
  elements.topConnection.textContent = `LOCAL SESSION · ${name.toUpperCase()}`;
  saveAuthState(name);
  if (SpeechRecognition && !wakeEnabled && !activeRecognition && !requestPending) {
    window.setTimeout(() => {
      if (!wakeEnabled && !activeRecognition && !requestPending) {
        startWakeListener();
      }
    }, 400);
  }
}

function renderHistory() {
  elements.historyList.replaceChildren();
  if (!sessionHistory.length) {
    const empty = document.createElement('p');
    empty.className = 'muted-copy';
    empty.textContent = 'No commands in this session yet.';
    elements.historyList.appendChild(empty);
    return;
  }
  [...sessionHistory].reverse().forEach((entry) => {
    const row = document.createElement('article');
    row.className = 'history-entry';
    row.dataset.role = entry.role;
    const heading = document.createElement('div');
    heading.className = 'history-entry-head';
    const role = document.createElement('span');
    role.textContent = entry.role === 'user' ? 'COMMAND' : 'JARVIS';
    const time = document.createElement('time');
    const safeTime = entry.time instanceof Date ? entry.time : new Date(entry.time || Date.now());
    time.textContent = Number.isNaN(safeTime.getTime())
      ? 'NOW'
      : safeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = document.createElement('p');
    text.textContent = entry.content;
    heading.append(role, time);
    row.append(heading, text);
    elements.historyList.appendChild(row);
  });
}

function renderTasks() {
  elements.taskList.replaceChildren();
  elements.taskCount.textContent = String(taskItems.filter((task) => !task.done).length).padStart(2, '0');
  if (!taskItems.length) {
    const empty = document.createElement('li');
    empty.className = 'task-empty';
    empty.textContent = 'No tasks saved.';
    elements.taskList.appendChild(empty);
    return;
  }
  taskItems.forEach((task, index) => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.className = `task-label${task.done ? ' is-done' : ''}`;
    label.textContent = `${index + 1}. ${task.text}`;
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    if (!task.done) {
      const complete = document.createElement('button');
      complete.type = 'button';
      complete.className = 'task-action';
      complete.dataset.taskAction = 'complete';
      complete.dataset.taskIndex = String(index);
      complete.textContent = 'DONE';
      complete.setAttribute('aria-label', `Complete task ${index + 1}`);
      actions.appendChild(complete);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'task-action';
    remove.dataset.taskAction = 'delete';
    remove.dataset.taskIndex = String(index);
    remove.textContent = 'REMOVE';
    remove.setAttribute('aria-label', `Delete task ${index + 1}`);
    actions.appendChild(remove);
    row.append(label, actions);
    elements.taskList.appendChild(row);
  });
}

function saveTasks() {
  try {
    localStorage.setItem('personalAssistantTasks', JSON.stringify(taskItems));
  } catch {
    showToast('Tasks not saved', 'Browser storage is unavailable; tasks will be lost when this page closes.', true);
  }
  renderTasks();
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem('personalAssistantTasks') || '[]');
    taskItems = Array.isArray(saved)
      ? saved.filter((task) => task && typeof task.text === 'string' && typeof task.done === 'boolean')
      : [];
  } catch {
    taskItems = [];
  }
  renderTasks();
}

function handleTaskCommand(message) {
  const addMatch = message.match(/^(?:add|create)\s+(?:a\s+)?(?:task|todo)(?:\s+(?:to|called))?\s*[:,-]?\s*(.+)$/i);
  if (addMatch) {
    const text = addMatch[1].trim();
    if (!text) return 'Tell me what to add, for example: “add task to call Sam.”';
    taskItems.push({ text, done: false });
    saveTasks();
    return `Added task ${taskItems.length}: ${text}`;
  }

  if (/^(?:(?:show|list|read)\s+(?:(?:me|my)\s+)*(?:tasks|todos)|what(?:'s| is)\s+on\s+my\s+task\s+list)$/i.test(message)) {
    if (!taskItems.length) return 'Your task list is empty.';
    return taskItems.map((task, index) => `${index + 1}. ${task.done ? 'Done' : 'Open'}: ${task.text}`).join('\n');
  }

  const completeMatch = message.match(/^(?:complete|finish|mark|check off)\s+(?:task\s+)?(\d+)(?:\s+(?:done|as complete))?$/i);
  if (completeMatch) {
    const index = Number(completeMatch[1]) - 1;
    if (!taskItems[index]) return `I could not find task ${completeMatch[1]}. Say “show my tasks” to see the list.`;
    taskItems[index].done = true;
    saveTasks();
    return `Completed task ${index + 1}: ${taskItems[index].text}`;
  }

  const deleteMatch = message.match(/^(?:delete|remove)\s+(?:task\s+)?(\d+)$/i);
  if (deleteMatch) {
    const index = Number(deleteMatch[1]) - 1;
    if (!taskItems[index]) return `I could not find task ${deleteMatch[1]}. Say “show my tasks” to see the list.`;
    const [removed] = taskItems.splice(index, 1);
    saveTasks();
    return `Deleted task ${deleteMatch[1]}: ${removed.text}`;
  }
  return null;
}

function setResponse(text, label = `${assistantName.toUpperCase()} RESPONSE`, elapsed = '—') {
  elements.responseText.textContent = text;
  elements.responseLabel.textContent = label;
  elements.responseTime.textContent = elapsed;
}

function formatElapsedTime(milliseconds) {
  const seconds = Math.max(0, milliseconds) / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getWakeCommandPatterns() {
  const names = [];
  const cleanName = (assistantName || 'Jarvis').trim();
  if (cleanName) {
    names.push(cleanName);
    names.push(`hey ${cleanName}`);
    names.push(`hello ${cleanName}`);
    names.push(`wake up ${cleanName}`);
    names.push(`hey ${cleanName.toLowerCase()}`);
    names.push(`hello ${cleanName.toLowerCase()}`);
    names.push(`wake up ${cleanName.toLowerCase()}`);
  }
  names.push('Jarvis');
  names.push('hey Jarvis');
  names.push('hello Jarvis');
  names.push('wake up Jarvis');
  return [...new Set(names.filter(Boolean))].map((phrase) => ({
    phrase,
    regex: new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$|[.!?,:;])`, 'i')
  }));
}

function describeChatError(error) {
  if (error.name === 'AbortError') {
    return ['Request timed out', 'The local model did not respond within 120 seconds. Check Ollama and try again.'];
  }
  const detail = String(error.message || '').toLowerCase();
  if (error instanceof TypeError || /failed to fetch|networkerror/.test(detail)) {
    return ['Backend unavailable', 'The browser could not reach FastAPI. Check that the local server is running.'];
  }
  if (/ollama|model.+not found|connection refused|connecterror|assistant failed|no such file/.test(detail)) {
    return ['Ollama unavailable', error.message || 'The local model could not be reached. Check that Ollama is running and llama3.2:3b is installed.'];
  }
  return ['Request failed', error.message || 'The assistant could not complete this request.'];
}

function speakResponse(text) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    setState('idle', 'Response ready. Speech synthesis is not available in this browser.');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((item) => item.name === elements.voiceSelect.value);
  if (voice) utterance.voice = voice;
  utterance.rate = Number(elements.rateRange.value);
  utterance.pitch = Number(elements.pitchRange.value);
  utterance.volume = 1;
  utterance.onstart = () => setState('speaking');
  utterance.onend = () => {
    setState('idle');
    if (wakeEnabled) window.setTimeout(startVoiceInput, 250);
  };
  utterance.onerror = (event) => {
    setState('idle');
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      showToast('Speech output unavailable', 'The response is visible, but browser speech synthesis failed.', true);
    }
    if (wakeEnabled) window.setTimeout(startVoiceInput, 250);
  };
  window.speechSynthesis.cancel();
  setState('speaking');
  window.speechSynthesis.speak(utterance);
}

async function sendMessage(value, source = 'TEXT') {
  const message = String(value ?? elements.commandInput.value).trim();
  if (!message || requestPending) return;

  const wakeMatch = getWakePhraseMatch(message);
  if (wakeMatch && source === 'TEXT') {
    const wakeText = wakeMatch.command || '';
    if (wakeText) {
      elements.commandInput.value = '';
      elements.recognizedText.textContent = message;
      return sendMessage(wakeText, 'OFFLINE_WAKE');
    }
    const greeting = `Hello. I am ${assistantName}. How can I help you today?`;
    elements.commandInput.value = '';
    elements.recognizedText.textContent = message;
    addHistoryEntry('user', message);
    addHistoryEntry('assistant', greeting);
    setResponse(greeting, `${assistantName.toUpperCase()} RESPONSE`);
    speakResponse(greeting);
    return;
  }

  const taskReply = handleTaskCommand(message);
  if (taskReply) {
    if (wakeRecognition) pauseWakeListener();
    elements.commandInput.value = '';
    elements.recognizedText.textContent = message;
    addActivity(message, source);
    addHistoryEntry('user', message);
    addHistoryEntry('assistant', taskReply);
    setResponse(taskReply, 'TASK LIST');
    speakResponse(taskReply);
    return;
  }
  if (activeProvider && !['ollama', 'local'].includes(activeProvider)) {
    showToast('Local model required', `No request was sent. Select Ollama in the local configuration; this interface does not call OpenAI.`, true);
    elements.ollamaStatus.textContent = 'NOT SELECTED';
    elements.ollamaStatus.className = 'telemetry-value is-warning';
    return;
  }

  if (wakeRecognition) pauseWakeListener();
  elements.commandInput.value = '';
  elements.recognizedText.textContent = message;
    if (source !== 'TEXT') elements.recognitionSupport.textContent = 'VOICE INPUT READY';
  addActivity(message, source);
  addHistoryEntry('user', message);
  const historyForRequest = sessionHistory.filter((entry) => entry.role === 'user' || entry.role === 'assistant').slice(0, -1).map(({ role, content }) => ({ role, content }));
  requestPending = true;
  setState('thinking');
  const responseStartedAt = performance.now();
  elements.responseTime.textContent = 'GENERATING';
  const responseTimer = window.setInterval(() => {
    elements.responseTime.textContent = `${formatElapsedTime(performance.now() - responseStartedAt)} …`;
  }, 100);

  try {
    const systemPrompt = `You are ${assistantName}, the user's personal AI assistant. Keep replies brief, warm, and useful. Respond naturally and helpfully when the user says "Hey ${assistantName}" or uses their name. If a task is risky or sensitive, ask for confirmation first.`;
    const replyText = await fetchStream('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: historyForRequest, system_prompt: systemPrompt })
    }, (text) => setResponse(text, `${assistantName.toUpperCase()} RESPONSE`, formatElapsedTime(performance.now() - responseStartedAt)), 120000);
    const reply = String(replyText || 'I do not have a reply yet.');
    addHistoryEntry('assistant', reply);
    setResponse(reply, `${assistantName.toUpperCase()} RESPONSE`, formatElapsedTime(performance.now() - responseStartedAt));
    if (['ollama', 'local'].includes(activeProvider)) {
      elements.ollamaStatus.textContent = 'RESPONDED';
      elements.ollamaStatus.className = 'telemetry-value';
      elements.modelHealth.textContent = 'LOCAL / RESPONDED';
      elements.modelHealth.className = '';
    }
    requestPending = false;
    setState('speaking');
    speakResponse(reply);
  } catch (error) {
    const [title, messageText] = describeChatError(error);
    setResponse(messageText, title.toUpperCase(), formatElapsedTime(performance.now() - responseStartedAt));
    const ollamaError = title === 'Ollama unavailable';
    if (ollamaError) {
      elements.ollamaStatus.textContent = 'UNAVAILABLE';
      elements.ollamaStatus.className = 'telemetry-value is-error';
      elements.modelHealth.textContent = 'OLLAMA / OFFLINE';
      elements.modelHealth.className = 'is-error';
    } else if (title === 'Backend unavailable') {
      setServiceState('OFFLINE', true);
    }
    showToast(title, messageText, true, 7000);
    requestPending = false;
    setState('error');
    window.setTimeout(() => {
      if (currentState === 'error') setState('idle');
    }, 4500);
  } finally {
    window.clearInterval(responseTimer);
    requestPending = false;
    elements.sendButton.disabled = false;
    elements.commandInput.disabled = false;
    elements.micButton.disabled = false;
  }
}

function stopActiveRecognition() {
  if (!activeRecognition) return;
  const recognition = activeRecognition;
  activeRecognition = null;
    try { recognition.stop(); } catch {}
}

function getSpeechLanguage() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const selectedVoice = voices.find((voice) => voice.name === elements.voiceSelect.value);
  return selectedVoice?.lang || navigator.language || 'en-US';
}

function startVoiceInput() {
  if (!SpeechRecognition) {
    offlineWakeFallback = true;
    elements.microphoneStatus.textContent = 'UNAVAILABLE';
    elements.microphoneStatus.className = 'telemetry-value is-error';
    elements.recognitionSupport.textContent = 'OFFLINE FALLBACK ACTIVE';
    setPermissionHint('Voice recognition is unavailable in this browser. Type “Hey Atlas” in the command box to keep using the assistant offline.');
    showToast('Microphone unavailable', 'This browser does not support speech recognition. Use typed commands or switch to Chrome/Edge with microphone access.', true);
    return;
  }
  if (requestPending) return;
  if (currentState === 'speaking' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    setState('idle');
    return;
  }
  if (activeRecognition) {
    stopActiveRecognition();
    setState('idle');
    return;
  }
  if (wakeRecognition) stopWakeListener();

  const recognition = new SpeechRecognition();
  activeRecognition = recognition;
  let submitted = false;
  let failed = false;
  recognition.lang = getSpeechLanguage();
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    setState('listening');
    elements.recognitionSupport.textContent = 'MICROPHONE ACTIVE · LISTENING';
  };
  recognition.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || '';
      if (event.results[index].isFinal) finalText += transcript;
      else interim += transcript;
    }
    const visibleText = `${finalText} ${interim}`.trim();
    if (visibleText) elements.recognizedText.textContent = visibleText;
    if (finalText.trim() && !submitted) {
      submitted = true;
      const command = finalText.trim();
      activeRecognition = null;
      try { recognition.stop(); } catch {}
      void sendMessage(command, 'VOICE');
    }
  };
  recognition.onerror = (event) => {
    failed = true;
    activeRecognition = null;
    if (event.error === 'no-speech' && wakeEnabled) {
      setState('idle');
      window.setTimeout(startWakeListener, 250);
      return;
    }
    const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'Microphone permission required: allow access in your browser site settings, then try again. Offline text fallback is active until permissions are enabled.'
      : event.error === 'audio-capture'
        ? 'No working microphone was detected on this device.'
        : event.error === 'no-speech'
          ? 'No speech was detected. Try again when you are ready.'
          : event.error === 'network'
            ? 'The browser speech service is unavailable. Use text entry or retry when speech recognition can reach its service.'
          : 'Speech recognition stopped unexpectedly. Check microphone access and retry.';
    elements.recognitionSupport.textContent = event.error === 'not-allowed' ? 'MICROPHONE PERMISSION DENIED' : 'VOICE INPUT INTERRUPTED';
    offlineWakeFallback = true;
    setPermissionHint('Offline fallback is active: type “Hey Atlas” in the command box to keep using the assistant without the browser mic.');
    showToast(event.error === 'audio-capture' ? 'Microphone unavailable' : 'Speech recognition failed', message, true);
    setState('error');
  };
  recognition.onend = () => {
    if (activeRecognition === recognition) activeRecognition = null;
    if (!submitted && !failed && currentState === 'listening') {
      setState('idle');
      if (wakeEnabled) window.setTimeout(startWakeListener, 250);
    }
  };
  try {
    recognition.start();
  } catch {
    activeRecognition = null;
    showToast('Microphone unavailable', 'The browser could not start speech recognition. Check permissions and retry.', true);
    setState('idle');
  }
}

function stopWakeListener() {
  wakeEnabled = false;
  elements.wakeToggle.setAttribute('aria-checked', 'false');
  elements.wakeToggle.setAttribute('aria-label', 'Enable wake phrase listening');
  if (wakeRecognition) {
    const recognition = wakeRecognition;
    wakeRecognition = null;
    try { recognition.stop(); } catch {}
  }
  if (currentState !== 'listening' && currentState !== 'thinking' && currentState !== 'speaking') setState('idle');
}

function pauseWakeListener() {
  if (!wakeRecognition) return;
  const recognition = wakeRecognition;
  wakeRecognition = null;
  try { recognition.stop(); } catch {}
}

function startWakeListener() {
  if (!SpeechRecognition) {
    offlineWakeFallback = true;
    setPermissionHint('Offline fallback is active: type “Hey Atlas” in the command box to keep using the assistant without the browser mic.');
    showToast('Wake phrase unavailable', 'Speech recognition is not supported in this browser. Type your wake command instead.', true);
    return;
  }
  if (wakeRecognition || activeRecognition) return;
  wakeEnabled = true;
  elements.wakeToggle.setAttribute('aria-checked', 'true');
  elements.wakeToggle.setAttribute('aria-label', 'Disable wake phrase listening');
  const recognition = new SpeechRecognition();
  wakeRecognition = recognition;
  recognition.lang = getSpeechLanguage();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim();
    const patterns = getWakeCommandPatterns();
    const match = patterns.find(({ regex }) => regex.test(transcript));
    if (!match) return;

    const command = transcript
      .replace(new RegExp(`.*?${escapeRegExp(match.phrase)}`, 'i'), '')
      .replace(/^[\s,.:;!?-]+/, '')
      .trim();

    pauseWakeListener();
    if (command) {
      elements.recognizedText.textContent = transcript;
      void sendMessage(command, 'WAKE PHRASE');
    } else {
      const wakeLabel = match.phrase.includes('hey') || match.phrase.includes('hello') ? 'Hello' : 'Wake up';
      const greeting = `${wakeLabel}. I am ${assistantName}. How can I help you today?`;
      elements.recognizedText.textContent = match.phrase;
      setResponse(greeting);
      speakResponse(greeting);
    }
  };
  recognition.onerror = (event) => {
    if (wakeRecognition !== recognition) return;
    wakeRecognition = null;
    wakeEnabled = false;
    elements.wakeToggle.setAttribute('aria-checked', 'false');
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      offlineWakeFallback = true;
      setPermissionHint('Offline fallback is active: type “Hey Atlas” in the command box to keep using the assistant without the browser mic.');
      showToast('Wake phrase permission denied', 'Allow microphone access in browser settings to enable hands-free listening.', true);
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      offlineWakeFallback = true;
      setPermissionHint('Offline fallback is active: type “Hey Atlas” in the command box to keep using the assistant without the browser mic.');
      showToast('Wake phrase stopped', 'Browser speech recognition could not stay active.', true);
    }
    setState('idle');
  };
  recognition.onend = () => {
    if (wakeRecognition === recognition) wakeRecognition = null;
    if (wakeEnabled && !activeRecognition && !requestPending && currentState !== 'speaking') {
      window.setTimeout(startWakeListener, 450);
    }
  };
  try {
    recognition.start();
  } catch {
    wakeRecognition = null;
    wakeEnabled = false;
    elements.wakeToggle.setAttribute('aria-checked', 'false');
    showToast('Wake phrase unavailable', 'The browser could not start continuous microphone recognition.', true);
  }
}

function updateAssistantIdentity() {
  const name = (assistantName || 'Jarvis').trim() || 'Jarvis';
  const displayName = name.toUpperCase();

  if (elements.brandName) elements.brandName.textContent = displayName;
  if (elements.responseLabel) elements.responseLabel.textContent = `${displayName} RESPONSE`;
  if (elements.authTitle) {
    const authTitle = document.getElementById('authTitle');
    if (authTitle) {
      const labelText = document.createTextNode(displayName);
      const period = document.createElement('span');
      period.className = 'auth-period';
      period.textContent = '.';
      authTitle.replaceChildren(labelText, period);
    }
  }
  if (elements.commandInput) {
    elements.commandInput.setAttribute('aria-label', `Send a command to ${name}`);
    elements.commandInput.placeholder = `Speak or enter a command for ${name}…`;
  }
  if (elements.helpSectionKicker) elements.helpSectionKicker.textContent = `${displayName} GUIDE`;
  if (elements.voiceHelpText) {
    elements.voiceHelpText.textContent = `Choose a voice in Settings. Its language is used for both speech and microphone recognition. Turn on Wake phrase, allow microphone access, then say “Hey ${name}.” After ${name} replies, it listens for your next turn.`;
  }
  if (elements.systemHelpText) {
    elements.systemHelpText.textContent = `${displayName} will chat about those requests but cannot perform them yet.`;
  }
  if (document.title) document.title = `${displayName} | Personal AI Command Interface`;
}

function readVoiceSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('personalAssistantVoiceSettings') || '{}');
    assistantName = saved.assistantName || 'Jarvis';
    elements.assistantName.value = assistantName;
    elements.rateRange.value = saved.rate || '1.0';
    elements.pitchRange.value = saved.pitch || '1.0';
  } catch {
    assistantName = 'Jarvis';
  }
  updateAssistantIdentity();
  updateVoiceLabels();
}

function saveVoiceSettings() {
  assistantName = elements.assistantName.value.trim() || 'Jarvis';
  try {
    localStorage.setItem('personalAssistantVoiceSettings', JSON.stringify({
      assistantName,
      voiceName: elements.voiceSelect.value,
      rate: elements.rateRange.value,
      pitch: elements.pitchRange.value
    }));
  } catch {
    showToast('Settings not saved', 'Browser storage is unavailable; voice settings will reset when this page closes.', true);
  }
  updateAssistantIdentity();
  updateVoiceLabels();
}

function updateVoiceLabels() {
  elements.rateValue.textContent = `${Number(elements.rateRange.value).toFixed(1)}×`;
  elements.pitchValue.textContent = Number(elements.pitchRange.value).toFixed(1);
  if (elements.wakeCaption) {
    const name = (assistantName || 'Jarvis').trim() || 'Jarvis';
    elements.wakeCaption.textContent = `“Hey ${name}” · browser mic`;
  }
}

function populateVoices() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const selected = elements.voiceSelect.value;
  elements.voiceSelect.replaceChildren();
  if (!voices.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Browser default voice';
    elements.voiceSelect.appendChild(option);
    return;
  }
  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} · ${voice.lang}`;
    elements.voiceSelect.appendChild(option);
  });
  let preferred = selected;
  try { preferred ||= JSON.parse(localStorage.getItem('personalAssistantVoiceSettings') || '{}').voiceName || ''; } catch {}
  if ([...elements.voiceSelect.options].some((option) => option.value === preferred)) elements.voiceSelect.value = preferred;
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function setupAmbientCanvas() {
  const canvas = elements.ambientCanvas;
  const context = canvas.getContext('2d');
  if (!context) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particles = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 1.1 + 0.25,
    alpha: Math.random() * 0.28 + 0.08,
    drift: (Math.random() - 0.5) * 0.00012
  }));
  let width = 0;
  let height = 0;
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    particles.forEach((particle) => {
      particle.y -= particle.drift;
      if (particle.y < -0.02) particle.y = 1.02;
      context.beginPath();
      context.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(112, 204, 220, ${particle.alpha})`;
      context.fill();
    });
    if (!reducedMotion) window.requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  draw();
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.authError.textContent = '';
  const submit = elements.loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const data = await fetchJson('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: elements.emailInput.value.trim(), password: elements.passwordInput.value.trim() })
    });
    const userName = String(data.user || elements.emailInput.value.trim().split('@', 1)[0] || 'User');
    applyAuthState(userName);
    showToast('Session initialized', `${assistantName} is ready. Voice input is user-activated.`);
    await Promise.all([loadSystemInfo(), loadNetworkInfo(), loadDevices()]);
  } catch (error) {
    elements.authError.textContent = error.name === 'AbortError' ? 'Local service timed out. Start FastAPI and retry.' : error.message;
  } finally {
    submit.disabled = false;
  }
});

elements.commandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void sendMessage(elements.commandInput.value, 'TEXT');
});
elements.commandInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const value = elements.commandInput.value.trim();
    if (value) {
      const offlineWake = getWakePhraseMatch(value);
      if (offlineWake && !offlineWake.command) {
        void sendMessage(value, 'TEXT');
        return;
      }
      void sendMessage(value, 'TEXT');
    }
  }
});
elements.micButton.addEventListener('click', startVoiceInput);
elements.coreMicButton.addEventListener('click', startVoiceInput);
elements.wakeToggle.addEventListener('click', () => wakeEnabled ? stopWakeListener() : startWakeListener());
elements.deviceList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-device-id]');
  if (button) void authorizeDevice(button.dataset.deviceId, button.dataset.approved === 'true');
});
elements.taskList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-task-action]');
  if (!button) return;
  const index = Number(button.dataset.taskIndex);
  const task = taskItems[index];
  if (!task) return;
  if (button.dataset.taskAction === 'complete') {
    task.done = true;
    setResponse(`Completed task ${index + 1}: ${task.text}`, 'TASK LIST');
  } else {
    const [removed] = taskItems.splice(index, 1);
    setResponse(`Deleted task ${index + 1}: ${removed.text}`, 'TASK LIST');
  }
  saveTasks();
});

document.getElementById('openHistory').addEventListener('click', () => openDialog(elements.historyDialog));
document.getElementById('viewAllHistory').addEventListener('click', () => openDialog(elements.historyDialog));
document.getElementById('openVoiceSettings').addEventListener('click', () => openDialog(elements.voiceDialog));
document.getElementById('openHelp').addEventListener('click', () => openDialog(elements.helpDialog));
document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => closeDialog(button.closest('dialog')));
});
[elements.historyDialog, elements.voiceDialog, elements.helpDialog].forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
});
elements.voiceForm.addEventListener('input', saveVoiceSettings);
elements.voiceSelect.addEventListener('change', saveVoiceSettings);

readVoiceSettings();
loadSessionHistory();
loadTasks();
populateVoices();
const savedAuth = loadAuthState();
if (savedAuth) {
  applyAuthState(savedAuth.userName);
}
if ('speechSynthesis' in window) window.speechSynthesis.addEventListener?.('voiceschanged', populateVoices);
if (SpeechRecognition && savedAuth && !wakeEnabled) {
  window.setTimeout(() => {
    if (!wakeEnabled && !activeRecognition && !requestPending) startWakeListener();
  }, 800);
}
else elements.recognitionSupport.textContent = 'SPEECH OUTPUT UNSUPPORTED';
if (!SpeechRecognition) elements.recognitionSupport.textContent = 'SPEECH RECOGNITION UNSUPPORTED';
updateClock();
window.setInterval(updateClock, 1000);
elements.hostInfo.textContent = getUserAgentLabel();
setState('idle');
setServiceState('CHECKING');
setupAmbientCanvas();
void loadSystemInfo();
void loadNetworkInfo();
void loadDevices();
