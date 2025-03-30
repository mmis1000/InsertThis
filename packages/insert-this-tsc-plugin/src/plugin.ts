
import { serialize, deserialize } from '@ungap/structured-clone';
import { inspect } from 'util';

function init(modules: {
  typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
  const ts = modules.typescript;

  function create(
    info: import("typescript/lib/tsserverlibrary").server.PluginCreateInfo
  ) {
    console.log("hello tsc plugin");
    info.session?.addProtocolHandler("_insert_this_test", (arg) => {
      info.project.projectService.logger.info("command 123");
      const normalizedPath = ts.server.toNormalizedPath(arg.arguments)

      const projectService = info.project.projectService
      const scriptInfo = projectService.getScriptInfoForNormalizedPath(normalizedPath)
      const targetProject = scriptInfo?.getDefaultProject()
      const sourceFile = targetProject?.getSourceFile(scriptInfo!.path)

      console.log(inspect(scriptInfo))
      console.log(inspect(targetProject))
      return {
        response:
          serialize(sourceFile, {
            lossy: true
          }
        ),
      };
    });
    // Set up decorator object
    const proxy: import("typescript/lib/tsserverlibrary").LanguageService =
      Object.create(null);

    for (let k of Object.keys(info.languageService) as Array<
      keyof import("typescript/lib/tsserverlibrary").LanguageService
    >) {
      const x = info.languageService[k]!;
      // @ts-expect-error - JS runtime trickery which is tricky to type tersely
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
    }

    return info.languageService;
  }

  return { create };
}

export = init;
