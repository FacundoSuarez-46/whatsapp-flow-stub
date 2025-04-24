import "dotenv/config";
import crypto from "crypto";
import express from "express";
const { PRIVATE_KEY, PASSPHRASE = "" } = process.env;

const app = express();
app.use(express.json());

// --- utilidades -------------------------------------------------
const TAG_LEN = 16;
function decryptRequestBody(body) {
  const priv = crypto.createPrivateKey({ key: PRIVATE_KEY, passphrase: PASSPHRASE });
  const aesKey = crypto.privateDecrypt(
    { key: priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(body.encrypted_aes_key, "base64")
  );
  const iv  = Buffer.from(body.initial_vector, "base64");
  const buf = Buffer.from(body.encrypted_flow_data, "base64");
  const cipherText = buf.subarray(0, -TAG_LEN);
  const tag = buf.subarray(-TAG_LEN);

  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
  return { aesKey, iv, payload: JSON.parse(json) };
}

function encryptResponseBody(obj, aesKey, iv) {
  // invierte los bits del IV (requisito de Meta)
  const flipped = Buffer.from(iv.map(b => ~b));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flipped);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final(), cipher.getAuthTag()]);
  return ct.toString("base64");
}
// ----------------------------------------------------------------

app.post("/", (req, res) => {
  try {
    const { aesKey, iv, payload } = decryptRequestBody(req.body);

    // --- Health-check -----------------------------------------------------
    if (payload.action === "ping") {
      return res
        .type("text/plain")
        .send(encryptResponseBody({ data: { status: "active" } }, aesKey, iv));
    }

    // --- DATA EXCHANGE: primera pantalla -> CONFIRMACION ------------------
    if (payload.action === "data_exchange") {
      return res
        .type("text/plain")
        .send(
          encryptResponseBody(
            {
              screen: "CONFIRMACION",
              data: payload.data ?? {},
            },
            aesKey,
            iv
          )
        );
    }

    // --- flujo completado -------------------------------------------------
    if (payload.action === "INIT") {
      return res
        .type("text/plain")
        .send(
          encryptResponseBody(
            { screen: "INASISTENCIA", data: {} },
            aesKey,
            iv
          )
        );
    }

    // si llega cualquier otra cosa
    console.error("Acción no manejada:", payload);
    return res.status(400).end();
  } catch (e) {
    console.error(e);
    // 500 genérico: forzará reintento del cliente
    return res.status(500).end();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("endpoint Flows escuchando en", PORT));
