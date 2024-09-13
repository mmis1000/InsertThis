// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { relative, dirname, basename } from "path";
import { parse } from "@swc/wasm";

const extensionSuffixMap: Record<string, string> = {
  svg: "Img",
  png: "Img",
  jpg: "Img",
  jpeg: "Img",
  webp: "Img",
};

const parseSpan = (text: string): number[] => {
  const splitted = text.split(/\n/g);
  console.log(splitted);
  const spans = [];

  let current = 0;
  for (let i = 0; i < splitted.length; i++) {
    spans.push(current);
    current += [...splitted[i]].length;
    current += 1;
  }
  spans.push(text.length);

  return spans;
};

/**
 *
 * @param span 0 indexed span
 * @param spans 0 indexed spans
 */
const toLineCol = (span: number, spans: number[]) => {
  for (let i = 0; i < spans.length; i++) {
    if (span < spans[i + 1]) {
      return [i, span - spans[i]];
    }
  }

  return null;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "insert-this" is now active!');

  const disposable = vscode.commands.registerCommand(
    "insert-this.insertThisFile",
    (...args) => {
      if (!(args[0] instanceof vscode.Uri)) {
        return;
      }

      console.log(args);
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from Insert this!");

      const sourcePath = args[0];
      const target = vscode.window.activeTextEditor?.document.uri!;

      const targetDir = dirname(target.path);
      let relativePath = relative(targetDir, sourcePath.path);
      if (!relativePath.startsWith(".")) {
        relativePath = "./" + relativePath;
      }
      const filename = basename(sourcePath.path).replace(/\.[^.]+$/, "");

      const extension =
        /\.([^.]+)$/.exec(basename(sourcePath.path))?.[1].toLowerCase() ?? "";

      const suffix = extensionSuffixMap[extension] ?? "";

      const sanitizedName =
        filename
          .split(/(?=[A-Z])|[-_\\/: ]/g)
          .filter((i) => !!i)
          .map((i, index) => {
            if (index === 0) {
              return i.toLocaleLowerCase();
            }
            return i.slice(0, 1).toUpperCase() + i.slice(1).toLowerCase();
          })
          .join("") + suffix;

      // console.log(vscode.window.activeTextEditor?.document.fileName)
      const text = vscode.window.activeTextEditor?.document.getText()

			console.log(text)

      if (text == null) return;


      parse(text, {
        syntax: /^[mc]?tsx?$/.test(extension) ? "typescript" : "ecmascript",
        tsx: /^[mc]?tsx$/.test(extension),
        jsx: /^[mc]?jsx?$/.test(extension), // always treat js as jsx
        dynamicImport: true,
      }).then((res) => {
        const spans = parseSpan(text);
				const spanOffset = res.span.start // swc span is not 0 indexed
        // const lineCols = res.body.map((i) => {
        //   return [
        //     toLineCol(i.span.start - spanOffset, spans),
        //     toLineCol(i.span.end - spanOffset, spans),
        //   ];
        // });

        const imports = res.body.filter((i) => i.type === "ImportDeclaration");
        const lastImport = imports[imports.length - 1];
        const lastImportEnd = toLineCol(lastImport.span.end - spanOffset, spans);

				const importNames: string[] = []

				for (const statement of imports) {
					for (const specifier of statement.specifiers) {
						importNames.push(specifier.local.value)
					}
				}

				let counter = 0
				let finalName = sanitizedName

				while (importNames.includes(finalName)) {
					counter += 1
					finalName = sanitizedName + counter
				}

        if (lastImportEnd) {
          vscode.window.activeTextEditor?.edit((builder) => {
            builder.insert(
              new vscode.Position(lastImportEnd[0], lastImportEnd[1]),
              `\nimport ${finalName} from ${JSON.stringify(relativePath)}`
            );
          });
        }

        // console.log(text, res, spans, lineCols)
      });
    }
  );
  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
