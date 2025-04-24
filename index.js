import express from "express";
const app = express();
app.use(express.json());

/* ---------- DATA-EXCHANGE ---------- */
app.post("/", (req, res) => {
  const d = req.body;
  res.json({
    screen: "CONFIRMACION",
    data: {
      documento:       d.documento,
      legajo:          d.legajo,
      nombre_completo: d.nombre_completo,
      fecha_desde:     d.fecha_desde,
      fecha_hasta:     d.fecha_hasta,
      sector:          d.sector,
      turno_asignado:  d.turno_asignado
    }
  });
});

/* ---------- HEALTH-CHECK ---------- */
const okB64 = Buffer
  .from(JSON.stringify({ data: { status: "active" } }))
  .toString("base64");

/* Builder llama a GET /  */
app.get("/",      (_, res) => res.send(okB64));
/* Algunas versiones llaman a /healthz */
app.get("/healthz", (_, res) => res.send(okB64));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Stub listening on " + PORT));
