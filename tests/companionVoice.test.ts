import assert from 'node:assert/strict'
import test from 'node:test'
import { COMPANION_SYSTEM_INSTRUCTION } from '../src/server/evaluator/prompts.ts'
import { COMPANION_NEXT_ACTION_SYSTEM_PROMPT } from '../src/server/companion/prompts.ts'

test('evaluation prompt defines TRAZO as a concise implementation companion', () => {
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /natural, conversational Spanish/i)
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /2-5 short sentences/i)
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /never like a teacher grading homework/i)
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /Default to no humor/i)
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /Never call the learner's work "tu entrega"/i)
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /Do not list criterion labels, statuses, or a numbered checklist/i)
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /Never label the learner's input dismissively/i)
  assert.match(COMPANION_SYSTEM_INSTRUCTION, /Use UNVERIFIABLE when there is a plausible but unresolved ambiguity/i)
})

test('next-action prompt keeps the companion direct and bounded', () => {
  assert.match(COMPANION_NEXT_ACTION_SYSTEM_PROMPT, /smallest useful question/i)
  assert.match(COMPANION_NEXT_ACTION_SYSTEM_PROMPT, /under 70 words/i)
  assert.match(COMPANION_NEXT_ACTION_SYSTEM_PROMPT, /generic praise or filler/i)
})
