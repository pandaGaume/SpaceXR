#!/usr/bin/env node

import { processAssets } from "./processAssets";
import { checkArgs } from "./utils";

main();

function main() {
    console.log("spacexr build tools");
    const command = checkArgs(["-c", "--command"], false, true);
    if (command) {
        console.log(`Command: ${command}`);
        switch (command) {
            case "buildShaders":
            case "bs": {
                processAssets({ extensions: ["glsl"] });
                break;
            }
            case "process-assets":
            case "pa": {
                processAssets();
                break;
            }
        }
    }
}
