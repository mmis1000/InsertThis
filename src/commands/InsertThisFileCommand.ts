import * as vscode from 'vscode'
import { getSanitizedName, relative } from '../utils'
import type {
  COMMANDS,
  COMMAND_ARGS,
  COMMAND_RESULT
} from 'insert-this-tsc-plugin/src/commands'

export const InsertThisFileCommand = async (...args: any[]) => {
  if (!(args[0] instanceof vscode.Uri)) {
    return
  }

  const sourcePath = args[0]
  const target = vscode.window.activeTextEditor?.document.uri!

  let relativePath = relative(target, sourcePath)

  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath
  }

  const sanitizedName = getSanitizedName(sourcePath.path)

  // console.log(vscode.window.activeTextEditor?.document.fileName)
  const text = vscode.window.activeTextEditor?.document.getText()

  if (text == null) {
    return
  }

  const cursor = [
    vscode.window.activeTextEditor?.selection.active.line ?? 0,
    vscode.window.activeTextEditor?.selection.active.character ?? 0
  ] as const

  const response = await vscode.commands.executeCommand(
    'typescript.tsserverRequest',
    '_insert_this_insert_into' satisfies (typeof COMMANDS)[keyof typeof COMMANDS],
    [
      target.scheme === 'file' ? target.fsPath : target.toString(),
      ...cursor,
      relativePath,
      sanitizedName
    ] satisfies COMMAND_ARGS['insertInto']
  )

  console.log(response)

  const {
    import: importBinding,
    isInJSXText,
    isInMissingExpr,
    isInString
  } = (response as any).body as COMMAND_RESULT['insertInto']

  if (importBinding.type === 'existing') {
    if (isInMissingExpr) {
      await vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendPlaceholder(importBinding.name)
          .appendTabstop(0),
        new vscode.Position(...cursor)
      )
    } else if (isInJSXText) {
      vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendText('<img src={')
          .appendText(importBinding.name)
          .appendText('} alt="" />')
          .appendTabstop(0),
        new vscode.Position(...cursor)
      )
    } else {
      vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendPlaceholder(importBinding.name)
          .appendTabstop(0),
        new vscode.Range(
          new vscode.Position(importBinding.start.row, importBinding.start.col),
          new vscode.Position(importBinding.end.row, importBinding.end.col)
        )
      )
    }

    return
  } else {
    await vscode.window.activeTextEditor?.insertSnippet(
      new vscode.SnippetString()
        .appendText(importBinding.lineBreakAtEnd ? 'import ' : '\nimport ')
        .appendPlaceholder(importBinding.name, 1)
        .appendTabstop(0)
        .appendText(` from ${JSON.stringify(importBinding.path)}`)
        .appendText(importBinding.lineBreakAtEnd ? '\n' : ''),
      new vscode.Position(importBinding.start.row, importBinding.start.col),
      {
        undoStopBefore: true,
        undoStopAfter: false
      }
    )

    const willBePushedOut =
      cursor[0] >=
      (!importBinding.lineBreakAtEnd
        ? importBinding.start.row + 1
        : importBinding.start.row)
    const calibratedCursor = willBePushedOut
      ? ([cursor[0] + 1, cursor[1]] as const)
      : cursor

    if (isInMissingExpr) {
      await vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendPlaceholder(importBinding.name)
          .appendTabstop(0),
        new vscode.Position(...calibratedCursor),
        {
          undoStopBefore: false,
          undoStopAfter: true
        }
      )
    } else if (isInJSXText) {
      await vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendText('<img src={')
          .appendText(importBinding.name)
          .appendText('} alt="" />')
          .appendTabstop(0),
        new vscode.Position(...calibratedCursor),
        {
          undoStopBefore: false,
          undoStopAfter: true
        }
      )
    }
  }

  return

  // console.log(text, res, spans, lineCols)
}
