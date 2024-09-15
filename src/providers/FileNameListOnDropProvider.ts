import * as vscode from "vscode"
import { posix } from "path"
import {
  getExistingImport,
  getImportInsertPosAndName,
  isInJSXContext,
  parseAST,
  ParseResult,
  parseSpan,
} from "../ASTUtils"
import { getSanitizedName } from "../utils"

const uriListMime = "text/uri-list"
const { relative, dirname } = posix

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

    for (const resource of urlList.split("\n")) {
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
    const language = vscode.window.activeTextEditor?.document.languageId

    const targetDir = dirname(target.path)
    let relativePath = relative(targetDir, uri.path)

    if (!relativePath.startsWith(".")) {
      relativePath = "./" + relativePath
    }
    const sanitizedName = getSanitizedName(uri.path)

    const text = vscode.window.activeTextEditor?.document.getText()
    if (text == null) {
      return
    }

    const cursor = [position.line, position.character] as const

    const spans = parseSpan(text)

    let res: ParseResult

    try {
      res = await parseAST(
        text,
        spans,
        {
          syntax: language?.startsWith("typescript")
            ? "typescript"
            : "ecmascript",
          tsx: language === "typescriptreact",
          jsx: language === "javascriptreact",
          dynamicImport: true,
        },
        cursor
      )
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message)
      const snippet = new vscode.SnippetString()
      return new vscode.DocumentDropEdit(snippet)
    }

    if (token.isCancellationRequested) {
      return
    }

    const existingImport = getExistingImport(res, relativePath)

    const toInsert =
      existingImport != null
        ? null
        : getImportInsertPosAndName(res, sanitizedName, relativePath)

    const inJSXContext =
      (language === "typescriptreact" || language === "javascriptreact") &&
      isInJSXContext(res, position)

    vscode.window.activeTextEditor?.edit((builder) => {
      if (inJSXContext) {
        if (toInsert) {
          builder.insert(
            new vscode.Position(position.line, position.character),
            `<img src={${toInsert.name}} alt="" />`
          )
          builder.insert(new vscode.Position(...toInsert.at), toInsert.content)
        }
        if (existingImport) {
          builder.insert(
            new vscode.Position(position.line, position.character),
            `<img src={${existingImport.name}} alt="" />`
          )
        }
      } else {
        if (res.hasMissingExpression) {
          // insert variable name instead
          if (toInsert) {
            builder.insert(
              new vscode.Position(position.line, position.character),
              toInsert.name
            )
            builder.insert(
              new vscode.Position(...toInsert.at),
              toInsert.content
            )
          }
          if (existingImport) {
            builder.insert(
              new vscode.Position(position.line, position.character),
              existingImport.name
            )
          }
        } else {
          // assume we want a string
          builder.insert(
            new vscode.Position(position.line, position.character),
            relativePath
          )
        }
      }
    })

    // Build a snippet to insert
    const snippet = new vscode.SnippetString()
    return new vscode.DocumentDropEdit(snippet)
  }
}
