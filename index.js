import "dotenv/config";
import crypto from "crypto";
import express from "express";

const { PRIVATE_KEY } = process.env;
if (!PRIVATE_KEY) throw new Error("Env PRIVATE_KEY vacío");

const TAG = 16;
const app = express();
app.use(express.json());

/* helpers -------------------------------------------------------- */
const flipIV = iv => Buffer.from(iv.map(b => b ^ 0xff));

function decrypt(body) {
  const priv = crypto.createPrivateKey({
    key: PRIVATE_KEY,
    format: "pem",
  });

  const aes = crypto.privateDecrypt(
    { key: priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(body.encrypted_aes_key, "base64")
  );

  const iv  = Buffer.from(body.initial_vector,   "base64");
  const buf = Buffer.from(body.encrypted_flow_data, "base64");
  const data = buf.subarray(0, -TAG);
  const tag  = buf.subarray(-TAG);

  const dec = crypto.createDecipheriv("aes-128-gcm", aes, iv);
  dec.setAuthTag(tag);
  const clear = Buffer.concat([dec.update(data), dec.final()]).toString("utf8");
  return { aes, iv, body: JSON.parse(clear) };
}

function encrypt(obj, aes, iv) {
  const enc = crypto.createCipheriv("aes-128-gcm", aes, flipIV(iv));
  const ct  = Buffer.concat([enc.update(JSON.stringify(obj), "utf8"), enc.final(), enc.getAuthTag()]);
  return ct.toString("base64");
}
/* --------------------------------------------------------------- */

app.post("/", (req, res) => {
  /* 1️⃣  PING plano — no intenta desencriptar */
  if (req.body?.action === "ping") {
    const b64 = Buffer.from(JSON.stringify({ data: { status: "active" } })).toString("base64");
    return res.type("text/plain").send(b64);
  }

  try {
    const { aes, iv, body } = decrypt(req.body);

    switch (body.action) {
      case "INIT":
        return res.type("text/plain")
                  .send(encrypt({ screen: "INASISTENCIA", data: {} }, aes, iv));

      case "data_exchange":
        return res.type("text/plain")
                  .send(encrypt({ screen: "CONFIRMACION", data: body.data ?? {} }, aes, iv));

      default:
        console.error("acción no soportada:", body);
        return res.status(400).end();
    }
  } catch (err) {
    /* 2️⃣  Error de clave/descifrado → 421 obliga al cliente a refrescar */
    console.error("decrypt error:", err);
    return res.status(421).end();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Flows stub en", PORT));
