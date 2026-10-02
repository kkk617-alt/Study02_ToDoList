// 3단계: 렌더링 중 DOM 없이 검증할 수 있는 부분.
//
// renderList/renderProgress 는 DOM 이 필요하므로 브라우저에서 확인한다.
// emptyMessage 는 순수 함수로 떼어냈기 때문에 여기서 전수 검사가 가능하다 —
// 필터 조합마다 자연스러운 한국어가 나오는지는 눈으로 보지 않으면 놓치기 쉽다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const STATUSES = ['all', 'active', 'done'];

test('emptyMessage: 모든 상태 × 카테고리 조합이 비어있지 않은 문구를 돌려준다', async () => {
  const { app } = await loadApp();
  const categories = ['all'].concat(app.CATEGORIES);

  for (const status of STATUSES) {
    for (const category of categories) {
      const message = app.emptyMessage({ status, category }, 5);
      assert.equal(typeof message, 'string', `${status}/${category}`);
      assert.ok(message.trim().length > 0, `${status}/${category} 가 빈 문구다`);
      assert.equal(message.includes('undefined'), false, `${status}/${category} 에 undefined가 샜다`);
    }
  }
});

// 첫 사용자는 기본 필터가 '진행중'이라는 사정을 모른다. 할 일이 하나도 없는데
// "진행중인 할 일이 없습니다"라고 하면 무엇을 해야 할지 알려주지 못한다.
test('emptyMessage: 할 일이 하나도 없으면 필터와 무관하게 첫 사용을 안내한다', async () => {
  const { app } = await loadApp();
  const categories = ['all'].concat(app.CATEGORIES);

  for (const status of STATUSES) {
    for (const category of categories) {
      assert.equal(
        app.emptyMessage({ status, category }, 0),
        '첫 할 일을 추가해보세요',
        `${status}/${category} 에서 첫 사용 안내가 아니다`
      );
    }
  }
});

test('emptyMessage: 할 일은 있는데 조건에 맞는 것만 없으면 조건을 설명한다', async () => {
  const { app } = await loadApp();
  assert.equal(app.emptyMessage({ status: 'active', category: 'all' }, 5), '진행중인 할 일이 없습니다');
  assert.equal(app.emptyMessage({ status: 'done', category: 'all' }, 5), '완료한 할 일이 없습니다');
});

test('emptyMessage: 카테고리만 걸었을 때', async () => {
  const { app } = await loadApp();
  assert.equal(app.emptyMessage({ status: 'all', category: '업무' }, 5), '업무 할 일이 없습니다');
  assert.equal(app.emptyMessage({ status: 'all', category: '공부' }, 5), '공부 할 일이 없습니다');
});

test('emptyMessage: 두 축을 모두 걸었을 때', async () => {
  const { app } = await loadApp();
  assert.equal(app.emptyMessage({ status: 'active', category: '공부' }, 5), '진행중인 공부 할 일이 없습니다');
  assert.equal(app.emptyMessage({ status: 'done', category: '개인' }, 5), '완료한 개인 할 일이 없습니다');
});

test('emptyMessage: 조건을 아무것도 걸지 않았는데 결과가 없으면 첫 사용을 안내한다', async () => {
  const { app } = await loadApp();
  assert.equal(app.emptyMessage({ status: 'all', category: 'all' }, 5), '첫 할 일을 추가해보세요');
});

test('emptyMessage: 카테고리 이름이 문구에 그대로 들어간다', async () => {
  const { app } = await loadApp();
  for (const category of app.CATEGORIES) {
    assert.ok(
      app.emptyMessage({ status: 'active', category }, 5).includes(category),
      `${category} 가 문구에 없다`
    );
  }
});
