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
// GET /search-ladder?name=zorx&elo=7500
app.get("/search-ladder", async (req, res) => {
  try {
    if (!CLASH_API_TOKEN) {
      return res.status(500).json({ error: "CLASH_API_TOKEN is not set" });
    }

    const { name, elo } = req.query;
    const targetName = name ? name.toLowerCase() : null;
    const targetElo = elo ? parseInt(elo, 10) : null;

    if (!targetName && !targetElo) {
      return res.status(400).json({
        error: "Provide at least 'name' or 'elo' as query parameter"
      });
    }

    // pour l'instant on lit le top global (200 joueurs). On pourra élargir plus tard.
    const url = "https://api.clashroyale.com/v1/players/global/top";

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CLASH_API_TOKEN}`
      }
    });

    const players = response.data?.items || [];

    const matches = players.filter(p => {
      const okName = targetName
        ? (p.name || "").toLowerCase().includes(targetName)
        : true;

      const okElo = targetElo != null
        ? p.trophies === targetElo
        : true;

      return okName && okElo;
    });

    res.json({
      count: matches.length,
      players: matches.map(p => ({
        name: p.name,
        tag: p.tag,
        rank: p.rank,
        trophies: p.trophies
      }))
    });
  } catch (err) {
    console.error("Erreur search-ladder:", err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: "Unknown error" });
  }
});
app.listen(PORT, () => {
  console.log(`ZorkCham backend listening on port ${PORT}`);
});
