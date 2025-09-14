import { loadModule } from "https://klesun.github.io/ts-browser/src/ts-browser.js";

// language=file-reference
const entryScriptPath = "./index.ts";

loadModule(entryScriptPath, { jsx: "react" }).then(async indexModule => {
    if (document.readyState === "complete") {
        await indexModule.default();
    } else {
        await new Promise((resolve, reject) => {
            window.addEventListener("load", () => {
                return indexModule
                    .default()
                    .then(resolve, reject);
            });
        });
    }
}).catch(error => {
    console.error(error);
    alert("Failed to initialize page: " + error);
});