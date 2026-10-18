(function () {
    const apiOrigin = window.location.port === "5000"
        ? window.location.origin
        : `${window.location.protocol}//${window.location.hostname || "localhost"}:5000`;

    async function request(endpoint, options) {
        const requestOptions = { ...(options || {}) };
        const headers = new Headers(requestOptions.headers || {});

        if (requestOptions.body &&
            !(requestOptions.body instanceof FormData) &&
            !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        requestOptions.headers = headers;
        requestOptions.credentials = "include";

        const response = await fetch(`${apiOrigin}/api${endpoint}`, requestOptions);
        const contentType = response.headers.get("content-type") || "";
        const result = contentType.includes("application/json")
            ? await response.json()
            : null;

        if (!response.ok) {
            const error = new Error(result?.message || `Request failed with status ${response.status}.`);
            error.status = response.status;
            throw error;
        }
        return result;
    }

    async function download(endpoint) {
        const response = await fetch(`${apiOrigin}/api${endpoint}`, {
            credentials: "include"
        });
        if (!response.ok) {
            const contentType = response.headers.get("content-type") || "";
            const result = contentType.includes("application/json")
                ? await response.json()
                : null;
            throw new Error(result?.message || `Download failed with status ${response.status}.`);
        }
        return response.blob();
    }

    window.ViniyogAPI = { request, download, apiOrigin };
})();
