module.exports = {
  /** resolves from test to snapshot path */
  resolveSnapshotPath: (testPath: string, snapshotExtension: string) => {
    console.log('resolveSnapshotPath', testPath, snapshotExtension)
    return testPath.replace(/out([\/\\])/, 'src$1test$1__snapshots__$1') + snapshotExtension
  },

  /** resolves from snapshot to test path */
  resolveTestPath: (snapshotFilePath: string, snapshotExtension: string) => {
    console.log('resolveTestPath', snapshotFilePath, snapshotExtension)
    return snapshotFilePath
      .replace(/src([\/\\])test[\/\\]__snapshots__[\/\\]/, 'out$1')
      .slice(0, -snapshotExtension.length)
  },
  testPathForConsistencyCheck:
    "out/test/another.test.js"
}