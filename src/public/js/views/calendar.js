import { el, textField, openModal } from '../ui.js';
import { defaultPrice } from '../servicePrice.js';

const DAY_START = 8;   // 08:00
const DAY_END = 21;    // 21:00
const SLOT_MIN = 30;

const PALETTE = ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#e91e63', '#009688', '#795548', '#607d8b'];

function colorFor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Пн = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function calendarView(mount, api) {
  const state = {
    weekStart: startOfWeek(new Date()),
    workPointId: null,
  };
  render(mount, api, state);
}

async function render(mount, api, state) {
  mount.innerHTML = '';

  let workPoints = [], services = [], employees = [];
  try {
    [workPoints, services, employees] = await Promise.all([
      api.list('work-points'), api.list('services'), api.list('employees'),
    ]);
  } catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); return; }

  if (!workPoints.length) {
    mount.append(el('div', { class: 'muted' }, 'Сначала добавьте рабочую точку (вкладка «Рабочие точки»).'));
    return;
  }
  if (!state.workPointId || !workPoints.some((w) => w.id === state.workPointId)) {
    state.workPointId = workPoints[0].id;
  }

  const from = new Date(state.weekStart);
  const to = new Date(state.weekStart);
  to.setDate(to.getDate() + 7);

  let bookings = [];
  try {
    bookings = await api.get(
      `bookings?workPointId=${state.workPointId}&from=${from.toISOString()}&to=${to.toISOString()}`,
    );
  } catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); }

  const svcName = new Map(services.map((s) => [s.id, s.name]));
  const empName = new Map(employees.map((e) => [e.id, e.name]));

  // --- шапка ---
  const wpSelect = el('select', {});
  for (const w of workPoints) {
    const opt = el('option', { value: w.id }, w.name);
    if (w.id === state.workPointId) opt.selected = true;
    wpSelect.append(opt);
  }
  wpSelect.addEventListener('change', () => { state.workPointId = wpSelect.value; render(mount, api, state); });

  const title = el('div', { class: 'cal-title' },
    `${from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${new Date(to - 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`);

  const shift = (days) => () => {
    state.weekStart.setDate(state.weekStart.getDate() + days);
    render(mount, api, state);
  };

  mount.append(el('div', { class: 'cal-wrap' }, [
    el('div', { class: 'cal-toolbar' }, [
      wpSelect,
      el('button', { class: 'btn secondary', onclick: shift(-7) }, '‹ неделя'),
      el('button', { class: 'btn secondary', onclick: () => { state.weekStart = startOfWeek(new Date()); render(mount, api, state); } }, 'Сегодня'),
      el('button', { class: 'btn secondary', onclick: shift(7) }, 'неделя ›'),
      title,
      el('button', { class: 'btn', onclick: () => openBookingForm(mount, api, state, {}) }, '+ Запись'),
    ]),
    buildGrid(bookings, svcName, empName, state, mount, api),
  ]));
}

function buildGrid(bookings, svcName, empName, state, mount, api) {
  const grid = el('div', { class: 'cal-grid' });
  const today = new Date().toDateString();

  // Шапка дней
  grid.append(el('div', { class: 'cal-cell hour-label' }, ''));
  const days = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(state.weekStart);
    day.setDate(day.getDate() + d);
    days.push(day);
    grid.append(el('div', {
      class: `cal-cell day-head${day.toDateString() === today ? ' today' : ''}`,
    }, day.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })));
  }

  const slotsPerHour = 60 / SLOT_MIN;
  const totalSlots = (DAY_END - DAY_START) * slotsPerHour;

  // События по дню и слоту
  for (let s = 0; s < totalSlots; s++) {
    const hour = DAY_START + Math.floor((s * SLOT_MIN) / 60);
    const minute = (s * SLOT_MIN) % 60;
    grid.append(el('div', { class: 'cal-cell hour-label' }, minute === 0 ? `${String(hour).padStart(2, '0')}:00` : ''));

    for (const day of days) {
      const cellDate = new Date(day);
      cellDate.setHours(hour, minute, 0, 0);
      const cell = el('div', {
        class: 'cal-cell slot',
        onclick: () => openBookingForm(mount, api, state, { date: cellDate }),
      });

      const slotStart = cellDate.getTime();
      const slotEnd = slotStart + SLOT_MIN * 60 * 1000;
      for (const b of bookings) {
        const bStart = Date.parse(b.start);
        const bEnd = Date.parse(b.end);
        if (bStart < slotEnd && slotStart < bEnd && bStart < slotStart + SLOT_MIN * 60 * 1000 && bStart >= slotStart - SLOT_MIN * 60 * 1000 && bStart < slotEnd) {
          // отрисовываем блок только в слоте начала записи
          if (bStart >= slotStart && bStart < slotEnd) {
            const heightSlots = Math.max(1, Math.ceil((bEnd - bStart) / (SLOT_MIN * 60 * 1000)));
            const names = (b.serviceIds || []).map((id) => svcName.get(id)).filter(Boolean).join(', ');
            const ev = el('div', {
              class: 'cal-event',
              style: `height: calc(${heightSlots * 100}% + ${(heightSlots - 1)}px); background: ${colorFor(b.employeeIds?.[0])}`,
              onclick: (e) => { e.stopPropagation(); openBookingForm(mount, api, state, { booking: b }); },
            }, [
              `${fmtTime(b.start)} ${names || '—'}`,
              b.client?.name ? ` · ${b.client.name}` : '',
              ...(b.warnings?.length ? [el('span', { class: 'warn', title: b.warnings.join('\n') }, ' ⚠')] : []),
            ]);
            cell.append(ev);
          }
        }
      }
      grid.append(cell);
    }
  }
  return grid;
}

async function openBookingForm(mount, api, state, { date, booking }) {
  const [services, employees] = await Promise.all([api.list('services'), api.list('employees')]);

  const baseDate = booking ? new Date(booking.start) : (date || new Date());
  const toLocal = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const toLocalTime = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const dateInput = el('input', { type: 'date', value: toLocal(baseDate) });
  const startInput = el('input', { type: 'time', value: booking ? toLocalTime(new Date(booking.start)) : toLocalTime(baseDate) });
  const endDefault = booking ? new Date(booking.end) : new Date(baseDate.getTime() + 60 * 60 * 1000);
  const endInput = el('input', { type: 'time', value: toLocalTime(endDefault) });

  const empChecks = employees.map((emp) => {
    const cb = el('input', { type: 'checkbox', value: emp.id });
    if (booking?.employeeIds?.includes(emp.id)) cb.checked = true;
    return { id: emp.id, cb, node: el('label', { style: 'display:flex;align-items:center;gap:8px;padding:2px 4px' }, [cb, el('span', {}, emp.name)]) };
  });

  const svcChecks = services.map((s) => {
    const cb = el('input', { type: 'checkbox', value: s.id });
    if (booking?.serviceIds?.includes(s.id)) cb.checked = true;
    cb.addEventListener('change', syncPrice);
    return { id: s.id, svc: s, cb, node: el('label', { style: 'display:flex;align-items:center;gap:8px;padding:2px 4px' }, [cb, el('span', {}, s.name)]) };
  });

  const priceInput = el('input', { type: 'number', min: '0' });
  let priceDirty = booking?.priceOverride != null;
  priceInput.value = booking ? (booking.priceOverride ?? booking.priceTotal ?? '') : '';
  priceInput.addEventListener('input', () => { priceDirty = true; });

  function defaultSum() {
    return svcChecks.filter((c) => c.cb.checked).reduce((sum, c) => {
      const s = c.svc;
      return sum + defaultPrice(s, new Map(svcChecks.map((c) => [c.id, c.svc])));
    }, 0);
  }
  function syncPrice() {
    if (!priceDirty) priceInput.value = defaultSum();
  }
  syncPrice();

  // Клиент CRM: поиск с выбором из подсказки или создание нового.
  let clientSel = booking?.client || null;
  const clientInput = el('input', { type: 'text', value: clientSel?.name || '', placeholder: 'Имя или телефон' });
  const clientBox = el('div', {});
  let searchTimer = null;
  clientInput.addEventListener('input', () => {
    clientSel = null;
    clearTimeout(searchTimer);
    const q = clientInput.value.trim();
    if (q.length < 2) { clientBox.innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
      try {
        const found = await api.get(`b24/crm/contacts?query=${encodeURIComponent(q)}`);
        clientBox.innerHTML = '';
        for (const c of found.slice(0, 5)) {
          clientBox.append(el('div', {
            class: 'meta', style: 'cursor:pointer;padding:2px 4px',
            onclick: () => { clientSel = { contactId: c.id, name: c.name }; clientInput.value = c.name; clientBox.innerHTML = ''; },
          }, `${c.name}${c.phone ? ` · ${c.phone}` : ''}`));
        }
        clientBox.append(el('div', {
          class: 'meta', style: 'cursor:pointer;color:var(--b24-primary-d);padding:2px 4px',
          onclick: async () => {
            const created = await api.post('b24/crm/contacts', { name: q });
            clientSel = { contactId: created.id, name: created.name };
            clientInput.value = created.name;
            clientBox.innerHTML = '';
          },
        }, `+ Создать «${q}»`));
      } catch { /* поиск молча не удался */ }
    }, 300);
  });

  const note = textField('Заметка', booking?.note || '');
  const warnBox = el('div', { class: 'error' });
  let ackWarnings = false;

  openModal({
    title: booking ? 'Изменить запись' : 'Новая запись',
    body: el('div', {}, [
      el('div', { class: 'field' }, [el('label', {}, 'Дата'), dateInput]),
      el('div', { class: 'field', style: 'display:flex;gap:8px' }, [
        el('div', { style: 'flex:1' }, [el('label', {}, 'Начало'), startInput]),
        el('div', { style: 'flex:1' }, [el('label', {}, 'Конец'), endInput]),
      ]),
      el('div', { class: 'field' }, [el('label', {}, 'Участники'),
        el('div', { class: 'checklist' }, empChecks.length ? empChecks.map((c) => c.node) : [el('span', { class: 'muted' }, 'нет сотрудников')])]),
      el('div', { class: 'field' }, [el('label', {}, 'Услуги'),
        el('div', { class: 'checklist' }, svcChecks.length ? svcChecks.map((c) => c.node) : [el('span', { class: 'muted' }, 'нет услуг')])]),
      el('div', { class: 'field' }, [el('label', {}, 'Сумма, ₽ (авто — можно изменить)'), priceInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Клиент (CRM, необязательно)'), clientInput, clientBox]),
      note.field,
      warnBox,
    ]),
    submitLabel: 'Сохранить',
    onSubmit: async () => {
      const start = new Date(`${dateInput.value}T${startInput.value}`);
      const end = new Date(`${dateInput.value}T${endInput.value}`);
      const body = {
        workPointId: state.workPointId,
        start: start.toISOString(),
        end: end.toISOString(),
        employeeIds: empChecks.filter((c) => c.cb.checked).map((c) => c.id),
        serviceIds: svcChecks.filter((c) => c.cb.checked).map((c) => c.id),
        priceOverride: priceDirty && priceInput.value !== '' ? Number(priceInput.value) : null,
        client: clientSel,
        note: note.input.value.trim() || null,
      };
      const fn = booking
        ? () => api.update('bookings', booking.id, body)
        : () => api.create('bookings', body);
      const result = await fn();
      if (result.warnings?.length && !ackWarnings) {
        warnBox.textContent = `${result.warnings.join('; ')}. Нажмите «Сохранить» ещё раз, чтобы оставить как есть.`;
        ackWarnings = true;
        // Запись уже сохранена (мягкая проверка не блокирует) — просто обновляем.
        await render(mount, api, state);
        throw new Error('__shown__'); // не закрывать модалку: показали предупреждение
      }
      await render(mount, api, state);
    },
  });
}
