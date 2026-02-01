import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// à SET sur Render dans les variables d'environnement
const CLASH_API_TOKEN = process.env.CLASH_API_TOKEN;

app.use(cors());
app.use(express.json());

// simple route pour tester que le backend tourne
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "ZorkCham Tool backend is running" });
});

// exemple basique: récupérer les infos d'un joueur par tag
// usage: GET /player-by-tag?tag=%23C0G20PR2  (le # devient %23 dans l'URL)
app.get("/player-by-tag", async (req, res) => {
  try {
    if (!CLASH_API_TOKEN) {
      return res.status(500).json({ error: "CLASH_API_TOKEN is not set" });
    }

    const tag = req.query.tag;
    if (!tag) {
      return res.status(400).json({ error: "Missing 'tag' query parameter" });
    }

    const url = `https://api.clashroyale.com/v1/players/${encodeURIComponent(
      tag
    )}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CLASH_API_TOKEN}`
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Erreur API Clash Royale:", err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: "Unknown error" });
  }
});

// on ajoute un log pour être sûr que le serveur démarre bien
app.listen(PORT, () => {
  console.log(`ZorkCham backend listening on port ${PORT}`);
});
