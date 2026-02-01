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
// récupérer le dernier deck utilisé par un joueur (via battlelog)
// GET /last-deck-by-tag?tag=%23C0G20PR2
app.get("/last-deck-by-tag", async (req, res) => {
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
    )}/battlelog`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CLASH_API_TOKEN}`
      }
    });

    const battles = response.data;
    if (!Array.isArray(battles) || battles.length === 0) {
      return res.status(404).json({ error: "No battles found for this player" });
    }

    // on prend la dernière bataille
    const lastBattle = battles[0];
    const team = lastBattle.team && lastBattle.team[0];
    if (!team || !team.cards) {
      return res.status(404).json({ error: "No deck found in last battle" });
    }

    const deck = team.cards.map(card => ({
      name: card.name,
      level: card.level,
      maxLevel: card.maxLevel
    }));

    res.json({ tag, deck });
  } catch (err) {
    console.error("Erreur last-deck-by-tag:", err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: "Unknown error" });
  }
});

// recherche dans le ladder (top joueurs) par pseudo et/ou trophées (elo)
// recherche dans le ladder (top joueurs) par elo (path of legend)
// GET /search-ladder?elo=2664
app.get("/search-ladder", async (req, res) => {
  try {
    if (!CLASH_API_TOKEN) {
      return res.status(500).json({ error: "CLASH_API_TOKEN is not set" });
    }

    const { elo } = req.query;
    
    if (!elo) {
      return res.status(400).json({
        error: "Provide 'elo' as query parameter (e.g., ?elo=2664)"
      });
    }

    const targetElo = parseInt(elo, 10);
    if (isNaN(targetElo)) {
      return res.status(400).json({
        error: "'elo' must be a valid number"
      });
    }

    // on appelle RoyaleAPI pour récupérer le top ladder en Elo
    const url = "https://royaleapi.com/api/top/players";

    const response = await axios.get(url);

    const players = response.data || [];

    // on filtre ceux qui ont exactement cet Elo (ou très proche, ±5)
    const matches = players.filter(p => {
      const playerElo = p.league?.trophies || p.trophies || 0;
      return Math.abs(playerElo - targetElo) <= 5;
    });

    res.json({
      count: matches.length,
      players: matches.map(p => ({
        name: p.name,
        tag: p.tag,
        rank: p.rank,
        elo: p.league?.trophies || p.trophies || 0
      }))
    });
  } catch (err) {
    console.error("Erreur search-ladder:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch ladder data" });
  }
});
app.listen(PORT, () => {
  console.log(`ZorkCham backend listening on port ${PORT}`);
});
