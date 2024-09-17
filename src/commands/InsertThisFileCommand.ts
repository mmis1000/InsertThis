import * as vscode from "vscode"
import {
  getExistingImport,
  getImportInsertPosAndName,
  isInJSXContext,
  parseAST,
  ParseResult,
  parseSpan,
} from "../ASTUtils"
import { getSanitizedName, relative } from "../utils"

export const InsertThisFileCommand = async (...args: any[]) => {
  if (!(args[0] instanceof vscode.Uri)) {
    return
  }

  const sourcePath = args[0]
  const target = vscode.window.activeTextEditor?.document.uri!
  const language = vscode.window.activeTextEditor?.document.languageId

  let relativePath = relative(target, sourcePath)

  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath
  }

  const sanitizedName = getSanitizedName(sourcePath.path)

  // console.log(vscode.window.activeTextEditor?.document.fileName)
  const text = vscode.window.activeTextEditor?.document.getText()

  if (text == null) {
    return
  }

  const cursor = [
    vscode.window.activeTextEditor?.selection.active.line ?? 0,
    vscode.window.activeTextEditor?.selection.active.character ?? 0,
  ] as const

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
    return
  }

  const originalPos = getExistingImport(res, relativePath)
  const inJSXContext =
    (language === "typescriptreact" || language === "javascriptreact") &&
    isInJSXContext(res, cursor)

  if (originalPos != null) {
    if (res.hasMissingExpression) {
      await vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendPlaceholder(originalPos.name)
          .appendTabstop(0),
        new vscode.Position(...cursor)
      )
    } else if (inJSXContext) {
      vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
        .appendText('<img src={')
          .appendText(originalPos.name)
          .appendText('} alt="" />')
          .appendTabstop(0),
        new vscode.Position(...cursor)
      )
    } else {
      vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendPlaceholder(originalPos.name)
          .appendTabstop(0),
        new vscode.Range(
          new vscode.Position(...originalPos.start),
          new vscode.Position(...originalPos.end)
        ),
        { undoStopBefore: false, undoStopAfter: false }
      )
    }

    return
  } else {
    const toInsert = getImportInsertPosAndName(
      res,
      sanitizedName,
      relativePath
    )

    await vscode.window.activeTextEditor?.insertSnippet(
      toInsert.snippet,
      new vscode.Position(...toInsert.at)
    )

    const calibratedCursor = cursor[0] > toInsert.at[0] ? cursor : [cursor[0] + 1, cursor[1]] as const

    if (res.hasMissingExpression) {
      await vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
          .appendPlaceholder(toInsert.name)
          .appendTabstop(0),
        new vscode.Position(...calibratedCursor)
      )
    } else if (inJSXContext) {
      await vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString()
        .appendText('<img src={')
          .appendText(toInsert.name)
          .appendText('} alt="" />')
          .appendTabstop(0),
        new vscode.Position(...calibratedCursor)
      )
    }
  }

  return

  // console.log(text, res, spans, lineCols)
}
