// 1단계: 저장 계층 (PRD FR-8, 11절)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, makeStorage } from './harness.mjs';

const KEY = 'todo-app-v1';
const CORRUPT = 'todo-app-v1.corrupt';

const validTodo = () => ({
  id: '1759363200000-k3x9f',
  title: '보고서 초안 쓰기',
  category: '업무',
  done: false,
  createdAt: 1759363200000,
});

const stored = (todos) => JSON.stringify({ version: 1, todos });

test('상수가 PRD에 명시된 값과 일치한다', async () => {
  const { app } = await loadApp();
  assert.equal(app.STORAGE_KEY, KEY);
  assert.equal(app.CORRUPT_KEY, CORRUPT);
  assert.equal(app.SCHEMA_VERSION, 1);
  assert.deepEqual(app.CATEGORIES, ['업무', '개인', '공부']);
});

test('isValidTodo: 올바른 항목을 통과시킨다', async () => {
  const { app } = await loadApp();
  assert.equal(app.isValidTodo(validTodo()), true);
});

test('isValidTodo: 필드가 어긋난 항목을 거부한다', async () => {
  const { app } = await loadApp();
  const bad = [
    ['id 없음', { ...validTodo(), id: '' }],
    ['id가 숫자', { ...validTodo(), id: 123 }],
    ['title 빈 문자열', { ...validTodo(), title: '' }],
    ['title 공백만', { ...validTodo(), title: '   ' }],
    ['알 수 없는 카테고리', { ...validTodo(), category: '운동' }],
    ['done이 boolean 아님', { ...validTodo(), done: 'false' }],
    ['createdAt이 NaN', { ...validTodo(), createdAt: NaN }],
    ['createdAt이 문자열', { ...validTodo(), createdAt: '1759363200000' }],
    ['객체 아님', null],
    ['배열', []],
  ];
  for (const [label, value] of bad) {
    assert.equal(app.isValidTodo(value), false, label);
  }
});

test('loadState: 저장된 데이터가 없으면 빈 상태로 시작한다', async () => {
  const { app } = await loadApp();
  assert.deepEqual(app.loadState(), { todos: [], mode: 'persistent', error: null });
});

test('loadState: 저장된 항목을 복원한다', async () => {
  const todo = validTodo();
  const { app } = await loadApp({ storage: makeStorage({ [KEY]: stored([todo]) }) });
  const state = app.loadState();
  assert.equal(state.error, null);
  assert.equal(state.mode, 'persistent');
  assert.deepEqual(state.todos, [todo]);
});

test('loadState: JSON이 깨졌으면 원본을 .corrupt로 옮기고 빈 상태로 시작한다', async () => {
  const broken = '{깨진';
  const storage = makeStorage({ [KEY]: broken });
  const { app } = await loadApp({ storage });

  const state = app.loadState();
  assert.equal(state.error, 'corrupt');
  assert.deepEqual(state.todos, []);

  const after = storage.dump();
  assert.equal(after[CORRUPT], broken, '원본이 .corrupt에 보존되어야 한다');
  assert.equal(after[KEY], undefined, '원래 키는 제거되어야 한다');
});

test('loadState: todos가 배열이 아니면 손상으로 처리한다', async () => {
  const raw = JSON.stringify({ version: 1, todos: { a: 1 } });
  const storage = makeStorage({ [KEY]: raw });
  const { app } = await loadApp({ storage });

  assert.equal(app.loadState().error, 'corrupt');
  assert.equal(storage.dump()[CORRUPT], raw);
});

test('loadState: 최상위가 객체가 아니면 손상으로 처리한다', async () => {
  const raw = JSON.stringify([validTodo()]);
  const { app } = await loadApp({ storage: makeStorage({ [KEY]: raw }) });
  assert.equal(app.loadState().error, 'corrupt');
});

// Review Focus 4 — 알 수 없는 카테고리가 섞이면 진행률 3줄 합이 전체와 어긋난다.
// 항목 단위 검증에서 걸러 전체를 손상으로 처리하고, 원본은 .corrupt에 남긴다.
test('loadState: 알 수 없는 카테고리를 가진 항목이 있으면 손상으로 처리하고 원본을 보존한다', async () => {
  const raw = stored([validTodo(), { ...validTodo(), id: 'x', category: '운동' }]);
  const storage = makeStorage({ [KEY]: raw });
  const { app } = await loadApp({ storage });

  const state = app.loadState();
  assert.equal(state.error, 'corrupt');
  assert.deepEqual(state.todos, []);
  assert.equal(storage.dump()[CORRUPT], raw, '원본이 날아가지 않아야 한다');
});

test('loadState: 저장소가 차단되면 메모리 모드로 떨어진다', async () => {
  const storage = makeStorage({}, { throwOnAccess: true });
  const { app } = await loadApp({ storage });
  assert.deepEqual(app.loadState(), { todos: [], mode: 'memory', error: 'blocked' });
});

test('saveState: version과 todos를 함께 저장한다', async () => {
  const storage = makeStorage();
  const { app } = await loadApp({ storage });
  const todo = validTodo();

  assert.deepEqual(app.saveState([todo]), { ok: true, error: null });
  assert.deepEqual(JSON.parse(storage.dump()[KEY]), { version: 1, todos: [todo] });
});

test('saveState: 용량을 초과하면 quota 오류를 돌려준다', async () => {
  const storage = makeStorage({}, { quota: true });
  const { app } = await loadApp({ storage });
  assert.deepEqual(app.saveState([validTodo()]), { ok: false, error: 'quota' });
});

test('saveState: 저장소가 차단되면 blocked 오류를 돌려준다', async () => {
  const storage = makeStorage({}, { throwOnAccess: true });
  const { app } = await loadApp({ storage });
  assert.deepEqual(app.saveState([validTodo()], 'persistent'), { ok: false, error: 'blocked' });
});

test('saveState: 메모리 모드에서는 저장을 시도하지 않고 성공으로 보고한다', async () => {
  const storage = makeStorage();
  const { app } = await loadApp({ storage });

  assert.deepEqual(app.saveState([validTodo()], 'memory'), { ok: true, error: null });
  assert.deepEqual(storage.dump(), {}, '메모리 모드에서는 아무것도 쓰지 않아야 한다');
});

test('loadState/saveState 왕복: 저장한 내용이 그대로 복원된다', async () => {
  const storage = makeStorage();
  const { app } = await loadApp({ storage });
  const todos = [
    validTodo(),
    { id: 'b-2', title: '장보기', category: '개인', done: true, createdAt: 1759363300000 },
    { id: 'c-3', title: '알고리즘 3문제', category: '공부', done: false, createdAt: 1759363400000 },
  ];

  app.saveState(todos);
  const state = app.loadState();
  assert.equal(state.error, null);
  assert.deepEqual(state.todos, todos);
});
