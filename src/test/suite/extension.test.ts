// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode"
import mocha from "mocha"
// import * as myExtension from '../../extension';

import { InsertThisFileCommand } from "../../commands/InsertThisFileCommand"

import chai, { assert, expect } from "chai"
import { jestSnapshotPlugin } from "mocha-chai-jest-snapshot"
import path from "path"

describe("Extension Test Suite", () => {
  chai.use(jestSnapshotPlugin({
    "snapshotResolver": path.resolve(__dirname, "../snapshotResolver.js"),
    "moduleFileExtensions": ["js"]
  }))

  vscode.window.showInformationMessage("Start all tests.")

  it("Open document works", async () => {
    const code = 'var a: string = ""'
    const doc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: code,
    })
    const editor = await vscode.window.showTextDocument(doc)
    assert.strictEqual(doc.getText(), code)
    assert.ok(vscode.window.activeTextEditor != null)
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
  })

  it("Insert works", async () => {
    const code = 'var a: string = ""'
    const res = 'var a: string = "test"'
    const doc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: code,
    })
    const editor = await vscode.window.showTextDocument(doc)
    await editor.insertSnippet(
      new vscode.SnippetString("test"),
      new vscode.Position(0, 17)
    )
    assert.strictEqual(doc.getText(), res)
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
  })

  it("Cursor works", async () => {
    const code = 'var a: string = ""'
    const res = 'var a: string = "test"'
    const doc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: code,
    })
    const editor = await vscode.window.showTextDocument(doc)

    editor.selection = new vscode.Selection(
      new vscode.Position(0, 17),
      new vscode.Position(0, 17)
    )
    assert.equal(vscode.window.activeTextEditor?.selection.start.character, 17)
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
  })
})

describe("E2E", () => {
  chai.use(jestSnapshotPlugin({
    "snapshotResolver": path.resolve(__dirname, "../snapshotResolver.js"),
    "moduleFileExtensions": ["js"]
  }))

  it("Missing expr", async () => {
    const root = vscode.workspace.workspaceFolders![0].uri
    const target = vscode.Uri.joinPath(root, "src/missing-expr.ts")
    const file = vscode.Uri.joinPath(root, "assets/test.svg")

    const doc = await vscode.workspace.openTextDocument(target)
    const editor = await vscode.window.showTextDocument(doc)

    editor.selection = new vscode.Selection(
      new vscode.Position(0, 10),
      new vscode.Position(0, 10)
    )

    assert.equal(vscode.window.activeTextEditor?.selection.start.character, 10)
    // await vscode.window.activeTextEditor?.document.uri

    await InsertThisFileCommand(file)

    expect(
      vscode.window.activeTextEditor?.document.getText()
    ).toMatchSnapshot()

    await editor.document.save()
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
  })

  it("Missing expr multi byte", async () => {
    const root = vscode.workspace.workspaceFolders![0].uri
    const target = vscode.Uri.joinPath(root, "src/missing-expr-multi-byte.ts")
    const file = vscode.Uri.joinPath(root, "assets/test.svg")

    const doc = await vscode.workspace.openTextDocument(target)
    const editor = await vscode.window.showTextDocument(doc)

    editor.selection = new vscode.Selection(
      new vscode.Position(0, 11),
      new vscode.Position(0, 11)
    )

    assert.equal(vscode.window.activeTextEditor?.selection.start.character, 11)
    // await vscode.window.activeTextEditor?.document.uri

    await InsertThisFileCommand(file)

    expect(
      vscode.window.activeTextEditor?.document.getText()
    ).toMatchSnapshot()

    await editor.document.save()
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
  })
})
