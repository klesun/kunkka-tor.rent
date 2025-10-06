import { createServer } from "http";

const PORT = process.env.PORT || 48267;

const NYAA_PATHNAME = "/nyaa.si/view/";

async function handleRequest(req, res) {
    if (req.url.startsWith(NYAA_PATHNAME)) {
        var nyaaId = req.url.slice(NYAA_PATHNAME.length);
        try {
            const response = await fetch("https://nyaa.si/view/" + nyaaId);
            res.status = response.status;
            const contentType = response.headers.get("content-type");
            res.setHeader("content-type", contentType);
            res.write(Buffer(await response.arrayBuffer()));
        } catch (error) {
            res.status = 500;
            res.write("Failed to proxy request: " + error);
        }
    } else {
        res.status = 404;
        res.write("No API route defined for " + req.url);
    }
    res.end();
}

function main() {
    const httpServer = createServer({}, (req, res) => handleRequest(req, res));
    httpServer.listen(+PORT, "0.0.0.0", () => {
        console.log("listening for http requests on http://localhost:" + PORT);
    });
}

main();
