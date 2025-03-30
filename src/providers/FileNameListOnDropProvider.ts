import * as vscode from 'vscode'
import { getSanitizedName, relative } from '../utils'
import type { COMMANDS, COMMAND_ARGS, COMMAND_RESULT } from 'insert-this-tsc-plugin/src/commands'
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
    _document: vscode.TextDocument,
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

    const target = vscode.window.activeTextEditor?.document.uri!

    let relativePath = relative(target, uri)

    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath
    }
    const sanitizedName = getSanitizedName(uri.path)

    const text = vscode.window.activeTextEditor?.document.getText()
    if (text == null) {
      return
    }

    const cursor = [position.line, position.character] as const

    const response = await vscode.commands.executeCommand(
      'typescript.tsserverRequest',
      '_insert_this_insert_into' satisfies (typeof COMMANDS)[keyof typeof COMMANDS],
      [target.scheme === 'file' ? target.fsPath : target.toString(), ...cursor, relativePath, sanitizedName] satisfies COMMAND_ARGS['insertInto']
    )

    const { import: importBinding, isInJSXText, isInMissingExpr, isInString } = (response as any).body as COMMAND_RESULT['insertInto']

    vscode.window.activeTextEditor?.edit((builder) => {
      if (isInJSXText) {
        if (importBinding.type === 'new') {
          builder.insert(
            new vscode.Position(position.line, position.character),
            `<img src={${importBinding.name}} alt="" />`
          )
          builder.insert(new vscode.Position(importBinding.start.row, importBinding.start.col), importBinding.contentToInsert)
        }else {
          builder.insert(
            new vscode.Position(position.line, position.character),
            `<img src={${importBinding.name}} alt="" />`
          )
        }
      } else {
        if (isInMissingExpr) {
          // insert variable name instead
          if (importBinding.type === 'new') {
            builder.insert(
              new vscode.Position(position.line, position.character),
              importBinding.name
            )
            builder.insert(
              new vscode.Position(importBinding.start.row, importBinding.start.col),
              importBinding.contentToInsert
            )
          } else {
            builder.insert(
              new vscode.Position(position.line, position.character),
              importBinding.name
            )
          }
        } else if (isInString) {
          // assume we want a string because we are somehow in a string
          builder.insert(
            new vscode.Position(position.line, position.character),
            relativePath
          )
        } else {
          if (importBinding.type === 'new') {
            builder.insert(
              new vscode.Position(position.line, position.character),
              importBinding.name
            )
            builder.insert(
              new vscode.Position(importBinding.start.row, importBinding.start.col),
              importBinding.contentToInsert
            )
          } else {
            builder.insert(
              new vscode.Position(position.line, position.character),
              importBinding.name
            )
          }
        }
      }
    })

    // Build a snippet to insert
    const snippet = new vscode.SnippetString()
    return new vscode.DocumentDropEdit(snippet)
  }
}
