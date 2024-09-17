module.exports = {
  /** resolves from test to snapshot path */
  resolveSnapshotPath: (testPath: string, snapshotExtension: string) => {
    return testPath.replace(/out([\/\\])/, 'src$1test$1__snapshots__$1') + snapshotExtension
  },

  /** resolves from snapshot to test path */
  resolveTestPath: (snapshotFilePath: string, snapshotExtension: string) => {
    return snapshotFilePath
      .replace(/src([\/\\])test[\/\\]__snapshots__[\/\\]/, 'out$1')
      .slice(0, -snapshotExtension.length)
  },
  testPathForConsistencyCheck:
    "out/test/another.test.js"
}