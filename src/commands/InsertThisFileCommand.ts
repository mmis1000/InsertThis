import * as vscode from 'vscode'
import {
  getExtension,
  getFileName,
  getSanitizedName,
  readConfig,
  relative,
  replaceVariables
} from '../utils'
import type {
  COMMANDS,
  COMMAND_ARGS,
  COMMAND_RESULT
} from 'insert-this-tsc-plugin/src/commands'
import { SNIPPET_VARIABLES } from '../constants'
import imageSize from 'image-size'

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

  const ext = getExtension(sourcePath.path)
  const {
    importTemplate,
    jsxTemplate,
    jsxTemplateWithSize,
    variableSuffix,
    variableNameRule
  } = readConfig(ext)
  const sanitizedName = getSanitizedName(
    sourcePath.path,
    variableSuffix,
    variableNameRule
  )

  let size: [number, number] | undefined = undefined

  if (jsxTemplateWithSize != null) {
    try {
      const file = await vscode.workspace.fs.readFile(sourcePath)
      const res = imageSize(file)
      const filename = getFileName(sourcePath.path)

      let dpi = 1
      if (filename.match(/@\d+$/)) {
        const size = parseInt(filename.match(/@\d+$/)![0].slice(1), 10)
        if (size != 0) {
          dpi = size
        }
      }

      if (res.width != 0 && res.height != 0) {
        size = [res.width / dpi, res.height / dpi]
      }
    } catch (err) {
      console.error(err)
    }
  }

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
  } = (response as any).body as COMMAND_RESULT['insertInto']

  const importStatement = replaceVariables(importTemplate, {
    [SNIPPET_VARIABLES.VARIABLE_NAME]: importBinding.name,
    [SNIPPET_VARIABLES.SERIALIZED_FILE_NAME]: JSON.stringify(importBinding.path)
  })

  const jsxExpr =
    size != null && jsxTemplateWithSize != null
      ? replaceVariables(jsxTemplateWithSize, {
          [SNIPPET_VARIABLES.VARIABLE_NAME]: importBinding.name,
          [SNIPPET_VARIABLES.IMAGE_WIDTH]: String(size[0]),
          [SNIPPET_VARIABLES.IMAGE_HEIGHT]: String(size[1])
        })
      : replaceVariables(jsxTemplate, {
          [SNIPPET_VARIABLES.VARIABLE_NAME]: importBinding.name
        })

  const workspaceEdit = new vscode.WorkspaceEdit()
  const snippetTextEdits: vscode.SnippetTextEdit[] = []

  if (importBinding.type === 'existing') {
    if (isInMissingExpr) {
      snippetTextEdits.push(
        vscode.SnippetTextEdit.insert(
          new vscode.Position(...cursor),
          new vscode.SnippetString()
            .appendPlaceholder(importBinding.name)
            .appendTabstop(0)
        )
      )
    } else if (isInJSXText) {
      snippetTextEdits.push(
        vscode.SnippetTextEdit.insert(
          new vscode.Position(...cursor),
          new vscode.SnippetString(jsxExpr)
        )
      )
    } else {
      snippetTextEdits.push(
        vscode.SnippetTextEdit.replace(
          new vscode.Range(
            new vscode.Position(
              importBinding.start.row,
              importBinding.start.col
            ),
            new vscode.Position(importBinding.end.row, importBinding.end.col)
          ),
          new vscode.SnippetString()
            .appendPlaceholder(importBinding.name)
            .appendTabstop(0)
        )
      )
    }
  } else {
    snippetTextEdits.push(
      vscode.SnippetTextEdit.insert(
        new vscode.Position(importBinding.start.row, importBinding.start.col),
        new vscode.SnippetString(
          importBinding.lineBreakAtEnd
            ? importStatement + '\n'
            : '\n' + importStatement
        )
      )
    )

    if (isInMissingExpr) {
      snippetTextEdits.push(
        vscode.SnippetTextEdit.insert(
          new vscode.Position(...cursor),
          new vscode.SnippetString()
            .appendPlaceholder(importBinding.name)
            .appendTabstop(0)
        )
      )
    } else if (isInJSXText) {
      snippetTextEdits.push(
        vscode.SnippetTextEdit.insert(
          new vscode.Position(...cursor),
          new vscode.SnippetString(jsxExpr)
        )
      )
    }
  }

  workspaceEdit.set(target, snippetTextEdits)

  await vscode.workspace.applyEdit(workspaceEdit)

  return

  // console.log(text, res, spans, lineCols)
}
