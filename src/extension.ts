// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import { InsertThisFileCommand } from "./commands/InsertThisFileCommand"
import { FileNameListOnDropProvider } from "./providers/FileNameListOnDropProvider"

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "insert-this" is now active!')

  const disposable = vscode.commands.registerCommand(
    "insert-this.insertThisFile",
    InsertThisFileCommand
  )
  context.subscriptions.push(disposable)
  const selectors: vscode.DocumentSelector[] = [
    { language: "javascript" },
    { language: "javascriptreact" },
    { language: "typescript" },
    { language: "typescriptreact" },
  ]
  for (const selector of selectors) {
    context.subscriptions.push(
      vscode.languages.registerDocumentDropEditProvider(
        selector,
        new FileNameListOnDropProvider()
      )
    )
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
