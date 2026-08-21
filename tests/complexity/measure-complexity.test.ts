import { describe, expect, it } from 'vitest';
import { extractFunctions, parseFunctions } from '../../src/complexity/extract-functions.js';
import { measureComplexity } from '../../src/complexity/measure-complexity.js';

describe('measureComplexity', () => {
  it.each([
    ['base function', 'function subject() {}', 1],
    ['if', 'function subject() { if (true) {} }', 2],
    ['ternary', 'function subject() { return true ? 1 : 0; }', 2],
    ['for loop', 'function subject() { for (;;) { break; } }', 2],
    ['for-in loop', 'function subject() { for (const key in {}) {} }', 2],
    ['for-of loop', 'function subject() { for (const value of []) {} }', 2],
    ['while loop', 'function subject() { while (false) {} }', 2],
    ['do loop', 'function subject() { do {} while (false); }', 2],
    ['catch', 'function subject() { try {} catch {} }', 2],
    ['non-default case', 'function subject() { switch (1) { case 1: break; } }', 2],
    ['logical and', 'function subject() { return true && false; }', 2],
    ['logical or', 'function subject() { return true || false; }', 2],
    ['nullish coalescing', 'function subject() { return undefined ?? 1; }', 2],
    ['else', 'function subject() { if (true) {} else {} }', 2],
    ['default case', 'function subject() { switch (1) { default: break; } }', 1],
    ['try and finally', 'function subject() { try {} finally {} }', 1],
    ['optional chain', 'function subject(value?: { field?: number }) { return value?.field; }', 1],
    ['default parameter', 'function subject(value = 1) { return value; }', 1],
    ['static block', 'function subject() { class Nested { static {} } }', 1],
  ])('counts %s decisions', (_description, source, expected) => {
    const parsed = parseFunctions('src/subject.ts', source).find(({ name }) => name === 'subject');

    expect(parsed).toBeDefined();
    expect(measureComplexity(parsed!)).toBe(expected);
  });
});

describe('extractFunctions', () => {
  it('measures each function without including nested decisions in its parent', () => {
    const functions = extractFunctions('src/nested.ts', `
  function outer(value: number) {
    const inner = () => value && value > 1;
    return value ? inner() : 0;
  }
`);

    expect(functions.map(({ name, complexity }) => [name, complexity])).toEqual([
      ['outer', 2],
      ['inner', 2],
    ]);
  });
});
