import { Buffer } from "buffer";
import express from "express";
const app = express();
app.use(express.json());

app.post("/", (req, res) => {
  try {
    // -------- health-check ----------
    if (req.body?.action === "ping") {
      const clear = JSON.stringify({ data: { status: "active" } });
      const b64   = Buffer.from(clear, "utf8").toString("base64");
      return res.type("text/plain").send(b64);
    }

    // -------- flujo normal ----------
    const d = req.body?.data || {};
    const clear = JSON.stringify({
      screen: "CONFIRMACION",
      data:   d
    });
    const b64 = Buffer.from(clear, "utf8").toString("base64");
    return res.type("text/plain").send(b64);   // <- SIEMPRE Base64
  } catch (e) {
    console.error(e);
    return res.status(500).end();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("stub listening on", PORT));
