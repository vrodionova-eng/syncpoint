import { el, textField, crudView } from '../ui.js';

export function spacesView(mount, api) {
  crudView(mount, {
    entity: 'spaces',
    addLabel: 'Добавить пространство',
    render: (s) => el('div', {}, [el('b', {}, s.name)]),
    buildForm: (item) => {
      const name = textField('Название', item?.name || '');
      return { body: el('div', {}, [name.field]), collect: () => ({ name: name.input.value }) };
    },
  }, api);
}
