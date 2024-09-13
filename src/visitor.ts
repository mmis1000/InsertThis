import { ClassMember, ComputedPropName, Decorator, Expression, Fn, HasSpan, Module, ModuleItem, Node, Pattern } from "@swc/wasm"

type SupportedNode = (ModuleItem | ClassMember | Decorator | Expression | ComputedPropName | Pattern | Node & { type: never } & HasSpan) & HasSpan

interface Visitor {
    (node: SupportedNode, ctx: Context): void
}

interface Context {
    stop(): void
    stopped: boolean
}

const createContext = () => {
    let stopped = false
    return {
        stop () {
            stopped = true
        },
        get stopped () {
            return stopped
        }
    }
}

export const visitModule = (module: Module, visitor: Visitor) => {
    for (const s of module.body) {
        visitNode(s, visitor, createContext())
    }
}

const visitNode = (node: SupportedNode | undefined, visitor: Visitor, ctx: Context) => {
    if (node == undefined) {return}

    visitor(node, ctx)

    const deep = (a: any) => {
        if (a == null) {
            return
        }
        if (Array.isArray(a)) {
            for (const value of a) {
                if (value != null && typeof value === 'object' && (value as any).type && (value as any).span) {
                    visitNode(value as any, visitor, ctx)
                    if (ctx.stopped) {return}
                } else {
                    deep(value)
                }
            }
            return
        }
        if (typeof a === 'object') {
            deep(Object.values(a))
            return
        }
    }

    deep(node)
}