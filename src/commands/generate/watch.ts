
import { findFileNamesFromGlob, loadOtFiles } from "../../core/schema/schema";
import LocalCommand from "../core/local-command";
import fs from "fs";
import cli from "cli-ux";
import { Connection } from "typeorm";
import { getConnection } from "../generate/crud";
import { exec } from "child_process";
import ora from "ora";
import path from "path";

const watchFileChanges = (filePattern: string, cb: (err?: Error) => void) => {
  const pathsDictionary: { [path: string]: number } = {};

  setInterval(() => {
    let somethingChanged = false;
    let filePaths = findFileNamesFromGlob(filePattern);
    filePaths.map((filePath) => {
      const { size } = fs.statSync(filePath);
      const didChange = !pathsDictionary[filePath] || pathsDictionary[filePath] !== size;
      if (didChange) {
        somethingChanged = true;
      }
      pathsDictionary[filePath] = size;
    })
    if (somethingChanged) {
      cb();
    }
  }, 3000)

};

const IndefinitelyForChanges = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 1000 * 60 * 60 * 24);
  });

export default class Watch extends LocalCommand {
  static description = `watch`;

  static flags = {};

  async run() {
    const connection: Connection | null = await getConnection();
    try {
      this.checks();
      const { args, flags } = this.parse(Watch);
      //loadMetadata
      await loadOtFiles();

      const watchedFiles = (path.join(process.cwd(), "dist") + "/models/**/*.ot.{ts,js}").replace("\\", "/");
      const spinner = ora("Awaiting changes...")
      spinner.start();
      const changesTracker = watchFileChanges(watchedFiles, async () => {
        spinner.text = "Changes detected, generating files...";
        exec("npx merlin-gql generate:all", () => {
          spinner.text = "Awaiting changes..."
        })
      });

      await IndefinitelyForChanges();
    } catch (e) {
      this.error(e);
    } finally {
      connection.close();
    }
  }
}
