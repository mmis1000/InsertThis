import * as vscode from 'vscode'
import {
  getExtension,
  getFileName,
  getSanitizedName,
  readConfig,
  relative,
  replaceVariables,
  toastWithSelfDismiss
} from '../utils'
import type {
  COMMANDS,
  COMMAND_ARGS,
  COMMAND_RESULT
} from 'insert-this-tsc-plugin/src/commands'
import { SNIPPET_VARIABLES } from '../constants'
import { imageSize } from 'image-size'
const uriListMime = 'text/uri-list'

/**
 * Provider that inserts a numbered list of the names of dropped files.
 *
 * Try dropping one or more files from:
 *
 * - VS Code's explorer
 * - The operating system
 * - The open editors view
 */
export class FileNameListOnDropProvider
  implements vscode.DocumentDropEditProvider
{
  async provideDocumentDropEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentDropEdit | undefined> {
    // Check the data transfer to see if we have dropped a list of uris
    const dataTransferItem = dataTransfer.get(uriListMime)
    if (!dataTransferItem) {
      return undefined
    }

    // 'text/uri-list' contains a list of uris separated by new lines.
    // Parse this to an array of uris.
    const urlList = await dataTransferItem.asString()
    if (token.isCancellationRequested) {
      return undefined
    }

    const uris: vscode.Uri[] = []

    for (const resource of urlList.split('\n')) {
      try {
        uris.push(vscode.Uri.parse(resource))
      } catch {
        // noop
      }
    }

    if (!uris.length) {
      return undefined
    }

    if (uris.length > 1) {
      return
    }

    const uri = uris[0]

    const ext = getExtension(uri.path)

    const { importTemplate, jsxTemplate, jsxTemplateWithSize, variableSuffix, variableNameRule } = readConfig(ext)

    const target = document.uri
    let size: [number, number] | undefined = undefined

    if (jsxTemplateWithSize != null) {
      try {
        const file = await vscode.workspace.fs.readFile(uri)
        const res = imageSize(file)
        const filename = getFileName(uri.path)

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

    let relativePath = relative(target, uri)

    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath
    }
    const sanitizedName = getSanitizedName(uri.path, variableSuffix, variableNameRule)

    const text = vscode.window.activeTextEditor?.document.getText()

    if (text == null) {
      return
    }

    const cursor = [position.line, position.character] as const

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

    const {
      import: importBinding,
      isInJSXText,
      isInMissingExpr,
      isInString
    } = (response as any).body as COMMAND_RESULT['insertInto']

    const importStatement = replaceVariables(importTemplate, {
      [SNIPPET_VARIABLES.VARIABLE_NAME]: importBinding.name,
      [SNIPPET_VARIABLES.SERIALIZED_FILE_NAME]: JSON.stringify(
        importBinding.path
      )
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

    // Build a snippet to insert
    const dropEdit = new vscode.DocumentDropEdit(new vscode.SnippetString())
    const workspaceEdit = new vscode.WorkspaceEdit()
    const snippetTextEdits: vscode.SnippetTextEdit[] = []
    if (isInJSXText) {
      if (jsxTemplateWithSize != null && size == null) {
        toastWithSelfDismiss(
          '⚠️Unable to read file size from ' +
            (uri.scheme === 'file' ? uri.fsPath : uri.toString()) +
            '⚠️'
        )
      }
      if (importBinding.type === 'new') {
        snippetTextEdits.push(
          vscode.SnippetTextEdit.insert(
            new vscode.Position(
              importBinding.start.row,
              importBinding.start.col
            ),
            new vscode.SnippetString(
              importBinding.lineBreakAtEnd
                ? `${importStatement}\n`
                : `\n${importStatement}`
            )
          )
        )
      }
      snippetTextEdits.push(
        vscode.SnippetTextEdit.insert(
          new vscode.Position(position.line, position.character),
          new vscode.SnippetString(jsxExpr)
        )
      )
    } else {
      if (isInMissingExpr) {
        // insert variable name instead
        if (importBinding.type === 'new') {
          snippetTextEdits.push(
            vscode.SnippetTextEdit.insert(
              new vscode.Position(
                importBinding.start.row,
                importBinding.start.col
              ),
              new vscode.SnippetString(
                importBinding.lineBreakAtEnd
                  ? `${importStatement}\n`
                  : `\n${importStatement}`
              )
            )
          )
        }
        snippetTextEdits.push(
          vscode.SnippetTextEdit.insert(
            new vscode.Position(position.line, position.character),
            new vscode.SnippetString(importBinding.name)
          )
        )
      } else if (isInString) {
        // assume we want a string because we are somehow in a string
        snippetTextEdits.push(
          vscode.SnippetTextEdit.insert(
            new vscode.Position(position.line, position.character),
            new vscode.SnippetString(relativePath).appendTabstop(0)
          )
        )
      } else {
        if (importBinding.type === 'new') {
          snippetTextEdits.push(
            vscode.SnippetTextEdit.insert(
              new vscode.Position(
                importBinding.start.row,
                importBinding.start.col
              ),
              new vscode.SnippetString(
                importBinding.lineBreakAtEnd
                  ? `${importStatement}\n`
                  : `\n${importStatement}`
              )
            )
          )
        }
        snippetTextEdits.push(
          vscode.SnippetTextEdit.insert(
            new vscode.Position(position.line, position.character),
            new vscode.SnippetString(importBinding.name)
          )
        )
      }
    }
    console.log(snippetTextEdits)
    workspaceEdit.set(target, snippetTextEdits)

    dropEdit.additionalEdit = workspaceEdit
    return dropEdit
  }
}
