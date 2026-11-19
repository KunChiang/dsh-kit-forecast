/**
 * 图表视窗算术：缩放锚点、边界收敛、平移、像素→下标。
 * 这些一旦算错，表现是「缩放后跳到别的日期」或者「悬停数据对不上」，
 * 在界面上很难发现，所以单独测。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { indexAtX, MIN_VISIBLE, normalizeView, panView, tailView, visibleCount, zoomView } from '../src/client/view.js'

const TOTAL = 180

test('全览状态用 count=0 表示', () => {
  assert.deepEqual(normalizeView({ start: 0, count: 0 }, TOTAL), { start: 0, count: 0 })
  assert.deepEqual(normalizeView(null, TOTAL), { start: 0, count: 0 })
  assert.equal(visibleCount({ start: 0, count: 0 }, TOTAL), TOTAL)
})

test('缩放不会越界，也不会小于最小根数', () => {
  for (let i = 0; i < 40; i += 1) {
    const next = zoomView({ start: 0, count: 0 }, TOTAL, 0.5)
    assert.ok(next.count >= MIN_VISIBLE)
    assert.ok(next.count <= TOTAL)
    assert.ok(next.start >= 0)
    assert.ok(next.start + next.count <= TOTAL)
  }
  // 一直放大到极限仍合法
  let view = { start: 0, count: 0 }
  for (let i = 0; i < 30; i += 1) view = zoomView(view, TOTAL, 0.5)
  assert.equal(view.count, MIN_VISIBLE)
  // 一直缩小会回到全览
  for (let i = 0; i < 30; i += 1) view = zoomView(view, TOTAL, 2)
  assert.deepEqual(view, { start: 0, count: 0 })
})

test('缩放以光标为锚点：锚点前后比例保持不变', () => {
  const view = { start: 40, count: 100 }
  const pivot = 90 // 在视窗里占 50%
  const next = zoomView(view, TOTAL, 0.5, pivot)
  const ratioBefore = (pivot - view.start) / view.count
  const ratioAfter = (pivot - next.start) / next.count
  assert.ok(Math.abs(ratioBefore - ratioAfter) < 0.02, `锚点漂移：${ratioBefore} -> ${ratioAfter}`)
})

test('缩放锚点在视窗外时会被夹到边缘', () => {
  const next = zoomView({ start: 40, count: 100 }, TOTAL, 0.5, -999)
  assert.ok(next.start >= 0)
  assert.equal((next.start + next.count) <= TOTAL, true)
})

test('平移会停在两端', () => {
  const view = { start: 40, count: 100 }
  assert.equal(panView(view, TOTAL, -999).start, 0)
  assert.equal(panView(view, TOTAL, 999).start, TOTAL - 100)
  // 全览状态不平移
  assert.deepEqual(panView({ start: 0, count: 0 }, TOTAL, 10), { start: 0, count: 0 })
})

test('tailView 贴住最新一端', () => {
  assert.deepEqual(tailView(TOTAL, 60), { start: 120, count: 60 })
  assert.deepEqual(tailView(TOTAL, TOTAL + 10), { start: 0, count: 0 })
  assert.equal(tailView(TOTAL, 2).count, MIN_VISIBLE)
})

test('indexAtX 把像素换算成 bar 下标，并夹在视窗内', () => {
  const geom = { plotLeft: 10, step: 5, viewStart: 20, viewCount: 100 }
  // 第 0 根画在 left + step/2 = 12.5
  assert.equal(indexAtX(geom, 12.5), 20)
  assert.equal(indexAtX(geom, 12.5 + 5), 21)
  // 越过左边界夹到 viewStart
  assert.equal(indexAtX(geom, 0), 20)
  // 越过右边界夹到最后一根
  assert.equal(indexAtX(geom, 99999), 119)
})

test('indexAtX 在 zoomView 之后仍与光标一致', () => {
  const geom = { plotLeft: 8, step: 4, viewStart: 0, viewCount: TOTAL }
  const pivotX = 8 + 4 * (90 + 0.5)
  assert.equal(indexAtX(geom, pivotX), 90)
  const zoomed = zoomView({ start: 0, count: 0 }, TOTAL, 0.5, indexAtX(geom, pivotX))
  const newGeom = { plotLeft: 8, step: 8, viewStart: zoomed.start, viewCount: zoomed.count }
  const after = indexAtX(newGeom, pivotX)
  assert.ok(Math.abs(after - 90) <= 2, `锚点应从 90 附近落在 ${after}`)
})
