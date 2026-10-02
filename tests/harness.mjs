// 테스트 하네스.
//
// index.html 은 유일한 프로덕션 파일이고 그 안에 CSS와 JS가 인라인되어 있다(PRD D-5).
// 그래서 로직을 import 할 수가 없다. 대신 <script> 본문을 꺼내 node:vm 컨텍스트에서
// 실행하고, 앱이 window.__app 에 노출한 함수들을 집어온다.
//
// 컨텍스트에 document 를 주지 않는다. 앱의 INIT 이
// `typeof document !== 'undefined'` 가드 안에 있으므로 DOM 초기화가 돌지 않고,
// STORAGE·LOGIC 계층만 깨끗하게 테스트할 수 있다.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_HTML = path.join(REPO_ROOT, 'index.html');

/**
 * localStorage 테스트 더블.
 *
 * @param initial  미리 채워둘 키/값
 * @param throwOnAccess  모든 접근이 예외를 던진다 (시크릿 모드/정책 차단 재현)
 * @param quota  setItem 이 QuotaExceededError 를 던진다. getItem 은 정상 동작하므로
 *               앱의 가용성 probe(getItem)는 통과하고 저장만 실패한다.
 */
export function makeStorage(initial = {}, { throwOnAccess = false, quota = false } = {}) {
  const data = new Map(Object.entries(initial));

  const guard = () => {
    if (throwOnAccess) {
      const e = new Error('access denied');
      e.name = 'SecurityError';
      throw e;
    }
  };

  return {
    getItem(key) {
      guard();
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      guard();
      if (quota) {
        const e = new Error('quota exceeded');
        e.name = 'QuotaExceededError';
        throw e;
      }
      data.set(key, String(value));
    },
    removeItem(key) {
      guard();
      data.delete(key);
    },
    // 검사용. guard 를 거치지 않으므로 차단된 저장소도 들여다볼 수 있다.
    dump() {
      return Object.fromEntries(data);
    },
  };
}

/** index.html 에서 src 없는 <script> 본문을 모두 모아 반환한다. */
async function readInlineScript() {
  const html = await readFile(INDEX_HTML, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (blocks.length === 0) {
    throw new Error('index.html 안에 인라인 <script> 블록이 없다');
  }
  return blocks.map((m) => m[1]).join('\n;\n');
}

/**
 * vm 컨텍스트에서 건너온 값을 테스트 렐름의 평범한 객체로 바꾼다.
 *
 * vm 은 자신만의 intrinsics 를 갖는다. 그래서 컨텍스트 안에서 만들어진 객체와
 * 배열은 프로토타입이 테스트 렐름의 것과 달라, 내용이 완전히 같아도
 * assert.deepEqual(strict) 이 "same structure but not reference-equal" 로 거부한다.
 * JSON 왕복으로 프로토타입을 테스트 렐름 쪽으로 맞춘다.
 *
 * 앱이 주고받는 값은 전부 JSON 으로 표현 가능한 데이터이므로 손실이 없다.
 * 참조 동일성이 필요한 검사에는 쓸 수 없다 — 그럴 때는 rawApp 을 쓴다.
 */
export function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * 앱 스크립트를 격리된 컨텍스트에서 실행하고 window.__app 을 돌려준다.
 *
 * app      반환값이 자동으로 정규화된 파사드. 평소에는 이걸 쓴다.
 * rawApp   정규화하지 않은 원본. 참조 동일성을 봐야 할 때만 쓴다.
 */
export async function loadApp({ storage = makeStorage() } = {}) {
  const code = await readInlineScript();

  const win = { localStorage: storage };
  const sandbox = { window: win, localStorage: storage, console };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'index.html' });

  const rawApp = win.__app;
  if (!rawApp) {
    throw new Error('앱이 window.__app 을 노출하지 않았다');
  }

  const app = {};
  for (const [key, value] of Object.entries(rawApp)) {
    app[key] = typeof value === 'function'
      ? (...args) => plain(value(...args))
      : plain(value);
  }

  return { app, rawApp, win, storage };
}
