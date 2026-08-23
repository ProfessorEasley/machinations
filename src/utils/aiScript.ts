export type AiCommand = {
  type: 'fire' | 'fireRandom';
  targets: string[];
};

export type AiScriptLine = {
  condition: string | null;
  command: AiCommand;
};

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'paren'; value: '(' | ')' };

type Value =
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean };

const toNumber = (value: Value): number =>
  value.kind === 'number' ? value.value : value.value ? 1 : 0;

const toBoolean = (value: Value): boolean =>
  value.kind === 'boolean' ? value.value : value.value !== 0;

const tokenize = (input: string): Token[] | null => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i + 1] || ''))) {
      let j = i + 1;
      while (j < input.length && /[\d.]/.test(input[j])) j += 1;
      const raw = input.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'number', value });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j += 1;
      tokens.push({ type: 'identifier', value: input.slice(i, j) });
      i = j;
      continue;
    }

    const twoChar = input.slice(i, i + 2);
    if (['&&', '||', '>=', '<=', '==', '!='].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar });
      i += 2;
      continue;
    }

    if (['>', '<', '+', '-', '*', '/', '%'].includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i += 1;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i += 1;
      continue;
    }

    return null;
  }

  return tokens;
};

class ExpressionParser {
  private tokens: Token[];
  private index: number;
  private readonly getValue: (identifier: string) => number;

  constructor(tokens: Token[], getValue: (identifier: string) => number) {
    this.tokens = tokens;
    this.index = 0;
    this.getValue = getValue;
  }

  parseExpression(): Value | null {
    return this.parseOr();
  }

  isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  private parseOr(): Value | null {
    let left = this.parseAnd();
    if (!left) return null;
    while (this.matchOperator('||')) {
      const right = this.parseAnd();
      if (!right) return null;
      left = { kind: 'boolean', value: toBoolean(left) || toBoolean(right) };
    }
    return left;
  }

  private parseAnd(): Value | null {
    let left = this.parseCompare();
    if (!left) return null;
    while (this.matchOperator('&&')) {
      const right = this.parseCompare();
      if (!right) return null;
      left = { kind: 'boolean', value: toBoolean(left) && toBoolean(right) };
    }
    return left;
  }

  private parseCompare(): Value | null {
    const left = this.parseAdd();
    if (!left) return null;
    const op = this.matchCompareOperator();
    if (!op) return left;
    const right = this.parseAdd();
    if (!right) return null;
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    let result = false;
    switch (op) {
      case '>':
        result = leftNum > rightNum;
        break;
      case '>=':
        result = leftNum >= rightNum;
        break;
      case '<':
        result = leftNum < rightNum;
        break;
      case '<=':
        result = leftNum <= rightNum;
        break;
      case '==':
        result = leftNum === rightNum;
        break;
      case '!=':
        result = leftNum !== rightNum;
        break;
      default:
        return null;
    }
    return { kind: 'boolean', value: result };
  }

  private parseAdd(): Value | null {
    let left = this.parseMul();
    if (!left) return null;
    while (true) {
      if (this.matchOperator('+')) {
        const right = this.parseMul();
        if (!right) return null;
        left = { kind: 'number', value: toNumber(left) + toNumber(right) };
        continue;
      }
      if (this.matchOperator('-')) {
        const right = this.parseMul();
        if (!right) return null;
        left = { kind: 'number', value: toNumber(left) - toNumber(right) };
        continue;
      }
      break;
    }
    return left;
  }

  private parseMul(): Value | null {
    let left = this.parseUnary();
    if (!left) return null;
    while (true) {
      if (this.matchOperator('*')) {
        const right = this.parseUnary();
        if (!right) return null;
        left = { kind: 'number', value: toNumber(left) * toNumber(right) };
        continue;
      }
      if (this.matchOperator('/')) {
        const right = this.parseUnary();
        if (!right) return null;
        left = { kind: 'number', value: toNumber(left) / toNumber(right) };
        continue;
      }
      if (this.matchOperator('%')) {
        const right = this.parseUnary();
        if (!right) return null;
        left = { kind: 'number', value: toNumber(left) % toNumber(right) };
        continue;
      }
      break;
    }
    return left;
  }

  private parseUnary(): Value | null {
    if (this.matchOperator('-')) {
      const value = this.parseUnary();
      if (!value) return null;
      return { kind: 'number', value: -toNumber(value) };
    }
    if (this.matchOperator('+')) {
      const value = this.parseUnary();
      if (!value) return null;
      return { kind: 'number', value: toNumber(value) };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Value | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type === 'number') {
      this.index += 1;
      return { kind: 'number', value: token.value };
    }
    if (token.type === 'identifier') {
      this.index += 1;
      return { kind: 'number', value: this.getValue(token.value) };
    }
    if (token.type === 'paren' && token.value === '(') {
      this.index += 1;
      const expr = this.parseExpression();
      if (!expr) return null;
      const next = this.peek();
      if (!next || next.type !== 'paren' || next.value !== ')') return null;
      this.index += 1;
      return expr;
    }
    return null;
  }

  private peek(): Token | null {
    return this.tokens[this.index] ?? null;
  }

  private matchOperator(value: string): boolean {
    const token = this.peek();
    if (token && token.type === 'operator' && token.value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private matchCompareOperator(): string | null {
    const token = this.peek();
    if (
      token &&
      token.type === 'operator' &&
      ['>', '>=', '<', '<=', '==', '!='].includes(token.value)
    ) {
      this.index += 1;
      return token.value;
    }
    return null;
  }
}

const evaluateCondition = (
  expression: string,
  getValue: (identifier: string) => number
): boolean => {
  const tokens = tokenize(expression);
  if (!tokens || tokens.length === 0) return false;
  const parser = new ExpressionParser(tokens, getValue);
  const result = parser.parseExpression();
  if (!result || !parser.isAtEnd()) return false;
  return toBoolean(result);
};

const extractCondition = (
  line: string
): { condition: string; rest: string } | null => {
  const trimmed = line.trim();
  if (!trimmed.toLowerCase().startsWith('if')) return null;
  const openIdx = trimmed.indexOf('(');
  if (openIdx === -1) return null;
  let depth = 0;
  for (let i = openIdx; i < trimmed.length; i += 1) {
    if (trimmed[i] === '(') depth += 1;
    if (trimmed[i] === ')') depth -= 1;
    if (depth === 0) {
      const condition = trimmed.slice(openIdx + 1, i).trim();
      const rest = trimmed.slice(i + 1).trim();
      return { condition, rest };
    }
  }
  return null;
};

const parseCommand = (input: string): AiCommand | null => {
  const match = input.match(/^([A-Za-z]+)\s*\((.*)\)\s*$/);
  if (!match) return null;
  const commandName = match[1].toLowerCase();
  const rawArgs = match[2];
  const targets = rawArgs
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (targets.length === 0) return null;
  if (commandName === 'fire') return { type: 'fire', targets };
  if (commandName === 'firerandom') return { type: 'fireRandom', targets };
  return null;
};

const parseLine = (line: string): AiScriptLine | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const conditional = extractCondition(trimmed);
  if (conditional) {
    const command = parseCommand(conditional.rest);
    if (!command) return null;
    return { condition: conditional.condition, command };
  }
  const command = parseCommand(trimmed);
  if (!command) return null;
  return { condition: null, command };
};

export const parseAiScript = (script: string): AiScriptLine[] => {
  return script
    .split(/\r?\n/)
    .map(line => parseLine(line))
    .filter((line): line is AiScriptLine => Boolean(line));
};

export const selectAiCommand = (
  lines: AiScriptLine[],
  getValue: (identifier: string) => number
): AiCommand | null => {
  for (const line of lines) {
    if (!line.condition) return line.command;
    if (evaluateCondition(line.condition, getValue)) return line.command;
  }
  return null;
};
