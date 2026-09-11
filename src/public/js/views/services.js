import { el, textField, openModal } from '../ui.js';
import { defaultPrice } from '../servicePrice.js';

export function servicesView(mount, api) {
  render(mount, api);
}

async function render(mount, api) {
  mount.innerHTML = '';
  mount.append(el('div', { class: 'toolbar' }, [
    el('button', { class: 'btn', onclick: () => openForm(mount, api) }, 'Добавить услугу'),
    el('button', { class: 'btn secondary', onclick: () => openCategories(mount, api) }, 'Категории услуг'),
  ]));

  let services = [], categories = [];
  try { [services, categories] = await Promise.all([api.list('services'), api.list('service-categories')]); }
  catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); }

  if (!services.length) mount.append(el('div', { class: 'muted' }, 'Пока пусто.'));
  for (const s of services) {
    mount.append(el('div', { class: 'row' }, [
      el('div', {}, [el('b', {}, s.name), el('div', { class: 'meta' }, priceText(s, services)),
        el('div', { class: 'meta' }, categories.find((c) => c.id === s.categoryId)?.name || 'Без категории')]),
      el('div', {}, [
        el('button', { class: 'btn link', onclick: () => openForm(mount, api, s) }, 'Изменить'),
        el('button', { class: 'btn link', onclick: () => del(s, mount, api) }, 'Удалить'),
      ]),
    ]));
  }
}

function priceText(s, services) {
  if (s.isComposite) {
    const label = { auto: 'Сумма под-услуг', fixed: 'Своя цена', manual: 'Указать при записи' }[s.compositeSum];
    return `Составная · ${label} · ${defaultPrice(s, new Map(services.map((s) => [s.id, s])))} ₽`;
  }
  if (s.priceType === 'fixed') return `${s.price} ₽`;
  return `${s.priceMin}–${s.priceMax} ₽`;
}

async function openForm(mount, api, item) {
  let services, tools, categories;
  try { [services, tools, categories] = await Promise.all([api.list('services'), api.list('tools'), api.list('service-categories')]); }
  catch (e) { alert(e.message); return; }
  const others = services.filter((s) => s.id !== item?.id);

  const name = textField('Название', item?.name || '');
  const category = el('select', {}, [el('option', { value: '' }, 'Без категории'),
    ...categories.map((c) => el('option', { value: c.id }, c.name))]);
  category.value = item?.categoryId || '';

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
  const compositePrice = el('input', { type: 'number', min: '0', step: 'any', value: item?.price ?? '' });
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
    const count = el('input', { type: 'number', min: '1', step: '1', value: item?.requiredToolCounts?.[t.id] ?? 1,
      'aria-label': `Количество: ${t.name}` });
    count.disabled = !cb.checked;
    cb.addEventListener('change', () => { count.disabled = !cb.checked; });
    return { id: t.id, cb, count, node: el('div', { class: 'tool-requirement' }, [
      el('label', {}, [cb, el('span', {}, t.name)]), count,
    ]) };
  });

  const simpleBox = el('div', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Тип цены'), priceType]),
    el('div', { class: 'field' }, [el('label', {}, 'Цена (фикс)'), price]),
    el('div', { class: 'field' }, [el('label', {}, 'Мин'), priceMin]),
    el('div', { class: 'field' }, [el('label', {}, 'Макс'), priceMax]),
  ]);
  const compositeBox = el('div', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Способ суммы'), compositeSum]),
    el('div', { class: 'field' }, [el('label', {}, 'Своя цена, ₽'), compositePrice]),
    el('div', { class: 'field' }, [el('label', {}, 'Под-услуги'),
      el('div', { class: 'checklist' }, childChecks.map((c) => c.node))]),
  ]);

  const syncVisibility = () => {
    const composite = kind.value === 'composite';
    compositeBox.style.display = composite ? 'block' : 'none';
    compositePrice.parentElement.style.display = compositeSum.value === 'fixed' ? 'block' : 'none';
    simpleBox.style.display = composite ? 'none' : 'block';
    price.parentElement.style.display = priceType.value === 'fixed' ? 'block' : 'none';
    priceMin.parentElement.style.display = priceType.value === 'range' ? 'block' : 'none';
    priceMax.parentElement.style.display = priceType.value === 'range' ? 'block' : 'none';
  };
  kind.addEventListener('change', syncVisibility);
  compositeSum.addEventListener('change', syncVisibility);
  priceType.addEventListener('change', syncVisibility);

  const body = el('div', {}, [
    name.field,
    el('div', { class: 'field' }, [el('label', {}, 'Категория'), category]),
    el('div', { class: 'field' }, [el('label', {}, 'Вид услуги'), kind]),
    simpleBox,
    compositeBox,
    el('div', { class: 'field' }, [el('label', {}, 'Нужные инструменты'),
      el('div', { class: 'muted' }, 'Отметьте инструменты и укажите количество экземпляров.'),
      el('div', { class: 'checklist' }, toolChecks.length ? toolChecks.map((c) => c.node) : [el('span', { class: 'muted' }, 'нет инструментов')])]),
  ]);
  setTimeout(syncVisibility, 0);

  openModal({
    title: item ? 'Изменить услугу' : 'Новая услуга',
    body,
    onSubmit: async () => {
      const requiredToolIds = toolChecks.filter((c) => c.cb.checked).map((c) => c.id);
      const requiredToolCounts = {};
      for (const c of toolChecks.filter((c) => c.cb.checked)) {
        const count = Number(c.count.value);
        if (!Number.isSafeInteger(count) || count < 1) throw new Error('Количество инструмента должно быть целым числом от 1');
        requiredToolCounts[c.id] = count;
      }
      let data;
      if (kind.value === 'composite') {
        if (compositeSum.value === 'fixed' && (compositePrice.value.trim() === '' || !Number.isFinite(Number(compositePrice.value)) || Number(compositePrice.value) < 0)) {
          throw new Error('Укажите свою цену от 0');
        }
        data = {
          name: name.input.value, isComposite: true,
          compositeSum: compositeSum.value,
          childServiceIds: childChecks.filter((c) => c.cb.checked).map((c) => c.id),
          price: compositeSum.value === 'fixed' ? Number(compositePrice.value) : null,
          requiredToolIds, requiredToolCounts,
        };
      } else {
        data = {
          name: name.input.value, isComposite: false, priceType: priceType.value,
          price: priceType.value === 'fixed' ? Number(price.value) : null,
          priceMin: priceType.value === 'range' ? Number(priceMin.value) : null,
          priceMax: priceType.value === 'range' ? Number(priceMax.value) : null,
          requiredToolIds, requiredToolCounts,
        };
      }
      data.categoryId = category.value || null;
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

async function openCategories(mount, api) {
  let categories;
  try { categories = await api.list('service-categories'); }
  catch (e) { alert(e.message); return; }
  const list = el('div', {});
  const name = textField('Название новой категории');
  const error = el('div', { class: 'error' });
  const add = el('button', { class: 'btn secondary', onclick: async () => {
    add.disabled = true;
    try {
      await api.create('service-categories', { name: name.input.value });
      await render(mount, api);
      await openCategories(mount, api);
    } catch (e) { error.textContent = e.message; }
    finally { add.disabled = false; }
  } }, 'Добавить категорию');
  for (const c of categories) {
    const field = textField('Название категории', c.name);
    const save = el('button', { class: 'btn link', onclick: async () => {
      save.disabled = true;
      try { await api.update('service-categories', c.id, { name: field.input.value }); error.textContent = ''; await render(mount, api); }
      catch (e) { error.textContent = e.message; }
      finally { save.disabled = false; }
    } }, 'Сохранить');
    const remove = el('button', { class: 'btn link', onclick: async () => {
      if (!confirm('Удалить категорию?')) return;
      remove.disabled = true;
      try { await api.remove('service-categories', c.id); await render(mount, api); await openCategories(mount, api); }
      catch (e) { error.textContent = e.message; }
      finally { remove.disabled = false; }
    } }, 'Удалить');
    list.append(el('div', {}, [field.field, save, remove]));
  }
  openModal({ title: 'Категории услуг', body: el('div', {}, [list, name.field, add, error]),
    submitLabel: 'Готово', onSubmit: async () => {} });
}
