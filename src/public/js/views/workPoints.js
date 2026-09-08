import { el, textField, selectField, crudView } from '../ui.js';

export function workPointsView(mount, api) {
  loadAndRender(mount, api);
}

async function loadAndRender(mount, api) {
  let spaces = [];
  try { spaces = await api.list('spaces'); } catch { spaces = []; }
  const spaceName = (id) => spaces.find((s) => s.id === id)?.name || '—';

  crudView(mount, {
    entity: 'work-points',
    addLabel: 'Добавить рабочую точку',
    render: (wp) => el('div', {}, [el('b', {}, wp.name), el('span', { class: 'meta' }, `  · ${spaceName(wp.spaceId)}`)]),
    buildForm: (item) => {
      const name = textField('Название', item?.name || '');
      const space = selectField('Пространство',
        spaces.map((s) => ({ value: s.id, label: s.name })), item?.spaceId || '');
      return {
        body: el('div', {}, [name.field, space.field]),
        collect: () => ({ name: name.input.value, spaceId: space.select.value }),
      };
    },
  }, api);
}
