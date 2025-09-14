
const { React, ReactDOM } = window;
import Index from "./Index.tsx";

function neverNull(): never {
    throw new Error("Unexpected null value");
}

export default function main() {
    const searchParams = new URLSearchParams(window.location.search);
    const reactContainer = document.getElementById("react-app-root-container") ?? neverNull();
    const dataFromServer = JSON.parse(document.getElementById("ssr-data-from-server")?.textContent ?? neverNull());
    const root = ReactDOM.createRoot(reactContainer);
    root.render(React.createElement(Index, {
        infoHash: dataFromServer.infoHash,
    }));
}