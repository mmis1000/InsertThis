import { posix, win32 } from "path"
import { Uri } from "vscode"
const { basename } = posix

const extensionSuffixMap: Record<string, string> = {
  svg: "Img",
  png: "Img",
  jpg: "Img",
  jpeg: "Img",
  webp: "Img",
}

export const relative = (from: Uri, to: Uri) => {
  // do to case insensitive of driver letter
  if (from.scheme === "file" && to.scheme === "file") {
    return win32
      .relative(win32.dirname(from.fsPath), to.fsPath)
      .replaceAll(win32.sep, posix.sep)
  }

  return posix.relative(posix.dirname(from.path), to.path)
}

export const getSanitizedName = (path: string) => {
  const filename = basename(path).replace(/\.[^.]+$/, "")

  const extension = /\.([^.]+)$/.exec(basename(path))?.[1].toLowerCase() ?? ""

  const suffix = extensionSuffixMap[extension] ?? ""

  const sanitizedName =
    filename
      .split(/(?=[A-Z])|[-_\\/: ]/g)
      .filter((i) => !!i)
      .map((i, index) => {
        if (index === 0) {
          return i.toLocaleLowerCase()
        }
        return i.slice(0, 1).toUpperCase() + i.slice(1).toLowerCase()
      })
      .join("") + suffix

  return sanitizedName
}
