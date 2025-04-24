import express from "express";
const app = express();
app.use(express.json());

app.post("/", (_, res) => res.json({ screen: "SUCCESS", data: {} }));
app.get("/",  (_, res) => res.send("OK"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Stub listening on " + PORT));
