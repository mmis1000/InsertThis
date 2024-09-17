import * as path from "path"

import { runTests } from "@vscode/test-electron"

import { instrument } from "./coverage"
import { promises as fs } from "fs"

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../")

    // The path to test runner
    // Passed to --extensionTestsPath
    let extensionTestsPath = path.resolve(__dirname, "./suite/index")

    if (process.argv.indexOf("--coverage") >= 0) {
      // generate instrumented files at out-cov
      instrument()

      // load the instrumented files
      extensionTestsPath = path.resolve(__dirname, "../../out-cov/suite/index")

      // signal that the coverage data should be gathered
      process.env["GENERATE_COVERAGE"] = "1"
    }

    await fs.rm(path.resolve(__dirname, "../../out/test/testworkspace"), {
      force: true,
      recursive: true,
    })
    await fs.cp(
      path.resolve(__dirname, "../../src/test/testworkspace"),
      path.resolve(__dirname, "../../out/test/testworkspace"),
      { recursive: true }
    )

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ["./out/test/testworkspace", "--disable-extensions"],
    })
  } catch (err) {
    console.error(err)
    console.error("Failed to run tests")
    process.exit(1)
  }
}

main()
