import * as vscode from "vscode"
import { Module, parse, ParseOptions } from "@swc/wasm"
import { visitModule } from "./visitor"
import stripAnsi from "strip-ansi"

export type Pos = readonly [number, number];
export const pos = (row: number, col: number): Pos => [row, col]

export const parseSpan = (text: string): number[] => {
  const splitted = text.split(/\n/g)

  const spans = []

  let current = 0
  for (let i = 0; i < splitted.length; i++) {
    spans.push(current)
    current += [...splitted[i]].length
    current += 1
  }
  spans.push(text.length)

  return spans
}

export const toSpan = ([row, col]: Pos, spans: number[]) => {
  return spans[row] + col
}

/**
 *
 * @param span 0 indexed span
 * @param spans 0 indexed spans
 */
export const toRowCol = (span: number, spans: number[]) => {
  for (let i = 0; i < spans.length; i++) {
    if (span <= spans[i + 1]) {
      return [i, span - spans[i]] as const
    }
  }

  return null
}

export interface ParseResult {
  result: Module;
  spanOffset: number;
  // indicate if cursor is on a missing expression
  // ex: `const a = <cursor at here> ;`
  hasMissingExpression: boolean;
  extraSpanAfter: number;
  extraSpanSize: number;
  toRowCol: (span: number) => Pos | null;
  toSpan: (pos: Pos) => number;
  SWCSpanToSpan: (span: number) => number;
  SWCSpanToRowCol: (span: number) => Pos | null;
}

const getASTSpanBase = async () => {
  const ast = await parse('""', {
    syntax: "ecmascript",
  })
  return ast.span.end
}

export const parseAST = async (
  code: string,
  spans: number[],
  opt: ParseOptions,
  cursor: Pos
): Promise<ParseResult> => {
  try {
    const offset = await getASTSpanBase()
    const ast = await parse(code, opt)
    return {
      result: ast,
      spanOffset: offset,
      hasMissingExpression: false,
      extraSpanAfter: offset,
      extraSpanSize: 0,
      toRowCol: (span) => toRowCol(span, spans),
      toSpan: (pos) => toSpan(pos, spans),
      SWCSpanToRowCol: (span) => {
        return toRowCol(span - offset, spans)
      },
      SWCSpanToSpan: (span) => {
        return span - offset
      },
    }
  } catch (err) {
    const offset = await getASTSpanBase()
    const cursorSpan = toSpan(cursor, spans)
    const modifiedCode =
      [...code].slice(0, cursorSpan).join("") +
      '""' +
      [...code].slice(cursorSpan).join("")
    try {
      const ast = await parse(modifiedCode, opt)
      return {
        result: ast,
        spanOffset: offset,
        hasMissingExpression: true,
        extraSpanAfter: offset + cursorSpan,
        extraSpanSize: 2,
        toRowCol: (span) => toRowCol(span, spans),
        toSpan: (pos) => toSpan(pos, spans),
        SWCSpanToRowCol: (span) => {
          if (span > offset + cursorSpan) {
            return toRowCol(span - offset - 2, spans)
          } else {
            return toRowCol(span - offset, spans)
          }
        },
        SWCSpanToSpan: (span) => {
          if (span > offset + cursorSpan) {
            return span - offset - 2
          } else {
            return span - offset
          }
        },
      }
    } catch (err: any) {
      throw new Error(stripAnsi(err))
    }
  }
}

export const isInJSXContext = (
  parseRes: ParseResult,
  position: vscode.Position
) => {
  const targetPos = parseRes.toSpan([position.line, position.character])

  let hit = false

  visitModule(parseRes.result, (node, ctx) => {
    // console.log(`[isInJSXContext]: ${node.type}, ${parseRes.SWCSpanToRowCol(node.span.start)} - ${parseRes.SWCSpanToRowCol(node.span.end)}`)

    const full = [
      parseRes.SWCSpanToSpan(node.span.start),
      parseRes.SWCSpanToSpan(node.span.end),
    ]

    // ignore not in element
    if (full[0] >= targetPos || targetPos >= full[1]) {
      ctx.leave()
      return
    }

    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      const tagStart = [
        parseRes.SWCSpanToSpan(node.opening.span.start),
        parseRes.SWCSpanToSpan(node.opening.span.end),
      ]
      const tagEnd = node.closing
        ? [
            parseRes.SWCSpanToSpan(node.closing.span.start),
            parseRes.SWCSpanToSpan(node.closing.span.end),
          ]
        : null

      console.log(
        "[isInJSXContext]: scan jsx tag, ",
        targetPos,
        full,
        tagStart,
        tagEnd
      )

      // ignore self close element
      if (tagEnd == null) {
        return
      }

      // ignore not in element
      if (full[0] >= targetPos || targetPos >= full[1]) {
        return
      }

      // ignore in start tag
      if (tagStart[0] < targetPos && targetPos < tagStart[1]) {
        return
      }

      // ignore in end tag
      if (tagEnd[0] < targetPos && targetPos < tagEnd[1]) {
        return
      }

      // ignore in non text children
      for (const child of node.children) {
        if (child.type !== "JSXText") {
          if (
            parseRes.SWCSpanToSpan(child.span.start) < targetPos &&
            targetPos < parseRes.SWCSpanToSpan(child.span.end)
          ) {
            // woops, we are in child element
            return
          }
        }
      }

      // stop the visitor because we found it
      console.log("[isInJSXContext]: found")
      hit = true
      ctx.stop()
    }
  })

  return hit
}

export const getExistingImport = (parseRes: ParseResult, filePath: string) => {
  const imports = parseRes.result.body.filter(
    (i) => i.type === "ImportDeclaration"
  )
  for (const statement of imports) {
    if (statement.source.value === filePath) {
      for (const specifier of statement.specifiers) {
        if (specifier.type === "ImportDefaultSpecifier") {
          return {
            start: parseRes.SWCSpanToRowCol(specifier.local.span.start)!,
            end: parseRes.SWCSpanToRowCol(specifier.local.span.end)!,
            name: specifier.local.value,
          }
        }
      }
    }
  }
  return null
}

export interface InsertResult {
  at: [row: number, col: number];
  identifierStart: [row: number, col: number];
  identifierEnd: [row: number, col: number];
  name: string;
  content: string;
  snippet: vscode.SnippetString;
}

export const getImportInsertPosAndName = (
  parseRes: ParseResult,
  defaultName: string,
  filePath: string
): InsertResult => {
  const importNames: string[] = []
  const imports = parseRes.result.body.filter(
    (i) => i.type === "ImportDeclaration"
  )

  for (const statement of imports) {
    for (const specifier of statement.specifiers) {
      importNames.push(specifier.local.value)
    }
  }

  let counter = 0
  let finalName = defaultName

  while (importNames.includes(finalName)) {
    counter += 1
    finalName = defaultName + counter
  }

  const lastImport = imports[imports.length - 1]
  const IDENTIFIER_OFFSET = "import ".length

  if (lastImport == null) {
    return {
      at: [0, 0],
      identifierStart: [0, IDENTIFIER_OFFSET],
      identifierEnd: [0, IDENTIFIER_OFFSET + finalName.length],
      name: finalName,
      content: `import ${finalName} from ${JSON.stringify(filePath)}\n`,
      snippet: new vscode.SnippetString()
        .appendText("import ")
        .appendPlaceholder(finalName, 1)
        .appendTabstop(0)
        .appendText(` from ${JSON.stringify(filePath)}\n`),
    }
  } else {
    const lastImportEnd = parseRes.SWCSpanToRowCol(lastImport.span.end)
    return {
      at: [lastImportEnd![0], lastImportEnd![1]],
      // next line
      identifierStart: [lastImportEnd![0] + 1, IDENTIFIER_OFFSET],
      identifierEnd: [
        lastImportEnd![0] + 1,
        IDENTIFIER_OFFSET + finalName.length,
      ],
      name: finalName,
      content: `\nimport ${finalName} from ${JSON.stringify(filePath)}`,
      snippet: new vscode.SnippetString()
        .appendText("\nimport ")
        .appendPlaceholder(finalName, 1)
        .appendTabstop(0)
        .appendText(` from ${JSON.stringify(filePath)}`),
    }
  }
}
