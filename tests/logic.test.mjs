// 2단계: 로직 계층 (PRD FR-1~FR-7의 계산 부분)
//
// 전부 순수 함수다. 입력 배열과 그 안의 항목을 변경하지 않고 새 배열을 돌려주는지
// 매번 확인한다 — 이게 깨지면 "되돌리기"와 "원본 보존"이 조용히 망가진다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const todo = (over = {}) => ({
  id: 'id-1',
  title: '보고서 초안',
  category: '업무',
  done: false,
  createdAt: 1000,
  ...over,
});

const sample = () => [
  todo({ id: 'a', title: '보고서', category: '업무', done: false, createdAt: 1 }),
  todo({ id: 'b', title: '장보기', category: '개인', done: true, createdAt: 2 }),
  todo({ id: 'c', title: '알고리즘', category: '공부', done: false, createdAt: 3 }),
  todo({ id: 'd', title: '회의 준비', category: '업무', done: true, createdAt: 4 }),
];

/* ---------------- createTodo ---------------- */

test('createTodo: 제목이 공백뿐이면 null을 돌려준다 (예외를 던지지 않는다)', async () => {
  const { app } = await loadApp();
  assert.equal(app.createTodo('', '업무'), null);
  assert.equal(app.createTodo('   ', '업무'), null);
  assert.equal(app.createTodo('\t\n ', '업무'), null);
});

test('createTodo: 알 수 없는 카테고리면 null을 돌려준다', async () => {
  const { app } = await loadApp();
  assert.equal(app.createTodo('운동하기', '운동'), null);
  assert.equal(app.createTodo('운동하기', ''), null);
});

test('createTodo: 제목 앞뒤 공백을 제거하고 올바른 항목을 만든다', async () => {
  const { app } = await loadApp();
  const t = app.createTodo('  보고서 초안  ', '업무');

  assert.equal(t.title, '보고서 초안');
  assert.equal(t.category, '업무');
  assert.equal(t.done, false);
  assert.equal(typeof t.id, 'string');
  assert.ok(t.id.length > 0);
  assert.equal(typeof t.createdAt, 'number');
  assert.ok(Number.isFinite(t.createdAt));
  assert.equal(app.isValidTodo(t), true);
});

test('createTodo: 같은 밀리초에 여러 번 호출해도 id가 충돌하지 않는다', async () => {
  const { app } = await loadApp();
  const ids = new Set();
  for (let i = 0; i < 200; i++) ids.add(app.createTodo('x', '업무').id);
  assert.equal(ids.size, 200);
});

/* ---------------- addTodo ---------------- */

test('addTodo: 맨 뒤에 추가한다', async () => {
  const { app } = await loadApp();
  const list = app.addTodo(sample(), '새 항목', '공부');
  assert.equal(list.length, 5);
  assert.equal(list[4].title, '새 항목');
  assert.equal(list[4].category, '공부');
});

test('addTodo: 빈 제목이면 목록을 그대로 돌려준다', async () => {
  const { app } = await loadApp();
  const before = sample();
  assert.deepEqual(app.addTodo(before, '  ', '업무'), before);
});

test('addTodo: 원본 배열과 항목을 변경하지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  app.addTodo(before, '새 항목', '공부');
  assert.equal(before.length, 4);
  assert.deepEqual(before, sample());
});

/* ---------------- updateTitle ---------------- */

test('updateTitle: 제목을 바꾸고 앞뒤 공백을 제거한다', async () => {
  const { app } = await loadApp();
  const list = app.updateTitle(sample(), 'b', '  장보기 수정  ');
  assert.equal(list[1].title, '장보기 수정');
  assert.equal(list[1].id, 'b');
});

test('updateTitle: 빈 제목이면 아무것도 바꾸지 않는다 (삭제가 아니다)', async () => {
  const { app } = await loadApp();
  const before = sample();
  assert.deepEqual(app.updateTitle(before, 'b', ''), before);
  assert.deepEqual(app.updateTitle(before, 'b', '   '), before);
  assert.equal(app.updateTitle(before, 'b', '').length, 4);
});

test('updateTitle: 없는 id면 아무것도 바꾸지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  assert.deepEqual(app.updateTitle(before, 'nope', '아무거나'), before);
});

test('updateTitle: 원본 배열과 항목을 변경하지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  app.updateTitle(before, 'b', '바뀐 제목');
  assert.deepEqual(before, sample());
});

/* ---------------- updateCategory ---------------- */

test('updateCategory: 카테고리를 바꾼다', async () => {
  const { app } = await loadApp();
  const list = app.updateCategory(sample(), 'a', '공부');
  assert.equal(list[0].category, '공부');
});

test('updateCategory: 알 수 없는 카테고리면 아무것도 바꾸지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  assert.deepEqual(app.updateCategory(before, 'a', '운동'), before);
});

test('updateCategory: 원본 배열과 항목을 변경하지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  app.updateCategory(before, 'a', '공부');
  assert.deepEqual(before, sample());
});

/* ---------------- toggleDone ---------------- */

test('toggleDone: 완료 여부를 뒤집는다', async () => {
  const { app } = await loadApp();
  assert.equal(app.toggleDone(sample(), 'a')[0].done, true);
  assert.equal(app.toggleDone(sample(), 'b')[1].done, false);
});

test('toggleDone: 원본 배열과 항목을 변경하지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  app.toggleDone(before, 'a');
  assert.deepEqual(before, sample(), '원본 항목의 done이 그대로여야 한다');
});

/* ---------------- removeTodo / restoreTodo ---------------- */

test('removeTodo: 항목과 그 인덱스를 함께 돌려준다', async () => {
  const { app } = await loadApp();
  const r = app.removeTodo(sample(), 'b');
  assert.equal(r.list.length, 3);
  assert.equal(r.index, 1);
  assert.equal(r.removed.id, 'b');
  assert.equal(r.list.some((t) => t.id === 'b'), false);
});

test('removeTodo: 없는 id면 removed는 null, index는 -1이다', async () => {
  const { app } = await loadApp();
  const r = app.removeTodo(sample(), 'nope');
  assert.equal(r.removed, null);
  assert.equal(r.index, -1);
  assert.deepEqual(r.list, sample());
});

test('removeTodo: 원본 배열을 변경하지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  app.removeTodo(before, 'b');
  assert.deepEqual(before, sample());
});

test('restoreTodo: 원래 인덱스에 되돌려 놓는다', async () => {
  const { app } = await loadApp();
  const r = app.removeTodo(sample(), 'b');
  const restored = app.restoreTodo(r.list, r.removed, r.index);
  assert.deepEqual(restored, sample(), '삭제 전과 순서·내용이 같아야 한다');
});

test('restoreTodo: 인덱스가 범위를 벗어나면 맨 뒤에 붙인다', async () => {
  const { app } = await loadApp();
  const list = app.restoreTodo(sample(), todo({ id: 'z', title: '끝' }), 99);
  assert.equal(list.length, 5);
  assert.equal(list[4].id, 'z');

  const negative = app.restoreTodo(sample(), todo({ id: 'z', title: '끝' }), -1);
  assert.equal(negative[4].id, 'z');
});

test('restoreTodo: 맨 앞 항목도 제자리에 복원된다', async () => {
  const { app } = await loadApp();
  const r = app.removeTodo(sample(), 'a');
  assert.deepEqual(app.restoreTodo(r.list, r.removed, r.index), sample());
});

/* ---------------- restoreMany (되돌리기 대기 중인 삭제 전부 복원) ---------------- */
//
// 삭제 버튼을 누르면 다음 행이 같은 픽셀로 올라온다. 더블클릭하면 서로 다른
// 두 항목이 지워지는데, 되돌리기 슬롯이 하나뿐이면 먼저 지워진 항목은
// 영구히 사라진다. 대기 중인 삭제를 전부 되돌릴 수 있어야 한다.

test('restoreMany: 대기 중인 삭제가 없으면 목록을 그대로 돌려준다', async () => {
  const { app } = await loadApp();
  assert.deepEqual(app.restoreMany(sample(), []), sample());
});

test('restoreMany: 한 건은 restoreTodo와 같은 결과를 낸다', async () => {
  const { app } = await loadApp();
  const r = app.removeTodo(sample(), 'b');
  assert.deepEqual(
    app.restoreMany(r.list, [{ todo: r.removed, index: r.index }]),
    sample()
  );
});

test('restoreMany: 같은 자리를 연속으로 두 번 지워도 둘 다 제자리로 돌아온다', async () => {
  const { app } = await loadApp();
  // 더블클릭 상황: b를 지우면 c가 같은 자리로 올라오고, 두 번째 클릭이 c를 지운다.
  const first = app.removeTodo(sample(), 'b');
  const second = app.removeTodo(first.list, 'c');
  const pending = [
    { todo: first.removed, index: first.index },
    { todo: second.removed, index: second.index },
  ];

  assert.equal(second.list.length, 2);
  assert.deepEqual(app.restoreMany(second.list, pending), sample());
});

test('restoreMany: 서로 떨어진 위치의 삭제도 모두 제자리로 돌아온다', async () => {
  const { app } = await loadApp();
  const first = app.removeTodo(sample(), 'a');
  const second = app.removeTodo(first.list, 'd');
  const pending = [
    { todo: first.removed, index: first.index },
    { todo: second.removed, index: second.index },
  ];
  assert.deepEqual(app.restoreMany(second.list, pending), sample());
});

test('restoreMany: 세 건 연속 삭제도 전부 복원된다', async () => {
  const { app } = await loadApp();
  let list = sample();
  const pending = [];
  for (const id of ['b', 'c', 'd']) {
    const r = app.removeTodo(list, id);
    pending.push({ todo: r.removed, index: r.index });
    list = r.list;
  }
  assert.equal(list.length, 1);
  assert.deepEqual(app.restoreMany(list, pending), sample());
});

test('restoreMany: 원본 배열을 변경하지 않는다', async () => {
  const { app } = await loadApp();
  const r = app.removeTodo(sample(), 'b');
  const before = r.list.slice();
  app.restoreMany(r.list, [{ todo: r.removed, index: r.index }]);
  assert.deepEqual(r.list, before);
});

/* ---------------- filterTodos ---------------- */

test('filterTodos: 상태 축으로 거른다', async () => {
  const { app } = await loadApp();
  const list = sample();
  assert.deepEqual(app.filterTodos(list, { status: 'all', category: 'all' }).map((t) => t.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(app.filterTodos(list, { status: 'active', category: 'all' }).map((t) => t.id), ['a', 'c']);
  assert.deepEqual(app.filterTodos(list, { status: 'done', category: 'all' }).map((t) => t.id), ['b', 'd']);
});

test('filterTodos: 카테고리 축으로 거른다', async () => {
  const { app } = await loadApp();
  const list = sample();
  assert.deepEqual(app.filterTodos(list, { status: 'all', category: '업무' }).map((t) => t.id), ['a', 'd']);
  assert.deepEqual(app.filterTodos(list, { status: 'all', category: '공부' }).map((t) => t.id), ['c']);
});

test('filterTodos: 두 축이 독립적으로 결합된다', async () => {
  const { app } = await loadApp();
  const list = sample();
  assert.deepEqual(app.filterTodos(list, { status: 'active', category: '업무' }).map((t) => t.id), ['a']);
  assert.deepEqual(app.filterTodos(list, { status: 'done', category: '업무' }).map((t) => t.id), ['d']);
  assert.deepEqual(app.filterTodos(list, { status: 'active', category: '개인' }).map((t) => t.id), []);
});

test('filterTodos: 정렬하지 않고 입력 순서를 유지한다', async () => {
  const { app } = await loadApp();
  // 완료 항목을 아래로 밀면 체크하려던 대상이 눈앞에서 움직인다 (PRD 6절)
  const list = sample();
  assert.deepEqual(app.filterTodos(list, { status: 'all', category: 'all' }).map((t) => t.id), ['a', 'b', 'c', 'd']);
});

test('filterTodos: 원본 배열을 변경하지 않는다', async () => {
  const { app } = await loadApp();
  const before = sample();
  app.filterTodos(before, { status: 'done', category: '업무' });
  assert.deepEqual(before, sample());
});

/* ---------------- calcProgress ---------------- */

test('calcProgress: 전체 기준으로 센다', async () => {
  const { app } = await loadApp();
  assert.deepEqual(app.calcProgress(sample()), { done: 2, total: 4, percent: 50 });
});

test('calcProgress: 카테고리를 생략한 것과 "all"을 넘긴 것이 같다', async () => {
  const { app } = await loadApp();
  assert.deepEqual(app.calcProgress(sample()), app.calcProgress(sample(), 'all'));
});

test('calcProgress: 카테고리별로 센다', async () => {
  const { app } = await loadApp();
  const list = sample();
  assert.deepEqual(app.calcProgress(list, '업무'), { done: 1, total: 2, percent: 50 });
  assert.deepEqual(app.calcProgress(list, '개인'), { done: 1, total: 1, percent: 100 });
  assert.deepEqual(app.calcProgress(list, '공부'), { done: 0, total: 1, percent: 0 });
});

// T-17 — 세 줄의 합이 전체와 어긋나면 진행률이 거짓말을 한다.
test('calcProgress: 카테고리별 합이 전체와 일치한다', async () => {
  const { app } = await loadApp();
  const list = sample();
  const cats = app.CATEGORIES.map((c) => app.calcProgress(list, c));
  const total = app.calcProgress(list);

  assert.equal(cats.reduce((s, p) => s + p.total, 0), total.total);
  assert.equal(cats.reduce((s, p) => s + p.done, 0), total.done);
});

test('calcProgress: 빈 목록은 0/0 0%이고 NaN이 나오지 않는다', async () => {
  const { app } = await loadApp();
  const p = app.calcProgress([]);
  assert.deepEqual(p, { done: 0, total: 0, percent: 0 });
  assert.equal(Number.isNaN(p.percent), false);
  assert.equal(Number.isFinite(p.percent), true);
});

test('calcProgress: 해당 카테고리에 항목이 없어도 0/0 0%이다', async () => {
  const { app } = await loadApp();
  const onlyWork = [todo({ id: 'a', category: '업무' })];
  assert.deepEqual(app.calcProgress(onlyWork, '공부'), { done: 0, total: 0, percent: 0 });
});

test('calcProgress: 백분율을 정수로 반올림한다', async () => {
  const { app } = await loadApp();
  const three = [
    todo({ id: '1', done: true }),
    todo({ id: '2', done: false }),
    todo({ id: '3', done: false }),
  ];
  assert.equal(app.calcProgress(three).percent, 33); // 33.33 -> 33

  const twoOfThree = [
    todo({ id: '1', done: true }),
    todo({ id: '2', done: true }),
    todo({ id: '3', done: false }),
  ];
  assert.equal(app.calcProgress(twoOfThree).percent, 67); // 66.67 -> 67
});
