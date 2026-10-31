import { relayOperationCount } from '../shared/relay-difficulty';
import { randomInt } from 'node:crypto';

// Multiplication and division share precedence and run left to right.
export function evaluateRelay(numbers: number[], symbols: string[]) {
  let sum = 0, term = numbers[0];
  for (let i = 0; i < symbols.length; i++) {
    const right = numbers[i + 1];
    if (symbols[i] === '×') term *= right;
    else if (symbols[i] === '÷') term /= right;
    else { sum += term; term = symbols[i] === '−' ? -right : right; }
  }
  return sum + term;
}

export function makeRelay(count: number, teamIndex: number, difficulty: number, operations: string[]) {
  const steps = relayOperationCount(difficulty);
  let value = 3 + steps + teamIndex;
  const expressions: string[] = [];
  for (let player = 0; player < count; player++) {
    let expression = player === 0 ? String(value) : '__';
    const numbers = [value], symbols: string[] = [];
    for (let step = 0; step < steps; step++) {
      const op = player === 0 && step === 0 ? 'add' : operations[(Math.max(0, player - 1) + step) % operations.length];
      const symbol = op === 'multiply' ? '×' : op === 'divide' ? '÷' : op === 'subtract' ? '−' : '+';
      symbols.push(symbol);
      // Choose operands using the entire expression's precedence, not a running
      // left-to-right answer. Neutral operands provide a bounded fallback.
      const candidates = Array.from({ length: 8 }, (_, i) => i + 2).filter(n => {
        const answer = evaluateRelay([...numbers, n], symbols);
        return Number.isSafeInteger(answer) && answer > 0 && answer <= 500;
      });
      const n = candidates.length ? candidates[randomInt(candidates.length)] : (symbol === '+' || symbol === '−' ? 0 : 1);
      numbers.push(n);
      expression += ` ${symbol} ${n}`;
    }
    value = evaluateRelay(numbers, symbols);
    expressions.push(expression);
  }
  return { expressions, answer: value };
}

export function fixedRelay(expressions: string[]) {
  let answer = 0;
  for (const expression of expressions) {
    const parts = expression.split(' ');
    const numbers = [parts[0] === '__' ? answer : Number(parts[0])];
    const symbols: string[] = [];
    for (let i=1;i<parts.length;i+=2) { symbols.push(parts[i]); numbers.push(Number(parts[i+1])); }
    answer = evaluateRelay(numbers, symbols);
  }
  return { expressions, answer };
}
