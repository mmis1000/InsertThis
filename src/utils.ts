
import { posix } from "path"
const { basename } = posix

export const parseSpan = (text: string): number[] => {
  const splitted = text.split(/\n/g)
  console.log(splitted)
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