import { serialize, deserialize } from '@ungap/structured-clone'
import { inspect } from 'util'
import { COMMAND_ARGS, COMMANDS } from './commands'
import { getExistingOrCreateNewImport, getNodeInLocation } from './utils'
import { InsertFileResult } from './interface'

const MISSING_EXPR_CODE = 1109

function init(modules: {
  typescript: typeof import('typescript/lib/tsserverlibrary')
}) {
  const ts = modules.typescript

  function create(
    info: import('typescript/lib/tsserverlibrary').server.PluginCreateInfo
  ) {
    console.log('hello tsc plugin')
    info.session?.addProtocolHandler(COMMANDS.test, (arg) => {
      info.project.projectService.logger.info('command 123')
      const normalizedPath = ts.server.toNormalizedPath(arg.arguments)

      const projectService = info.project.projectService
      const scriptInfo =
        projectService.getScriptInfoForNormalizedPath(normalizedPath)
      const targetProject = scriptInfo?.getDefaultProject()
      const sourceFile = targetProject?.getSourceFile(scriptInfo!.path)

      console.log(inspect(scriptInfo))
      console.log(inspect(targetProject))
      return {
        response: serialize(sourceFile, {
          lossy: true
        })
      }
    })
    info.session?.addProtocolHandler(COMMANDS.insertInto, (arg) => {
      const [path, row, col, file, normalizedName]: COMMAND_ARGS['insertInto'] =
        arg.arguments

      info.project.projectService.logger.info('command insert')
      const normalizedPath = ts.server.toNormalizedPath(path)

      const projectService = info.project.projectService
      const scriptInfo =
        projectService.getScriptInfoForNormalizedPath(normalizedPath)
      const targetProject = scriptInfo?.getDefaultProject()
      const sourceFile = targetProject?.getSourceFile(scriptInfo!.path)

      if (scriptInfo == null || sourceFile == null || targetProject == null) {
        throw new Error('cannot read file')
      }

      const res = getNodeInLocation(
        ts,
        {
          ast: sourceFile,
          file: scriptInfo
        },
        row,
        col
      )

      const diagnostics = targetProject
        .getLanguageService()
        .getProgram()!
        .getSyntacticDiagnostics(sourceFile)

      const missingExprErrors = diagnostics.filter(
        (i) => i.code === MISSING_EXPR_CODE
      )
      const pos = scriptInfo.lineOffsetToPosition(row + 1, col + 1)

      const fullText = sourceFile.getFullText()
      const matchedError = missingExprErrors.find((i) => {
        const isLastToken = i.length === 0
        if (isLastToken) {
          return i.start <= pos
        } else {
          return i.start >= pos && fullText.slice(pos, i.start).trim() === ''
        }
      })

      const isInMissingExpr = matchedError != null
      const isInJSXText =
        !isInMissingExpr &&
        /** const jsxElement = <>Te[]xt</> */
        (res?.kind === ts.SyntaxKind.JsxText ||
          /** const jsxElement = <el>[]</el> */
          (res?.kind === ts.SyntaxKind.JsxClosingElement && res.pos === pos) ||
          /** const jsxElement = <>[]</> */
          (res?.kind === ts.SyntaxKind.JsxClosingFragment && res.pos === pos) ||
          /** const jsxElement = <>[]<el></el></> */
          (res?.kind === ts.SyntaxKind.JsxOpeningElement &&
            res.pos === pos &&
            (res.parent.parent.kind === ts.SyntaxKind.JsxElement ||
              res.parent.parent.kind === ts.SyntaxKind.JsxFragment)) ||
          /** const jsxElement = <>[]<></></> */
          (res?.kind === ts.SyntaxKind.JsxOpeningFragment &&
            res.pos === pos &&
            (res.parent.parent.kind === ts.SyntaxKind.JsxElement ||
              res.parent.parent.kind === ts.SyntaxKind.JsxFragment)))
      const isInString =
        !isInMissingExpr &&
        [
          ts.SyntaxKind.StringLiteral,
          ts.SyntaxKind.TemplateHead,
          ts.SyntaxKind.TemplateMiddle,
          ts.SyntaxKind.TemplateTail
        ].includes(res?.kind!)
      const importChange = getExistingOrCreateNewImport(
        ts,
        {
          ast: sourceFile,
          file: scriptInfo
        },
        row,
        col,
        normalizedName,
        file
      )

      const result: InsertFileResult = {
        isInMissingExpr,
        isInJSXText,
        isInString,
        import: importChange
      }
      console.log(
        res != null ? ts.SyntaxKind[res.kind] : '[[not inside node]]',
        'matching error',
        inspect(matchedError),
        'target pos',
        inspect(pos),
        'all error',
        inspect(diagnostics),
        inspect(result),
        inspect(res)
      )

      return {
        response: result
      }
    })
    // Set up decorator object
    const proxy: import('typescript/lib/tsserverlibrary').LanguageService =
      Object.create(null)

    for (let k of Object.keys(info.languageService) as Array<
      keyof import('typescript/lib/tsserverlibrary').LanguageService
    >) {
      const x = info.languageService[k]!
      // @ts-expect-error - JS runtime trickery which is tricky to type tersely
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args)
    }

    return info.languageService
  }

  return { create }
}

init.COMMANDS = COMMANDS

export = init
