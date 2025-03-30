import type ts from 'typescript'
import { ImportResult } from './utils'

export interface ParseResult {
  ast: ts.SourceFile
  file: ts.server.ScriptInfo
}

export interface InsertFileResult {
  isInMissingExpr: boolean
  isInJSXText: boolean
  isInString: boolean
  import: ImportResult
}
