import * as ts from 'typescript';
import type { ParsedFunction } from './extract-functions.js';

const decisionOperators = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

const decisionNodeKinds = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.CaseClause,
]);

export function measureComplexity(parsed: ParsedFunction): number {
  let complexity = 1;

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;

    if (isDecision(node)) complexity += 1;

    ts.forEachChild(node, visit);
  };

  visit(parsed.node.body!);
  return complexity;
}

function isDecision(node: ts.Node): boolean {
  if (decisionNodeKinds.has(node.kind)) return true;
  return ts.isBinaryExpression(node) && decisionOperators.has(node.operatorToken.kind);
}
