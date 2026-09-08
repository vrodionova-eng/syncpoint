import { el, textField, openModal } from '../ui.js';

export function servicesView(mount, api) {
  render(mount, api);
}

async function render(mount, api) {
  mount.innerHTML = '';
  mount.append(el('div', { class: 'toolbar' }, [
    el('button', { class: 'btn', onclick: () => openForm(mount, api) }, 'Добавить услугу'),
  ]));

  let services = [], tools = [];
  try { [services, tools] = await Promise.all([api.list('services'), api.list('tools')]); }
  catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); }

  if (!services.length) mount.append(el('div', { class: 'muted' }, 'Пока пусто.'));
  for (const s of services) {
    mount.append(el('div', { class: 'row' }, [
      el('div', {}, [el('b', {}, s.name), el('div', { class: 'meta' }, priceText(s))]),
      el('div', {}, [
        el('button', { class: 'btn link', onclick: () => openForm(mount, api, s) }, 'Изменить'),
        el('button', { class: 'btn link', onclick: () => del(s, mount, api) }, 'Удалить'),
      ]),
    ]));
  }
}

function priceText(s) {
  if (s.isComposite) return `составная (${s.compositeSum})`;
  if (s.priceType === 'fixed') return `${s.price} ₽`;
  return `${s.priceMin}–${s.priceMax} ₽`;
}

async function openForm(mount, api, item) {
  const [services, tools] = await Promise.all([api.list('services'), api.list('tools')]);
  const others = services.filter((s) => s.id !== item?.id);

  const name = textField('Название', item?.name || '');

  const kind = el('select', {});
  kind.append(el('option', { value: 'simple' }, 'Простая'));
  kind.append(el('option', { value: 'composite' }, 'Составная'));
  kind.value = item?.isComposite ? 'composite' : 'simple';

  const priceType = el('select', {});
  priceType.append(el('option', { value: 'fixed' }, 'Фиксированная'));
  priceType.append(el('option', { value: 'range' }, 'Диапазон'));
  priceType.value = item?.priceType || 'fixed';
  const price = el('input', { type: 'number', min: '0', value: item?.price ?? '' });
  const priceMin = el('input', { type: 'number', min: '0', value: item?.priceMin ?? '' });
  const priceMax = el('input', { type: 'number', min: '0', value: item?.priceMax ?? '' });

  const compositeSum = el('select', {});
  for (const [v, l] of [['auto', 'Сумма под-услуг'], ['fixed', 'Своя цена'], ['manual', 'Указать при записи']]) {
    compositeSum.append(el('option', { value: v }, l));
  }
  compositeSum.value = item?.compositeSum || 'auto';
  const childChecks = others.map((o) => {
    const cb = el('input', { type: 'checkbox', value: o.id });
    if (item?.childServiceIds?.includes(o.id)) cb.checked = true;
    return { id: o.id, cb, node: el('label', { style: 'display:flex;align-items:center;gap:8px;padding:2px 4px;justify-content:flex-start' }, [cb, el('span', {}, o.name)]) };
  });

  const toolChecks = tools.map((t) => {
    const cb = el('input', { type: 'checkbox', value: t.id });
    if (item?.requiredToolIds?.includes(t.id)) cb.checked = true;
    return { id: t.id, cb, node: el('label', { style: 'display:flex;align-items:center;gap:8px;padding:2px 4px;justify-content:flex-start' }, [cb, el('span', {}, t.name)]) };
  });

  const simpleBox = el('div', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Тип цены'), priceType]),
    el('div', { class: 'field' }, [el('label', {}, 'Цена (фикс)'), price]),
    el('div', { class: 'field' }, [el('label', {}, 'Мин'), priceMin]),
    el('div', { class: 'field' }, [el('label', {}, 'Макс'), priceMax]),
  ]);
  const compositeBox = el('div', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Способ суммы'), compositeSum]),
    el('div', { class: 'field' }, [el('label', {}, 'Под-услуги'),
      el('div', { class: 'checklist' }, childChecks.map((c) => c.node))]),
  ]);

  const syncVisibility = () => {
    const composite = kind.value === 'composite';
    compositeBox.style.display = composite ? 'block' : 'none';
    simpleBox.style.display = composite ? 'none' : 'block';
    price.parentElement.style.display = priceType.value === 'fixed' ? 'block' : 'none';
    priceMin.parentElement.style.display = priceType.value === 'range' ? 'block' : 'none';
    priceMax.parentElement.style.display = priceType.value === 'range' ? 'block' : 'none';
  };
  kind.addEventListener('change', syncVisibility);
  priceType.addEventListener('change', syncVisibility);

  const body = el('div', {}, [
    name.field,
    el('div', { class: 'field' }, [el('label', {}, 'Вид услуги'), kind]),
    simpleBox,
    compositeBox,
    el('div', { class: 'field' }, [el('label', {}, 'Нужные инструменты'),
      el('div', { class: 'checklist' }, toolChecks.length ? toolChecks.map((c) => c.node) : [el('span', { class: 'muted' }, 'нет инструментов')])]),
  ]);
  setTimeout(syncVisibility, 0);

  openModal({
    title: item ? 'Изменить услугу' : 'Новая услуга',
    body,
    onSubmit: async () => {
      const requiredToolIds = toolChecks.filter((c) => c.cb.checked).map((c) => c.id);
      let data;
      if (kind.value === 'composite') {
        data = {
          name: name.input.value, isComposite: true,
          compositeSum: compositeSum.value,
          childServiceIds: childChecks.filter((c) => c.cb.checked).map((c) => c.id),
          price: compositeSum.value === 'fixed' ? Number(price.value) : null,
          requiredToolIds,
        };
      } else {
        data = {
          name: name.input.value, isComposite: false, priceType: priceType.value,
          price: priceType.value === 'fixed' ? Number(price.value) : null,
          priceMin: priceType.value === 'range' ? Number(priceMin.value) : null,
          priceMax: priceType.value === 'range' ? Number(priceMax.value) : null,
          requiredToolIds,
        };
      }
      if (item) await api.update('services', item.id, data);
      else await api.create('services', data);
      await render(mount, api);
    },
  });
}

async function del(s, mount, api) {
  if (!confirm('Удалить услугу?')) return;
  try { await api.remove('services', s.id); await render(mount, api); }
  catch (e) { alert(e.message); }
}
