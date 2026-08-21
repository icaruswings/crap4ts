import * as ts from 'typescript';
import type { ParsedFunction } from './extract-functions.js';

const decisionOperators = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

export function measureComplexity(parsed: ParsedFunction): number {
  let complexity = 1;

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;

    if (
      ts.isIfStatement(node) ||
      ts.isConditionalExpression(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCatchClause(node) ||
      ts.isCaseClause(node)
    ) {
      complexity += 1;
    }

    if (ts.isBinaryExpression(node) && decisionOperators.has(node.operatorToken.kind)) {
      complexity += 1;
    }

    ts.forEachChild(node, visit);
  };

  visit(parsed.node.body!);
  return complexity;
}
