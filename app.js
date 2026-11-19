'use strict';

const types = [
  { id: 'narrow' },
  { id: 'regular' },
  { id: 'handles' },
];

const storageKey = 'pushup-tracker-v1';
const state = loadState();
const workoutForm = document.querySelector('#workout-form');
const goalForm = document.querySelector('#goal-form');
const dateInput = workoutForm.elements.namedItem('date');
const chartType = document.querySelector('#chart-type');
const workoutsList = document.querySelector('#workouts');
const historyFile = document.querySelector('#history-file');
const languagePicker = document.querySelector('#language');
const languageKey = 'pushup-tracker-language';
const feedbackMessages = new Map();
let language = 'en';
let dateFormat;
let shortDateFormat;
let numberFormat;
let percentFormat;
let axisNumber;

function translate(key, values = {}) {
  return translations[key][languages.indexOf(language)]
    .replace(/\{(\w+)\}/g, (_, name) => {
      const value = values[name];
      return typeof value === 'number' ? numberFormat.format(value) : value;
    });
}

function applyLanguage(next) {
  language = languages.includes(next) ? next : 'en';
  languagePicker.value = language;
  document.documentElement.lang = language;
  document.title = translate('title');
  dateFormat = new Intl.DateTimeFormat(language, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  shortDateFormat = new Intl.DateTimeFormat(language, {
    day: '2-digit', month: '2-digit', timeZone: 'UTC',
  });
  numberFormat = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  percentFormat = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 });
  axisNumber = new Intl.NumberFormat(language, { notation: 'compact' });

  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = translate(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-label]')) {
    node.setAttribute('aria-label', translate(node.dataset.i18nLabel));
  }
  for (const [id, { key, error, values }] of feedbackMessages) {
    showFeedback(id, key, error, values);
  }
  render();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.workouts) && saved.goals) return saved;
  } catch {
    // A missing or unreadable store starts with an empty view.
  }
  return { workouts: [], goals: {} };
}

function saveState(next, feedbackId, message, values) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    showFeedback(feedbackId, 'storageError', true);
    return false;
  }
  Object.assign(state, next);
  showFeedback(feedbackId, message, false, values);
  render();
  return true;
}

function showFeedback(id, key, error = false, values) {
  if (key) feedbackMessages.set(id, { key, error, values });
  else feedbackMessages.delete(id);
  const feedback = document.getElementById(id);
  feedback.toggleAttribute('data-error', error);
  feedback.textContent = key ? translate(key, values) : '';
}

function localToday() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

// Keep stored dates in ISO format; display a fixed numeric date in every locale.
function selectedDate() {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateInput.value);
  if (!match) return '';
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return year !== '0000' && Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === iso ? iso : '';
}

function setSelectedDate(iso) {
  dateInput.value = iso.split('-').reverse().join('.');
  dateInput.setCustomValidity('');
}

dateInput.addEventListener('input', () => {
  // Insert separators while typing with the iPhone numeric keyboard.
  const digits = dateInput.value.replace(/[^0-9]/g, '').slice(0, 8);
  dateInput.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean).join('.');
  dateInput.setCustomValidity(selectedDate() ? '' : 'dd.mm.yyyy');
});

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function createFields(containerId, min, hintId) {
  const container = document.getElementById(containerId);
  for (const { id } of types) {
    const field = element('label');
    const caption = element('span');
    caption.dataset.i18n = id;
    const input = element('input');
    input.name = id;
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = min;
    input.max = Number.MAX_SAFE_INTEGER;
    input.step = 1;
    input.setAttribute('aria-describedby', hintId);
    field.append(caption, input);
    container.append(field);
  }
}

function readCounts(form) {
  const counts = {};
  for (const { id } of types) {
    const input = form.elements.namedItem(id);
    if (input.value !== '') counts[id] = input.valueAsNumber;
  }
  return counts;
}

function fillCounts(form, counts) {
  for (const { id } of types) {
    form.elements.namedItem(id).value = counts[id] ?? '';
  }
}

function loadWorkoutFields() {
  const workout = state.workouts.find(({ date }) => date === selectedDate());
  fillCounts(workoutForm, workout?.reps ?? {});
  showFeedback('workout-feedback', '');
}

workoutForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const date = selectedDate();
  if (!date) {
    showFeedback('workout-feedback', 'invalidDate', true);
    dateInput.focus();
    return;
  }
  const reps = readCounts(workoutForm);
  if (Object.keys(reps).length === 0) {
    showFeedback('workout-feedback', 'noReps', true);
    return;
  }
  const workouts = state.workouts.filter((workout) => workout.date !== date);
  workouts.push({ date, reps });
  workouts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  saveState({ ...state, workouts }, 'workout-feedback', 'workoutSaved');
});

goalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveState({ ...state, goals: readCounts(goalForm) }, 'goal-feedback', 'goalsSaved');
});

function showValidationError(form, feedbackId, countMessage) {
  form.addEventListener('invalid', (event) => {
    event.preventDefault();
    if (event.target !== form.querySelector('input:invalid')) return;
    const message = event.target === dateInput ? 'invalidDate' : countMessage;
    showFeedback(feedbackId, message, true);
    event.target.focus();
  }, true);
}

showValidationError(workoutForm, 'workout-feedback', 'invalidReps');
showValidationError(goalForm, 'goal-feedback', 'invalidGoal');

dateInput.addEventListener('change', loadWorkoutFields);
chartType.addEventListener('change', renderChart);

document.querySelector('#export-history').addEventListener('click', () => {
  const json = JSON.stringify({ version: 1, workouts: state.workouts }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = element('a');
  link.href = url;
  link.download = `pushup-history-${localToday()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showFeedback('transfer-feedback', 'exportReady');
});

document.querySelector('#import-history').addEventListener('click', () => historyFile.click());

function parseHistory(json) {
  const backup = JSON.parse(json);
  if (backup?.version !== 1 || !Array.isArray(backup.workouts)) {
    throw new Error('Неподдерживаемый формат истории.');
  }

  const dates = new Set();
  const dateInputCheck = element('input');
  dateInputCheck.type = 'date';
  for (const workout of backup.workouts) {
    const { date, reps } = workout ?? {};
    dateInputCheck.value = typeof date === 'string' ? date : '';
    if (!dateInputCheck.value || !Number.isFinite(Date.parse(date)) || dates.has(date)) {
      throw new Error('Некорректная или повторяющаяся дата.');
    }
    dates.add(date);

    if (!reps || typeof reps !== 'object' || Array.isArray(reps)) {
      throw new Error('Некорректная запись повторений.');
    }
    const counts = Object.entries(reps);
    if (!counts.length || counts.some(([id, count]) =>
      !types.some((type) => type.id === id) || !Number.isSafeInteger(count) || count < 0
    )) {
      throw new Error('Некорректная запись повторений.');
    }
  }
  return backup.workouts.map(({ date, reps }) => ({ date, reps }));
}

historyFile.addEventListener('change', async () => {
  const file = historyFile.files[0];
  historyFile.value = '';
  if (!file) return;

  let imported;
  try {
    imported = parseHistory(await file.text());
  } catch {
    showFeedback('transfer-feedback', 'importError', true);
    return;
  }

  const byDate = new Map(state.workouts.map((workout) => [workout.date, workout]));
  const selectedBefore = byDate.get(selectedDate());
  const formCounts = readCounts(workoutForm);
  const hasDraft = types.some(({ id }) => formCounts[id] !== selectedBefore?.reps[id]);
  let added = 0;
  let updated = 0;
  for (const workout of imported) {
    const existing = byDate.get(workout.date);
    if (existing && types.every(({ id }) => existing.reps[id] === workout.reps[id])) continue;
    if (existing) updated += 1;
    else added += 1;
    byDate.set(workout.date, workout);
  }

  if (added + updated === 0) {
    showFeedback('transfer-feedback', 'noChanges');
    return;
  }
  if (updated && !window.confirm(translate('replaceDates', { updated }))) {
    showFeedback('transfer-feedback', 'importCancelled');
    return;
  }

  const workouts = [...byDate.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const counts = { added, updated };
  if (saveState({ ...state, workouts }, 'transfer-feedback', 'importDone', counts) &&
    !hasDraft && byDate.get(selectedDate()) !== selectedBefore) {
    loadWorkoutFields();
  }
});

function renderHistory() {
  workoutsList.replaceChildren();
  document.querySelector('#history-empty').hidden = state.workouts.length > 0;

  for (const { date, reps } of state.workouts) {
    const item = element('li');
    item.className = 'workout';
    const formattedDate = dateFormat.format(new Date(date));
    const time = element('time', formattedDate);
    time.dateTime = date;
    const results = types
      .filter(({ id }) => reps[id] !== undefined)
      .map(({ id }) => `${translate(id)} — ${numberFormat.format(reps[id])}`)
      .join(' · ');

    const actions = element('div');
    actions.className = 'actions';
    const edit = element('button', translate('edit'));
    edit.className = 'secondary';
    edit.setAttribute('aria-label', translate('editDate', { date: formattedDate }));
    edit.addEventListener('click', () => {
      setSelectedDate(date);
      loadWorkoutFields();
      dateInput.focus();
    });

    const remove = element('button', translate('remove'));
    remove.className = 'danger';
    remove.setAttribute('aria-label', translate('removeDate', { date: formattedDate }));
    remove.addEventListener('click', () => {
      if (!window.confirm(translate('removeConfirm', { date: formattedDate }))) return;
      const workouts = state.workouts.filter((workout) => workout.date !== date);
      if (saveState({ ...state, workouts }, 'history-feedback', 'workoutRemoved')) {
        if (selectedDate() === date) loadWorkoutFields();
        document.querySelector('#history-title').focus();
      }
    });

    actions.append(edit, remove);
    item.append(time, element('p', results), actions);
    workoutsList.append(item);
  }
}

function resultsFor(type) {
  return state.workouts.filter(({ reps }) => reps[type] !== undefined);
}

function renderSummary() {
  const summary = document.querySelector('#summary');
  summary.replaceChildren();
  for (const { id } of types) {
    const results = resultsFor(id);
    const latest = results[0]?.reps[id];
    const best = results.reduce((max, { reps }) => Math.max(max, reps[id]), 0);
    const goal = state.goals[id];
    const percentage = latest !== undefined && goal !== undefined
      ? percentFormat.format(latest / goal)
      : '—';

    const card = element('article');
    card.className = 'metric';
    const list = element('dl');
    const metrics = [
      [translate('latest'), latest],
      [translate('goal'), goal],
      [translate('achieved'), percentage],
      [translate('best'), results.length ? best : undefined],
    ];
    for (const [name, value] of metrics) {
      const row = element('div');
      const display = typeof value === 'number' ? numberFormat.format(value) : value ?? '—';
      row.append(element('dt', name), element('dd', display));
      list.append(row);
    }
    card.append(element('h3', translate(id)), list);
    summary.append(card);
  }
}

function svgElement(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderChart() {
  const type = chartType.querySelector(':checked').value;
  const results = resultsFor(type).reverse();
  const svg = document.querySelector('#chart-svg');
  svg.replaceChildren();
  document.querySelector('#chart').hidden = results.length === 0;
  document.querySelector('#chart-empty').hidden = results.length > 0;
  if (results.length === 0) return;

  const firstDate = Date.parse(results[0].date);
  const lastDate = Date.parse(results.at(-1).date);
  const max = results.reduce((highest, { reps }) => Math.max(highest, reps[type]), 0);
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;
  const left = 48;
  const right = 330;
  const bottom = 166;
  const height = 144;
  const y = (value) => bottom - value / top * height;
  const x = (date) => firstDate === lastDate
    ? (left + right) / 2
    : left + (Date.parse(date) - firstDate) / (lastDate - firstDate) * (right - left);

  svg.append(
    svgElement('title', { id: 'chart-title' }, translate('chartTitle', { type: translate(type) })),
    svgElement('desc', { id: 'chart-description' },
      results.map(({ date, reps }) => `${dateFormat.format(new Date(date))} — ${numberFormat.format(reps[type])}`).join('. ')),
  );
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = tick * step;
    const position = y(value);
    svg.append(
      svgElement('line', { x1: left, y1: position, x2: right, y2: position, class: 'chart-grid' }),
      svgElement('text', { x: left - 7, y: position + 4, 'text-anchor': 'end' }, axisNumber.format(value)),
    );
  }

  const points = results.map(({ date, reps }) => `${x(date)},${y(reps[type])}`);
  svg.append(svgElement('polyline', { points: points.join(' '), class: 'chart-line' }));
  for (const { date, reps } of results) {
    const point = svgElement('circle', { cx: x(date), cy: y(reps[type]), r: 4, class: 'chart-point' });
    point.append(svgElement('title', {}, `${dateFormat.format(new Date(date))} — ${numberFormat.format(reps[type])}`));
    svg.append(point);
  }

  const dates = results.length === 1 ? [results[0].date] : [results[0].date, results.at(-1).date];
  for (const date of dates) {
    svg.append(svgElement('text', { x: x(date), y: 190, 'text-anchor': 'middle' },
      shortDateFormat.format(new Date(date))));
  }
}

function render() {
  renderHistory();
  renderSummary();
  renderChart();
}

createFields('repetition-fields', 0, 'skip-hint');
createFields('goal-fields', 1, 'goal-hint');
for (const { id } of types) {
  const label = element('label');
  const radio = element('input');
  radio.type = 'radio';
  radio.name = 'chart-type';
  radio.value = id;
  radio.checked = id === types[0].id;
  const caption = element('span');
  caption.dataset.i18n = id;
  label.append(radio, caption);
  chartType.append(label);
}
setSelectedDate(localToday());
loadWorkoutFields();
fillCounts(goalForm, state.goals);
let savedLanguage;
try {
  savedLanguage = localStorage.getItem(languageKey);
} catch {
  // The interface can still switch languages for this visit.
}
applyLanguage(savedLanguage);

languagePicker.addEventListener('change', () => {
  applyLanguage(languagePicker.value);
  try {
    localStorage.setItem(languageKey, language);
  } catch {
    // The selection remains active for this visit.
  }
});

if (window.isSecureContext && location.protocol !== 'file:' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' })
    .catch((error) => console.warn('Offline support could not be initialized.', error));
}
