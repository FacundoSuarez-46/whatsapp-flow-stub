import "dotenv/config";
import crypto from "crypto";
import express from "express";

const { PRIVATE_KEY } = process.env;
if (!PRIVATE_KEY) throw new Error("Env PRIVATE_KEY vacío");

const TAG = 16;
const app = express();
app.use(express.json());

/* ───────── helpers ──────────────────────────────── */
const flipIV = iv => {
  const out = Buffer.allocUnsafe(iv.length);
  for (let i = 0; i < iv.length; i++) out[i] = iv[i] ^ 0xff;   // invert bits
  return out;
};

function decrypt(body) {
  // 🔴 <<<  fijate en format / type
  const priv = crypto.createPrivateKey({
    key: PRIVATE_KEY,      // texto PEM
    format: "pem",         // «-----BEGIN RSA PRIVATE KEY-----»
    type:   "pkcs1"        // porque es PKCS #1 y no PKCS #8
  });

  const aes = crypto.privateDecrypt(
    {
      key: priv,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    Buffer.from(body.encrypted_aes_key, "base64")
  );

  const iv      = Buffer.from(body.initial_vector,   "base64");
  const payload = Buffer.from(body.encrypted_flow_data, "base64");
  const data    = payload.subarray(0, -TAG);
  const tag     = payload.subarray(-TAG);

  const dec = crypto.createDecipheriv("aes-128-gcm", aes, iv);
  dec.setAuthTag(tag);
  const clear = Buffer.concat([dec.update(data), dec.final()]).toString("utf8");

  return { aes, iv, body: JSON.parse(clear) };
}

function encrypt(obj, aes, iv) {
  const enc = crypto.createCipheriv("aes-128-gcm", aes, flipIV(iv));
  const ct  = Buffer.concat([
    enc.update(JSON.stringify(obj), "utf8"),
    enc.final(),
    enc.getAuthTag()
  ]);
  return ct.toString("base64");
}
/* ─────────────────────────────────────────────────── */

app.post("/", (req, res) => {
  try {
    /* 🔵  Health-check (sin cifrado) ------------------- */
    if (req.body?.action === "ping") {
      return res
        .type("text/plain")
        .send(Buffer.from(JSON.stringify({ data: { status: "active" } })).toString("base64"));
    }
    /* ------------------------------------------------- */

    const { aes, iv, body } = decrypt(req.body);

    switch (body.action) {
      case "INIT":           // primera llamada al abrir el flow
        return res
          .type("text/plain")
          .send(encrypt({ screen: "INASISTENCIA", data: {} }, aes, iv));

      case "data_exchange":  // al enviar la pantalla INASISTENCIA
        return res
          .type("text/plain")
          .send(encrypt({ screen: "CONFIRMACION", data: body.data ?? {} }, aes, iv));

      default:
        console.error("❌ acción no soportada →", body);
        return res.status(400).end();
    }
  } catch (e) {
    console.error("💥 endpoint error:", e);
    return res.status(500).end();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Flows stub en", PORT));
