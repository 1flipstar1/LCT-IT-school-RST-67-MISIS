import { DATA_SCOPE, ROLE } from '../domain/roles.js';

/** Каталоги (ТЗ, требования к сервису, п. 1). Контакты и почты — вымышленные демо-данные. */

const contact = (id, name, position, email, phone) => ({ id, name, position, email, phone });

export const UNIVERSITIES = [
  {
    id: 'u1', name: 'Казанский федеральный университет', shortName: 'КФУ', city: 'Казань',
    contacts: [contact('u1-c1', 'Ирина Петрова', 'Проректор по цифровой трансформации', 'i.petrova@demo-kfu.ru', '+7 843 200-10-01')],
  },
  {
    id: 'u2', name: 'Университет ИТМО', shortName: 'ИТМО', city: 'Санкт-Петербург',
    contacts: [
      contact('u2-c1', 'Сергей Лавров', 'Директор ИТ-мегафакультета', 's.lavrov@demo-itmo.ru', '+7 812 300-20-02'),
      contact('u2-c2', 'Анна Григорьева', 'Методист', 'a.grigoreva@demo-itmo.ru', '+7 812 300-20-03'),
    ],
  },
  {
    id: 'u3', name: 'Уральский федеральный университет', shortName: 'УрФУ', city: 'Екатеринбург',
    contacts: [contact('u3-c1', 'Павел Никитин', 'Заведующий кафедрой ИТ', 'p.nikitin@demo-urfu.ru', '+7 343 400-30-04')],
  },
  {
    id: 'u4', name: 'Томский политехнический университет', shortName: 'ТПУ', city: 'Томск',
    contacts: [contact('u4-c1', 'Марина Зайцева', 'Руководитель центра компетенций', 'm.zaytseva@demo-tpu.ru', '+7 382 500-40-05')],
  },
  {
    id: 'u5', name: 'НИУ «Высшая школа экономики»', shortName: 'НИУ ВШЭ', city: 'Москва',
    contacts: [contact('u5-c1', 'Кирилл Андреев', 'Академический руководитель программы', 'k.andreev@demo-hse.ru', '+7 495 600-50-06')],
  },
  {
    id: 'u6', name: 'Дальневосточный федеральный университет', shortName: 'ДВФУ', city: 'Владивосток',
    contacts: [contact('u6-c1', 'Виктор Ли', 'Директор школы цифровой экономики', 'v.li@demo-dvfu.ru', '+7 423 700-60-07')],
  },
  {
    id: 'u7', name: 'Московский политехнический университет', shortName: 'Московский Политех', city: 'Москва',
    contacts: [contact('u7-c1', 'Татьяна Орехова', 'Декан факультета ИТ', 't.orehova@demo-mospolytech.ru', '+7 495 800-70-08')],
  },
  {
    id: 'u8', name: 'Южный федеральный университет', shortName: 'ЮФУ', city: 'Ростов-на-Дону',
    contacts: [contact('u8-c1', 'Роман Белов', 'Директор института компьютерных технологий', 'r.belov@demo-sfedu.ru', '+7 863 900-80-09')],
  },
  {
    id: 'u9', name: 'Новосибирский государственный университет', shortName: 'НГУ', city: 'Новосибирск',
    contacts: [contact('u9-c1', 'Екатерина Фомина', 'Заместитель декана ФИТ', 'e.fomina@demo-nsu.ru', '+7 383 100-90-10')],
  },
  {
    id: 'u10', name: 'Самарский университет им. С. П. Королёва', shortName: 'Самарский университет', city: 'Самара',
    contacts: [contact('u10-c1', 'Олег Сорокин', 'Заведующий кафедрой программных систем', 'o.sorokin@demo-ssau.ru', '+7 846 110-11-11')],
  },
  {
    id: 'u11', name: 'Нижегородский государственный университет им. Н. И. Лобачевского', shortName: 'ННГУ', city: 'Нижний Новгород',
    contacts: [contact('u11-c1', 'Юлия Медведева', 'Руководитель ИТ-академии', 'y.medvedeva@demo-unn.ru', '+7 831 120-12-12')],
  },
  {
    id: 'u12', name: 'Сибирский федеральный университет', shortName: 'СФУ', city: 'Красноярск',
    contacts: [contact('u12-c1', 'Андрей Волков', 'Директор института космических и информационных технологий', 'a.volkov@demo-sfu.ru', '+7 391 130-13-13')],
  },
];

export const DIRECTIONS = [
  { id: 'd1', name: 'DevOps' },
  { id: 'd2', name: 'Тестирование (QA)' },
  { id: 'd3', name: 'Аналитика данных' },
  { id: 'd4', name: 'Кибербезопасность' },
  { id: 'd5', name: 'Backend-разработка' },
  { id: 'd6', name: 'Frontend-разработка' },
  { id: 'd7', name: 'Машинное обучение' },
  { id: 'd8', name: 'Системное администрирование' },
];

export const PRODUCTS = [
  { id: 'p1', name: 'Astra Linux', vendor: 'Группа Астра' },
  { id: 'p2', name: 'РЕД ОС', vendor: 'РЕД СОФТ' },
  { id: 'p3', name: 'МойОфис', vendor: 'МойОфис' },
  { id: 'p4', name: 'Р7-Офис', vendor: 'Р7' },
  { id: 'p5', name: 'Postgres Pro', vendor: 'Postgres Professional' },
  { id: 'p6', name: 'Kaspersky Endpoint Security', vendor: 'Лаборатория Касперского' },
  { id: 'p7', name: 'DataLens', vendor: 'Яндекс' },
  { id: 'p8', name: '1С:Предприятие', vendor: '1С' },
];

const user = (id, name, email, role, leadId, scope) => ({
  id, name, email, role, leadId, active: true, access: { scope, directionIds: [] },
});

export const USERS = [
  user('usr-1', 'Алина Воронова', 'a.voronova@rt.ru', ROLE.manager, 'usr-6', DATA_SCOPE.own),
  user('usr-2', 'Михаил Орлов', 'm.orlov@rt.ru', ROLE.manager, 'usr-6', DATA_SCOPE.own),
  user('usr-3', 'Елена Ким', 'e.kim@rt.ru', ROLE.manager, 'usr-7', DATA_SCOPE.own),
  user('usr-4', 'Дмитрий Соколов', 'd.sokolov@rt.ru', ROLE.manager, 'usr-7', DATA_SCOPE.own),
  user('usr-5', 'Ольга Лебедева', 'o.lebedeva@rt.ru', ROLE.manager, 'usr-6', DATA_SCOPE.own),
  user('usr-6', 'Алексей Козлов', 'a.kozlov@rt.ru', ROLE.lead, null, DATA_SCOPE.team),
  user('usr-7', 'Наталья Белова', 'n.belova@rt.ru', ROLE.lead, null, DATA_SCOPE.team),
  user('usr-8', 'Ирина Смирнова', 'i.smirnova@rt.ru', ROLE.admin, null, DATA_SCOPE.all),
];

/** Под кем входим в демо-режиме для каждой роли. */
export const DEMO_USER_BY_ROLE = {
  [ROLE.manager]: 'usr-1',
  [ROLE.lead]: 'usr-6',
  [ROLE.admin]: 'usr-8',
};
