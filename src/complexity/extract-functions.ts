import * as ts from 'typescript';
import type { FunctionInfo, SourcePosition, SourceRange } from '../model.js';
import { measureComplexity } from './measure-complexity.js';

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
type NameResolver = (
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
) => string | undefined;

const nameResolvers: NameResolver[] = [
  declaredFunctionName,
  classMemberName,
  variableInitializerName,
  objectMemberName,
  propertyName,
];

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

export function extractFunctions(source: string, sourceText: string): FunctionInfo[] {
  return parseFunctions(source, sourceText).map((parsed) => ({
    id: parsed.id,
    name: parsed.name,
    source: parsed.source,
    range: parsed.range,
    bodyRange: parsed.bodyRange,
    nestedBodyRanges: parsed.nestedBodyRanges,
    complexity: measureComplexity(parsed),
  }));
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
  for (const resolveName of nameResolvers) {
    const name = resolveName(node, sourceFile);
    if (name !== undefined) return name;
  }

  const position = toPosition(sourceFile, node.getStart(sourceFile));
  return `${source}:${position.line}:${position.column}`;
}

function declaredFunctionName(node: ts.FunctionLikeDeclaration): string | undefined {
  if (!ts.isFunctionDeclaration(node) && !ts.isFunctionExpression(node)) return undefined;
  return node.name !== undefined && ts.isIdentifier(node.name) ? node.name.text : undefined;
}

function classMemberName(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
): string | undefined {
  const member = containingClassMember(node);
  const className = declaredClassName(member);
  if (className === undefined) return undefined;

  if (ts.isConstructorDeclaration(node)) return `${className}.constructor`;

  return qualifiedName(className, getNodeName(member, sourceFile));
}

function containingClassMember(node: ts.FunctionLikeDeclaration): ts.Node {
  return ts.isPropertyDeclaration(node.parent) ? node.parent : node;
}

function declaredClassName(member: ts.Node): string | undefined {
  const classDeclaration = member.parent;
  if (!ts.isClassDeclaration(classDeclaration) && !ts.isClassExpression(classDeclaration)) return undefined;

  const className = classDeclaration.name;
  if (className === undefined || !ts.isIdentifier(className)) return undefined;
  return className.text;
}

function variableInitializerName(node: ts.FunctionLikeDeclaration): string | undefined {
  const declaration = node.parent;
  if (!ts.isVariableDeclaration(declaration) || !sameNode(declaration.initializer, node)) return undefined;
  return ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
}

function objectMemberName(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
): string | undefined {
  const property = getContainingProperty(node);
  if (property === undefined) return undefined;

  return qualifiedName(objectVariableName(property), getNodeName(property, sourceFile));
}

function objectVariableName(property: ts.Node): string | undefined {
  const declaration = objectVariableDeclaration(property);
  if (declaration === undefined) return undefined;
  return ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
}

function objectVariableDeclaration(property: ts.Node): ts.VariableDeclaration | undefined {
  const object = property.parent;
  if (!ts.isObjectLiteralExpression(object)) return undefined;

  const declaration = object.parent;
  if (!ts.isVariableDeclaration(declaration)) return undefined;
  return sameNode(declaration.initializer, object) ? declaration : undefined;
}

function qualifiedName(owner: string | undefined, member: string | undefined): string | undefined {
  if (owner === undefined) return undefined;
  if (member === undefined) return undefined;
  return `${owner}.${member}`;
}

function propertyName(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string | undefined {
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
