import express from "express";
import axios from "axios";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

const CLASH_API_TOKEN = process.env.CLASH_API_TOKEN;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "ZorkCham Tool backend is running" });
});

app.get("/player-by-tag", async (req, res) => {
  try {
    if (!CLASH_API_TOKEN) {
      return res.status(500).json({ error: "CLASH_API_TOKEN is not set" });
    }

    const tag = req.query.tag;
    if (!tag) {
      return res.status(400).json({ error: "Missing 'tag' query parameter" });
    }

    const url = `https://api.clashroyale.com/v1/players/${encodeURIComponent(tag)}`;

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

app.get("/last-deck-by-tag", async (req, res) => {
  try {
    if (!CLASH_API_TOKEN) {
      return res.status(500).json({ error: "CLASH_API_TOKEN is not set" });
    }

    const tag = req.query.tag;
    if (!tag) {
      return res.status(400).json({ error: "Missing 'tag' query parameter" });
    }

    const url = `https://api.clashroyale.com/v1/players/${encodeURIComponent(tag)}/battlelog`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CLASH_API_TOKEN}`
      }
    });

    const battles = response.data;
    if (!Array.isArray(battles) || battles.length === 0) {
      return res.status(404).json({ error: "No battles found for this player" });
    }

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

app.get("/scrape-ladder", async (req, res) => {
  try {
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

    const url = "https://royaleapi.com/players/leaderboard";
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const players = [];

    $('tr').each((i, elem) => {
      const name = $(elem).find('.player_name').text().trim();
      const tag = $(elem).find('.player_tag').text().trim();
      const trophiesText = $(elem).find('.trophies').text().trim();
      const trophies = parseInt(trophiesText.replace(/,/g, ''), 10);

      if (name && tag && !isNaN(trophies)) {
        players.push({ name, tag, trophies });
      }
    });

    const matches = players.filter(p => Math.abs(p.trophies - targetElo) <= 10);

    res.json({
      count: matches.length,
      totalScanned: players.length,
      players: matches
    });
  } catch (err) {
    console.error("Erreur scrape-ladder:", err.message);
    res
      .status(500)
      .json({ error: "Failed to scrape ladder: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ZorkCham backend listening on port ${PORT}`);
});
