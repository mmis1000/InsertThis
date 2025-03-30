import { InsertFileResult } from "./interface"

export const COMMANDS = {
  insertInto: '_insert_this_insert_into'
} as const

export interface COMMAND_ARGS {
  insertInto: [path: string, row: number, col: number, file: string, normalizedName: string]
}

export interface COMMAND_RESULT {
  insertInto: InsertFileResult
}