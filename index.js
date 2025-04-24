import { Buffer } from "buffer";
import express from "express";
const app = express();
app.use(express.json());

app.post("/", (req, res) => {
  try {
    // si es health-check → acción "ping"
    if (req.body?.action === "ping") {
      const clear = JSON.stringify({ data: { status: "active" } });
      const b64   = Buffer.from(clear).toString("base64");
      return res.type("text/plain").send(b64);   // <- cadena Base64
    }

    // -------- tu lógica normal --------
    const d = req.body?.data || {};
    return res.json({
      screen: "CONFIRMACION",
      data:  d
    });
  } catch (e) {
    console.error(e);
    return res.status(500).end();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("stub listening on", PORT));
