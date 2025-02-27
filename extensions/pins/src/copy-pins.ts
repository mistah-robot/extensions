import * as fs from "fs";
import * as XML from "xml-js";
import YAML from "yaml";
import Papa from "papaparse";

import * as TOML from "@iarna/toml";
import { Clipboard, getPreferenceValues, showToast, Toast } from "@raycast/api";

import { getPinsJSON } from "./lib/Pins";

/**
 * Preferences for the Copy Pins Data command.
 */
type CopyPinsPreferences = {
  /**
   * A directory to export pins to, if any. By default, pins are copied to the clipboard.
   */

  exportLocation: string;

  /**
   * The format to export pins in. Either "csv" or "json" (default).
   */
  exportFormat: string;
};

/**
 * Raycast command for exporting Pins and Groups data to the clipboard or a file.
 */
export default async function ExportPinsCommand() {
  const preferences = getPreferenceValues<CopyPinsPreferences>();

  let data = "";
  const jsonData = await getPinsJSON();
  try {
    if (preferences.exportFormat == "csv") {
      const d1 = Papa.unparse(jsonData.pins);
      const d2 = Papa.unparse(jsonData.groups);
      data = `${d1}\n\n\n${d2}`;
    } else if (preferences.exportFormat == "json") {
      data = JSON.stringify(jsonData, null, 2);
    } else if (preferences.exportFormat == "yaml") {
      data = YAML.stringify(jsonData);
    } else if (preferences.exportFormat == "xml") {
      data = XML.json2xml(JSON.stringify({ data: jsonData }), { spaces: 2, compact: true });
    } else if (preferences.exportFormat == "toml") {
      data = TOML.stringify(jsonData);
    }
  } catch (err) {
    await showToast({
      title: "Failed to export pin data.",
      message: `Could not convert data into target type (${preferences.exportFormat})`,
      style: Toast.Style.Failure,
    });
    console.error(err);
    return;
  }

  if (
    preferences.exportLocation.trim().length > 0 &&
    preferences.exportLocation != "/" &&
    (await fs.promises.access(preferences.exportLocation, fs.constants.W_OK)) == undefined
  ) {
    try {
      // For CSVs, split the data into two files: one for pins, one for groups
      // JSON and YAML files are fine to export all at once
      const exports = data.split("\n\n\n");
      for (let i = 0; i < exports.length; i++) {
        let subpart = "";
        if (exports.length > 1) {
          if (i == 0) subpart = "_pins";
          else if (i == 1) subpart = "_groups";
        }

        const exportDir = preferences.exportLocation.trim();
        const filename = `pins_export_${new Date().toLocaleDateString().replaceAll("/", ".")}${subpart}`;

        let attempt = 2;
        let exportFile = `${exportDir}/${filename}.${preferences.exportFormat}`;
        while (fs.existsSync(exportFile)) {
          exportFile = `${exportDir}/${filename} ${attempt}.${preferences.exportFormat}`;
          attempt++;
        }

        fs.writeFileSync(exportFile, exports[i]);
        await showToast({ title: `Exported pin data to ${exportFile}!` });
      }
    } catch (err) {
      console.error(err);
      await showToast({ title: "Failed to export pin data.", style: Toast.Style.Failure });
    }
  } else {
    // When using the clipboard, just copy all of the data at once
    await Clipboard.copy(data);
    const text = await Clipboard.readText();
    if (text == data) {
      await showToast({ title: "Copied pin data to clipboard!" });
    } else {
      await showToast({ title: "Failed to copy pin data to clipboard.", style: Toast.Style.Failure });
    }
  }
}
