import type ts from 'typescript'
import { ParseResult } from './interface'

export const locateLeafNode = (
  ts: typeof import('typescript/lib/tsserverlibrary'),
  node: ts.Node,
  offset: number
): ts.Node | undefined => {
  // console.log(
  //   `kind ${ts.SyntaxKind[node.kind]}(${node.kind}), pos: ${node.pos} - ${
  //     node.end
  //   }, want: ${offset}`
  // )
  if (offset < node.pos || node.end <= offset) {
    return undefined
  }
  let containingChild: ts.Node | undefined
  node.forEachChild((cbNode) => {
    const located = locateLeafNode(ts, cbNode, offset)
    if (located != null) {
      containingChild = located
    }
  })
  if (containingChild) {
    return containingChild
  }
  return node
}

export const getNodeInLocation = (
  ts: typeof import('typescript/lib/tsserverlibrary'),
  ctx: ParseResult,
  row: number,
  col: number
) => {
  const offset = ctx.file.lineOffsetToPosition(row + 1, col + 1)
  const leafNode = locateLeafNode(ts, ctx.ast, offset)
  return leafNode
}

type Pos = {
  /** 0 indexed */
  row: number
  /** 0 indexed */
  col: number
}

const toPos = (tsPos: ts.server.protocol.Location): Pos => {
  return {
    row: tsPos.line - 1,
    col: tsPos.offset - 1
  }
}

type ExistingImport = {
  type: 'existing'
  start: Pos
  end: Pos
  name: string
  path: string
}
type NewImport = {
  type: 'new'
  start: Pos
  contentToInsert: string
  name: string
  path: string
  lineBreakAtEnd: boolean
}

export type ImportResult = ExistingImport | NewImport

export const getExistingOrCreateNewImport = (
  ts: typeof import('typescript/lib/tsserverlibrary'),
  ctx: ParseResult,
  row: number,
  col: number,
  desiredVariableName: string,
  filePath: string
): ImportResult => {
  const imports = ctx.ast.statements.filter(
    (i) => i.kind === ts.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[]
  const matchingImport = imports.find(
    (i) =>
      i.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral &&
      (i.moduleSpecifier as ts.StringLiteral).text === filePath
  )
  let originalImportName
  if (matchingImport && matchingImport.importClause?.name != null) {
    originalImportName = matchingImport.importClause?.name.text
  } else {
    originalImportName = desiredVariableName
  }
  const existingNames = new Set<string>()
  let variableShadowed = false
  const targetedExpr = getNodeInLocation(ts, ctx, row, col)
  let currentNode: ts.Node | undefined = targetedExpr

  while (currentNode != null) {
    const locals = (currentNode as any).locals
    if (locals != null && locals instanceof Map) {
      for (const k of locals.keys()) {
        existingNames.add(k)
      }
      if (
        currentNode.kind !== ts.SyntaxKind.SourceFile &&
        locals.has(originalImportName)
      ) {
        variableShadowed = true
      }
    }
    currentNode = currentNode.parent
  }

  if (matchingImport && matchingImport.importClause?.name != null) {
      let selectedName = originalImportName

      if (variableShadowed) {
        if (!existingNames.has(desiredVariableName)) {
          selectedName = desiredVariableName
        } else {
          // find a new variable name
          let index = 1
          selectedName = desiredVariableName + index
          while (existingNames.has(selectedName)) {
            index++
            selectedName = desiredVariableName + index
          }
        }

        // create new import
        const lastImport = imports[imports.length - 1]
        if (lastImport != null) {
          // insert after last import
          const target = toPos(ctx.file.positionToLineOffset(lastImport.end))
          const text = `\nimport ${selectedName} from ${JSON.stringify(
            filePath
          )}`
          return {
            type: 'new',
            start: target,
            contentToInsert: text,
            name: selectedName,
            path: filePath,
            lineBreakAtEnd: false
          }
        } else {
          const text = `import ${selectedName} from ${JSON.stringify(
            filePath
          )}\n`
          return {
            type: 'new',
            start: {
              row: 0,
              col: 0
            },
            contentToInsert: text,
            name: selectedName,
            path: filePath,
            lineBreakAtEnd: true,
          }
          // insert at front
        }
      } else {
        return {
          type: 'existing',
          start: toPos(ctx.file.positionToLineOffset(matchingImport.pos)),
          end: toPos(ctx.file.positionToLineOffset(matchingImport.end)),
          name: selectedName,
          path: filePath,
        }
      }
    
  } else {
    let selectedName = originalImportName
    if (variableShadowed) {
      // find a new variable name
      let index = 1
      selectedName = desiredVariableName + index
      while (existingNames.has(selectedName)) {
        index++
        selectedName = desiredVariableName + index
      }
    }

    // create new import
    const lastImport = imports[imports.length - 1]
    if (lastImport != null) {
      // insert after last import
      const target = toPos(ctx.file.positionToLineOffset(lastImport.end))
      const text = `\nimport ${selectedName} from ${JSON.stringify(filePath)}`
      return {
        type: 'new',
        start: target,
        contentToInsert: text,
        name: selectedName,
        path: filePath,
        lineBreakAtEnd: false,
      }
    } else {
      const text = `import ${selectedName} from ${JSON.stringify(filePath)}\n`
      return {
        type: 'new',
        start: {
          row: 0,
          col: 0
        },
        contentToInsert: text,
        name: selectedName,
        path: filePath,
        lineBreakAtEnd: true,
      }
      // insert at front
    }
  }

}
