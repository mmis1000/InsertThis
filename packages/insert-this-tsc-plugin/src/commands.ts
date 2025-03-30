import { InsertFileResult } from "./interface"

export const COMMANDS = {
  test: '_insert_this_test',
  insertInto: '_insert_this_insert_into'
} as const

export interface COMMAND_ARGS {
  test: string,
  insertInto: [path: string, row: number, col: number, file: string, normalizedName: string]
}

export interface COMMAND_RESULT {
  test: any,
  insertInto: InsertFileResult
}