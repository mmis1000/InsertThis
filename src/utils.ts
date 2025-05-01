import assert from 'assert'
import { posix, win32 } from 'path'
import { ProgressLocation, Uri, window, workspace } from 'vscode'
import { SNIPPET_VARIABLES } from './constants'
const { basename } = posix

export const relative = (from: Uri, to: Uri) => {
  // do to case insensitive of driver letter
  if (from.scheme === 'file' && to.scheme === 'file') {
    return win32
      .relative(win32.dirname(from.fsPath), to.fsPath)
      .replaceAll(win32.sep, posix.sep)
  }

  return posix.relative(posix.dirname(from.path), to.path)
}

export const getExtension = (path: string) => {
  const extension = /\.([^.]+)$/.exec(basename(path))?.[1].toLowerCase() ?? ''
  return extension
}

export const getFileName = (path: string) => {
  const filename = basename(path).replace(/\.[^.]+$/, '')
  return filename
}

export const getSanitizedName = (path: string, suffix: string, nameRule: 'pascal' | 'camel') => {
  const filename = getFileName(path)

  suffix = suffix.slice(0, 1).toUpperCase() + suffix.slice(1)

  let sanitizedName =
    filename
      .replace(/@\d+$/, '')
      .split(/(?=[A-Z])|[-_\\/: ]/g)
      .filter((i) => !!i)
      .map((i, index) => {
        if (index === 0) {
          return i.toLocaleLowerCase()
        }
        return i.slice(0, 1).toUpperCase() + i.slice(1).toLowerCase()
      })
      .join('')
      // https://stackoverflow.com/a/6926184
      .replace(/[^$_\p{L}\p{Mn}\p{Mc}\p{Nd}\p{Pc}\u200C\u200D]/gu, '_') + suffix

  if (nameRule === 'pascal') {
    sanitizedName = sanitizedName.slice(0, 1).toUpperCase() + sanitizedName.slice(1)
  }

  return sanitizedName
}

export const getWithExtension = (
  configObj: Record<string, string>,
  ext: string
) => {
  let defaultValue = undefined

  for (const [k, v] of Object.entries(configObj)) {
    if (k === '*') {
      defaultValue = v
    } else {
      const entries = k.match(/\[.+?\]/g)?.map((i) => i.slice(1, -1))
      if (entries) {
        for (const entry of entries) {
          if (entry === ext) {
            return v
          }
        }
      }
    }
  }

  return defaultValue
}

/**
 * locate simple textmate variable like $VARIABLE, ignores ${VARIABLE} or whatever variant
 * @param str
 */
export const getVariables = (str: string): string[] => {
  const reg = /\$\$|\$[a-zA-Z][a-zA-Z0-9_]*|[^\$]+|./g
  const segments = [...str.matchAll(reg)].map((i) => i[0])
  return segments
    .filter((i) => i.startsWith('$') && i !== '$$' && i !== '$')
    .map((i) => i.slice(1))
}

/**
 * locate simple textmate variable like $VARIABLE, ignores ${VARIABLE} or whatever variant
 * @param str
 */
export const replaceVariables = (
  str: string,
  values: Record<string, string>
): string => {
  const reg = /\$\$|\$[a-zA-Z][a-zA-Z0-9_]*|[^\$]+|./g
  const segments = [...str.matchAll(reg)]

  let res: string = str

  for (let i = segments.length - 1; i >= 0; i--) {
    const index = segments[i].index
    const segmentContent = segments[i][0]
    const length = segmentContent.length

    if (
      segmentContent.startsWith('$') &&
      segmentContent != '$$' &&
      segmentContent != '&'
    ) {
      if (values[segmentContent.slice(1)] != null) {
        res =
          res.slice(0, index) +
          values[segmentContent.slice(1)] +
          res.slice(index + length)
      }
    }
  }

  return res
}

export const readConfig = (ext: string) => {
  const config = workspace.getConfiguration('insertThis')
  const jsxTemplates = config.get('jsxTemplateStringByFileExtension') as Record<
    string,
    string
  >
  const jsxTemplateWithSizes = config.get(
    'jsxTemplateStringWithImageSizeByFileExtension'
  ) as Record<string, string>
  const variableSuffixes = config.get(
    'variableSuffixByFileExtension'
  ) as Record<string, string>
  const variableNameRules = config.get(
    'variableNameRuleByFileExtension'
  ) as Record<string, string>


  const importTemplate = "import ${1:$VARIABLE_NAME} from $SERIALIZED_FILE_NAME"
  const jsxTemplate = getWithExtension(jsxTemplates, ext)
  const jsxTemplateWithSize = getWithExtension(jsxTemplateWithSizes, ext)
  const variableSuffix = getWithExtension(variableSuffixes, ext)
  const variableNameRule = getWithExtension(variableNameRules, ext) as 'pascal' | 'camel'

  assert(importTemplate != null)
  assert(jsxTemplate != null)
  assert(variableSuffix != null)
  assert(variableNameRule != null && ['pascal' as const, 'camel' as const].includes(variableNameRule))

  const importTemplateBindings = getVariables(importTemplate)
  const jsxTemplateBindings = getVariables(jsxTemplate)
  const jsxTemplateWithSizeBindings =
    jsxTemplateWithSize != null ? getVariables(jsxTemplateWithSize) : undefined

  assert(importTemplateBindings.includes(SNIPPET_VARIABLES.VARIABLE_NAME))
  assert(
    importTemplateBindings.includes(SNIPPET_VARIABLES.SERIALIZED_FILE_NAME)
  )
  assert(jsxTemplateBindings.includes(SNIPPET_VARIABLES.VARIABLE_NAME))

  if (jsxTemplateWithSizeBindings != null) {
    assert(
      jsxTemplateWithSizeBindings.includes(SNIPPET_VARIABLES.VARIABLE_NAME)
    )
    assert(jsxTemplateWithSizeBindings.includes(SNIPPET_VARIABLES.IMAGE_WIDTH))
    assert(jsxTemplateWithSizeBindings.includes(SNIPPET_VARIABLES.IMAGE_HEIGHT))
  }

  return {
    importTemplate,
    jsxTemplate,
    jsxTemplateWithSize,
    variableSuffix,
    variableNameRule
  }
}


export const toastWithSelfDismiss = (msg: string, duration = 4000) => {
  const step = 50
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title:msg,
      cancellable: true
    },
    async (progress, token) => {
      progress.report({ increment: 0 })
      for (let i = 0; i < step; i++) {
        setTimeout(() => {
          progress.report({
            increment: 100 / step
          })
        }, (duration / step) * (i + 1))
      }
      return Promise.race([
        new Promise((r) => setTimeout(r, duration)),
        new Promise((r) => {
          token.onCancellationRequested(r)
        })
      ])
    }
  )
}
