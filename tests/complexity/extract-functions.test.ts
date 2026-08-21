import { describe, expect, it } from 'vitest';
import { parseFunctions } from '../../src/complexity/extract-functions.js';

describe('parseFunctions', () => {
  it('extracts supported TypeScript function forms in source order', () => {
    const source = `function declared() {}
const assigned = () => {};

class Widget {
  constructor() {}
  render() {}
  get value() { return 1; }
}

const object = {
  run() {}
};

function outer() {









     [1].map(function () {});
}`;

    const functions = parseFunctions('src/example.ts', source);

    expect(functions.map((fn) => fn.name)).toEqual([
      'declared',
      'assigned',
      'Widget.constructor',
      'Widget.render',
      'Widget.value',
      'object.run',
      'outer',
      'src/example.ts:24:14',
    ]);
    expect(functions[0]?.id).toBe('src/example.ts:1:1-1:23');
  });

  it('excludes TypeScript function-like syntax without an executable body', () => {
    const source = `function overloaded(value: string): string;
function overloaded(value: string) { return value; }
declare function ambient(): void;

abstract class AbstractWidget {
  abstract render(): void;
}

class StaticOnly {
  static { const initialized = true; }
}`;

    expect(parseFunctions('src/excluded.ts', source).map((fn) => fn.name)).toEqual([
      'overloaded',
    ]);
  });

  it('parses TSX arrow components', () => {
    const source = 'const Greeting = () => <div>Hello</div>;';

    expect(parseFunctions('src/Greeting.tsx', source).map((fn) => fn.name)).toEqual([
      'Greeting',
    ]);
  });

  it('keeps owner names for class field functions and object accessors', () => {
    const source = `class Widget {
  handler = () => {};
}

const object = {
  get value() { return 1; },
  set value(next: number) {}
};`;

    expect(parseFunctions('src/owners.ts', source).map((fn) => fn.name)).toEqual([
      'Widget.handler',
      'object.value',
      'object.value',
    ]);
  });

  it('records direct and indirect nested function bodies', () => {
    const source = `function outer() {
  const middle = () => {
    const inner = () => {};
  };
}`;

    const outer = parseFunctions('src/nested.ts', source)[0];

    expect(outer?.nestedBodyRanges).toEqual([
      {
        start: { line: 2, column: 24 },
        end: { line: 4, column: 4 },
      },
      {
        start: { line: 3, column: 25 },
        end: { line: 3, column: 27 },
      },
    ]);
  });
});
