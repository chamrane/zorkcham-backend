import express from "express";
import axios from "axios";
import cors from "cors";
import * as cheerio from "cheerio";


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

// recherche dans le ladder (top 1-10000) par pseudo et/ou elo
// GET /search-ladder?elo=2664
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

    // On récupère le ladder global (top joueurs)
    // L'API retourne ~1000 joueurs par défaut, on va paginer pour aller jusqu'à 10k
    let allPlayers = [];
    const maxPlayers = 10000;
    const pageSize = 1000; // max par requête
    
    // On fait plusieurs requêtes pour couvrir le top 10k
    for (let offset = 0; offset < maxPlayers; offset += pageSize) {
      const url = `https://api.clashroyale.com/v1/locations/global/rankings/players?limit=${pageSize}`;
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${CLASH_API_TOKEN}`
        }
      });

      const items = response.data?.items || [];
      if (items.length === 0) break;

      allPlayers = allPlayers.concat(items);
      
      // Si on a atteint 10k ou s'il n'y a plus de joueurs, on arrête
      if (allPlayers.length >= maxPlayers || items.length < pageSize) {
        break;
      }
    }

    // Filtrer selon les critères
    const matches = allPlayers.filter(p => {
      const okName = targetName
        ? (p.name || "").toLowerCase().includes(targetName)
        : true;

      const okElo = targetElo != null
        ? Math.abs(p.trophies - targetElo) <= 10
        : true;

      return okName && okElo;
    });

    res.json({
      count: matches.length,
      totalScanned: allPlayers.length,
      players: matches.map(p => ({
        name: p.name,
        tag: p.tag,
        rank: p.rank,
        elo: p.trophies
      }))
    });
  } catch (err) {
    console.error("Erreur search-ladder:", err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: err.message || "Unknown error" });
  }
});

// DEBUG: tester l'endpoint leaderboard players
app.get("/debug-rankings", async (req, res) => {
  try {
    if (!CLASH_API_TOKEN) {
      return res.status(500).json({ error: "CLASH_API_TOKEN is not set" });
    }

    // Test avec le leaderboard global (pas de location)
    const url = "https://api.clashroyale.com/v1/players?limit=10";

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CLASH_API_TOKEN}`
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Erreur debug-rankings:", err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: err.message || "Unknown error" });
  }
});

// DEBUG: lister les locations disponibles
app.get("/debug-locations", async (req, res) => {
  try {
    if (!CLASH_API_TOKEN) {
      return res.status(500).json({ error: "CLASH_API_TOKEN is not set" });
    }

    const url = "https://api.clashroyale.com/v1/locations";

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CLASH_API_TOKEN}`
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Erreur debug-locations:", err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: err.message || "Unknown error" });
  }
});

// Scrape le ladder de RoyaleAPI et filtre par elo
// GET /scrape-ladder?elo=2664
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

    // On va sur la bonne page du ladder de RoyaleAPI
    const url = "https://royaleapi.com/players/leaderboard";
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const players = [];

    // On cherche les éléments HTML qui contiennent les joueurs
    // (on va devoir inspecter la page pour trouver les bons sélecteurs)
    $('tr').each((i, elem) => {
      const name = $(elem).find('.player_name').text().trim();
      const tag = $(elem).find('.player_tag').text().trim();
      const trophiesText = $(elem).find('.trophies').text().trim();
      const trophies = parseInt(trophiesText.replace(/,/g, ''), 10);

      if (name && tag && !isNaN(trophies)) {
        players.push({ name, tag, trophies });
      }
    });

    // Filtrer par Elo (±10)
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

    // On cherche les éléments HTML qui contiennent les joueurs
    // (cette partie dépend de la structure HTML de RoyaleAPI, on va l'adapter après test)
    $('tr').each((i, elem) => {
      const name = $(elem).find('.player_name').text().trim();
      const tag = $(elem).find('.player_tag').text().trim();
      const trophiesText = $(elem).find('.trophies').text().trim();
      const trophies = parseInt(trophiesText.replace(/,/g, ''), 10);

      if (name && tag && !isNaN(trophies)) {
        players.push({ name, tag, trophies });
      }
    });

    // Filtrer par Elo (±10)
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
