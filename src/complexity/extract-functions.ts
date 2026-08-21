import * as ts from 'typescript';
import type { SourcePosition, SourceRange } from '../model.js';

export interface ParsedFunction {
  id: string;
  name: string;
  source: string;
  range: SourceRange;
  bodyRange: SourceRange;
  nestedBodyRanges: SourceRange[];
  node: ts.FunctionLikeDeclaration;
}

type FunctionWithBody = ts.FunctionLikeDeclaration & { body: ts.FunctionBody };

export function parseFunctions(source: string, sourceText: string): ParsedFunction[] {
  const sourceFile = ts.createSourceFile(
    source,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    source.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const functions: ParsedFunction[] = [];

  const visit = (node: ts.Node): void => {
    if (hasFunctionBody(node)) {
      const range = toRange(sourceFile, node.getStart(sourceFile), node.end);
      const bodyRange = toRange(sourceFile, node.body.getStart(sourceFile), node.body.end);
      const start = range.start;
      const end = range.end;

      functions.push({
        id: `${source}:${start.line}:${start.column}-${end.line}:${end.column}`,
        name: functionName(node, source, sourceFile),
        source,
        range,
        bodyRange,
        nestedBodyRanges: [],
        node,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  for (const parent of functions) {
    parent.nestedBodyRanges = functions
      .filter((candidate) => candidate !== parent && isDescendantOf(candidate.node, parent.node))
      .map((candidate) => candidate.bodyRange);
  }

  return functions;
}

function toRange(sourceFile: ts.SourceFile, start: number, end: number): SourceRange {
  return {
    start: toPosition(sourceFile, start),
    end: toPosition(sourceFile, end),
  };
}

function hasFunctionBody(node: ts.Node): node is FunctionWithBody {
  return ts.isFunctionLike(node) && 'body' in node && node.body !== undefined;
}

function toPosition(sourceFile: ts.SourceFile, position: number): SourcePosition {
  const lineAndCharacter = sourceFile.getLineAndCharacterOfPosition(position);
  return {
    line: lineAndCharacter.line + 1,
    column: lineAndCharacter.character + 1,
  };
}

function functionName(
  node: ts.FunctionLikeDeclaration,
  source: string,
  sourceFile: ts.SourceFile,
): string {
  const classMemberName = getClassMemberName(node, sourceFile);
  if (classMemberName !== undefined) return classMemberName;

  const declaredName = getDeclaredFunctionName(node);
  if (declaredName !== undefined) return declaredName;

  const variableName = getVariableInitializerName(node);
  if (variableName !== undefined) return variableName;

  const objectMemberName = getObjectMemberName(node, sourceFile);
  if (objectMemberName !== undefined) return objectMemberName;

  const propertyName = getPropertyName(node, sourceFile);
  if (propertyName !== undefined) return propertyName;

  const position = toPosition(sourceFile, node.getStart(sourceFile));
  return `${source}:${position.line}:${position.column}`;
}

function getDeclaredFunctionName(node: ts.FunctionLikeDeclaration): string | undefined {
  if (!ts.isFunctionDeclaration(node) && !ts.isFunctionExpression(node)) return undefined;
  return node.name !== undefined && ts.isIdentifier(node.name) ? node.name.text : undefined;
}

function getClassMemberName(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
): string | undefined {
  const member = ts.isPropertyDeclaration(node.parent) ? node.parent : node;
  const classDeclaration = member.parent;
  if (!ts.isClassDeclaration(classDeclaration) && !ts.isClassExpression(classDeclaration)) return undefined;

  const className = classDeclaration.name;
  if (className === undefined || !ts.isIdentifier(className)) return undefined;

  if (ts.isConstructorDeclaration(node)) return `${className.text}.constructor`;

  const memberName = getNodeName(member, sourceFile);
  return memberName === undefined ? undefined : `${className.text}.${memberName}`;
}

function getVariableInitializerName(node: ts.FunctionLikeDeclaration): string | undefined {
  const declaration = node.parent;
  if (!ts.isVariableDeclaration(declaration) || !sameNode(declaration.initializer, node)) return undefined;
  return ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
}

function getObjectMemberName(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
): string | undefined {
  const property = getContainingProperty(node);
  if (property === undefined) return undefined;

  const object = property.parent;
  if (!ts.isObjectLiteralExpression(object)) return undefined;

  const declaration = object.parent;
  if (!ts.isVariableDeclaration(declaration) || !sameNode(declaration.initializer, object)) return undefined;
  if (!ts.isIdentifier(declaration.name)) return undefined;

  const propertyName = getNodeName(property, sourceFile);
  return propertyName === undefined ? undefined : `${declaration.name.text}.${propertyName}`;
}

function getPropertyName(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string | undefined {
  const property = getContainingProperty(node);
  if (property === undefined) return undefined;
  return getNodeName(property, sourceFile);
}

function getContainingProperty(node: ts.FunctionLikeDeclaration): ts.Node | undefined {
  if (
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    return node;
  }

  return ts.isPropertyAssignment(node.parent) ? node.parent : undefined;
}

function getNodeName(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const name = (node as ts.Node & { name?: ts.Node }).name;
  return name?.getText(sourceFile);
}

function isDescendantOf(node: ts.Node, ancestor: ts.Node): boolean {
  for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
    if (sameNode(parent, ancestor)) return true;
  }
  return false;
}

function sameNode(left: ts.Node | undefined, right: ts.Node): boolean {
  return left !== undefined && left.kind === right.kind && left.pos === right.pos && left.end === right.end;
}
