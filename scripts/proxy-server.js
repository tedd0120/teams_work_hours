const http = require("http");
const axios = require("axios");

const TARGET_URL =
  "https://im.360teams.com/api/qfin-api/securityapi/attendance/query/detail";
const PORT = Number(process.env.PROXY_PORT || 8787);

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/attendance") {
    sendJson(res, 404, { error: "Not found." });
    return;
  }

  const emCode = url.searchParams.get("emCode") || "";
  const cycle = url.searchParams.get("cycle") || "";
  const auth = req.headers.authorization || "";

  try {
    const response = await axios.get(TARGET_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        AppKey: "360teams",
        Authorization: auth
      },
      params: {
        emCode,
        attDate: "",
        cycle
      }
    });

    sendJson(res, response.status, response.data);
  } catch (error) {
    const status =
      typeof error === "object" && error && "response" in error
        ? error.response?.status || 500
        : 500;
    const message =
      typeof error === "object" && error && "message" in error
        ? error.message
        : "Proxy request failed.";
    sendJson(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}/attendance`);
});
