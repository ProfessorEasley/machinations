/**
 * Register Expression Parser and Evaluator
 * Support: +, -, *, /, %, D (dice), variables a–w, and parentheses
 */

type Token = number | string;

export class RegisterExpression {
  private static readonly OPERANDS = '0123456789.';
  private static readonly VARIABLES = 'abcdefghijklmnopqrstuvw';
  private static readonly OPERATORS = '()-+*/%D';

  /**
   * Checks if the character is an operand
   */
  private static isOperand(char: string): boolean {
    return this.OPERANDS.includes(char);
  }

  /**
   * Checks if the character is a variable
   */
  static isVariable(char: string): boolean {
    return this.VARIABLES.includes(char);
  }

  /**
   * Checks if the character is an operator
   */
  private static isOperator(char: string): boolean {
    return this.OPERATORS.includes(char);
  }

  /**
   * Convert infix expression to postfix expression (Reverse Polish Notation)
   */
  static toPostfix(expression: string): Token[] {
    const tokens: Token[] = [];
    const postfix: Token[] = [];
    const stack: string[] = [];

    let expr = expression.replace(/\s/g, '');

    while (expr.length > 0) {
      let i = 0;
      let numStr = '';

      while (i < expr.length && this.isOperand(expr[i])) {
        numStr += expr[i];
        i++;
      }

      if (numStr.length > 0) {
        tokens.push(parseFloat(numStr));
        expr = expr.substring(numStr.length);
        continue;
      }

      const char = expr[0];

      if (this.isOperator(char)) {
        tokens.push(char);
      }
      else if (this.isVariable(char)) {
        if (
          tokens.length > 0 &&
          !this.isOperator(tokens[tokens.length - 1] as string)
        ) {
          tokens.push('*');
        }
        tokens.push(char);
      }

      expr = expr.substring(1);
    }

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === '-') {
        if (i === 0 || this.isOperator(tokens[i - 1] as string)) {
          if (typeof tokens[i + 1] === 'number') {
            tokens[i + 1] = (tokens[i + 1] as number) * -1;
            tokens.splice(i, 1);
            i--;
            continue;
          }
        }
      }

      if (tokens[i] === 'D') {
        if (i === 0 || this.isOperator(tokens[i - 1] as string)) {
          tokens.splice(i, 0, 1);
          i++;
        }
      }
    }

    for (const token of tokens) {
      if (typeof token === 'number') {
        postfix.push(token);
      } else if (this.isVariable(token as string)) {
        postfix.push(token);
      } else {
        const op = token as string;

        if (op === '(') {
          stack.push(op);
        } else if (op === ')') {
          while (stack.length > 0 && stack[stack.length - 1] !== '(') {
            postfix.push(stack.pop()!);
          }
          stack.pop();
        } else {
          const precedence = this.getPrecedence(op);
          while (
            stack.length > 0 &&
            stack[stack.length - 1] !== '(' &&
            this.getPrecedence(stack[stack.length - 1]) >= precedence
          ) {
            postfix.push(stack.pop()!);
          }
          stack.push(op);
        }
      }
    }

    while (stack.length > 0) {
      postfix.push(stack.pop()!);
    }

    return postfix;
  }

  /**
   * Gets the precedence of an operator
   */
  private static getPrecedence(op: string): number {
    switch (op) {
      case '+':
      case '-':
        return 1;
      case '*':
      case '/':
      case '%':
        return 2;
      case 'D':
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Evaluates a postfix expression
   */
  static evaluate(postfix: Token[], variables: number[]): number {
    if (!postfix || postfix.length === 0) return 0;

    const stack: number[] = [];

    for (const token of postfix) {
      if (typeof token === 'number') {
        stack.push(token);
      } else if (this.isVariable(token as string)) {
        const index = (token as string).charCodeAt(0) - 97;
        const value = variables[index] || 0;
        stack.push(value);
      } else {
        const b = stack.pop() || 0;
        const a = stack.pop() || 0;
        let result = 0;

        switch (token) {
          case '+':
            result = a + b;
            break;
          case '-':
            result = a - b;
            break;
          case '*':
            result = a * b;
            break;
          case '/':
            result = b !== 0 ? a / b : 0;
            break;
          case '%':
            result = b !== 0 ? a % b : 0;
            break;
          case 'D':
            result = 0;
            for (let i = 0; i < a; i++) {
              result += 1 + Math.floor(Math.random() * b);
            }
            break;
          default:
            result = 0;
        }

        stack.push(result);
      }
    }

    return stack.pop() || 0;
  }
}