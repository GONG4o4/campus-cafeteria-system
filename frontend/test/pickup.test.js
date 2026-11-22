import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getPickupReminderLines, getPickupConfirmationLines, PICKUP_LOCATION } from '../src/utils/pickup.js'

test('checkout reminder covers location, shared queue, Ready, nearby customers and no-show', () => {
  const text = getPickupReminderLines().map((line) => `${line.title} ${line.text}`).join(' ')

  assert.match(text, new RegExp(PICKUP_LOCATION))
  assert.match(text, /same queue as every other customer/)
  assert.match(text, /queue number only after your order and payment are confirmed/)
  assert.match(text, /status shows Ready/)
  assert.match(text, /near the cafeteria/)
  assert.match(text, /no-show/)
})

test('reminder does not invent pickup times, distances or fees', () => {
  const text = getPickupReminderLines().map((line) => line.text).join(' ')

  assert.doesNotMatch(text, /\d/)
  assert.doesNotMatch(text, /meter|metre|fee|fine|charge/i)
})

test('confirmation reminder shows the queue number from the backend', () => {
  const text = getPickupConfirmationLines(12).join(' ')

  assert.match(text, /queue number #12/)
  assert.match(text, /Ready/)
  assert.match(text, new RegExp(PICKUP_LOCATION))
})

test('confirmation reminder does not show a made-up queue number', () => {
  for (const missing of [undefined, null, 0, -1, '12', 1.5]) {
    const text = getPickupConfirmationLines(missing).join(' ')

    assert.match(text, /show your queue number/)
    assert.doesNotMatch(text, /#/)
  }
})

function listSourceFiles(folder) {
  let files = []

  for (const name of readdirSync(folder)) {
    const path = join(folder, name)

    if (statSync(path).isDirectory()) {
      files = files.concat(listSourceFiles(path))
    } else if (/\.(js|jsx)$/.test(name)) {
      files.push(path)
    }
  }

  return files
}

test('ordering never asks for the customer location (orders work from anywhere)', () => {
  for (const file of listSourceFiles(new URL('../src', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
    const code = readFileSync(file, 'utf8')

    assert.doesNotMatch(code, /navigator\.geolocation|getCurrentPosition|watchPosition/, file)
  }
})
