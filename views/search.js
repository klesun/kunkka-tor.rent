import ApiUntyped from "../src/client/ApiUntyped.js";
import { loadModule } from "https://klesun.github.io/ts-browser/src/ts-browser.js";

const api = ApiUntyped();

function neverNull() {
    throw new Error("Unexpected null value");
}

const initReact = (appComponent, appProps) => {
    const reactContainer = document.getElementById("react-app-root-container") ?? neverNull();
    const { React, ReactDOM } = window;
    const root = ReactDOM.createRoot(reactContainer);
    root.render(React.createElement(appComponent, appProps));
};

const main = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const started = api.qbtv2.search.start({
        pattern: searchParams.get('pattern'),
        category: searchParams.get('category') || 'all',
        plugins: searchParams.get('plugins') || 'all',
    });
    const whenLocalResults = api.findTorrentsInLocalDb({
        userInput: searchParams.get('pattern'),
    });

    // language=file-reference
    const appComponentPath = "./Search.tsx";
    loadModule(appComponentPath, { jsx: "react" }).then(async ({ default: Search }) => {
        const localResults = await whenLocalResults;
        const { id } = await started;
        const appProps = { qbtv2SearchId: id, localResults };
        if (document.readyState === "complete") {
            initReact(Search, appProps);
        } else {
            window.addEventListener("load", () => {
                initReact(Search, appProps);
            });
        }
    });
};

main().catch(exc => {
    console.error(exc);
    alert('Main script execution failed - ' + exc);
});
