
import { posix } from "path"
const { basename } = posix


const extensionSuffixMap: Record<string, string> = {
  svg: "Img",
  png: "Img",
  jpg: "Img",
  jpeg: "Img",
  webp: "Img",
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