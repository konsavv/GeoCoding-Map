const express = require('express');
const router = express.Router();
const axios = require('axios');

// coordinates come in as "lng,lat;lng,lat" (origin;destination)
router.get('/:coordinates', async (req, res) => {
  try {
    const { coordinates } = req.params;
    // only allow the profiles Mapbox supports
    const allowed = ['driving', 'walking', 'cycling', 'driving-traffic'];
    const profile = allowed.includes(req.query.profile)
      ? req.query.profile
      : 'driving';

    const params = new URLSearchParams({
      access_token: process.env.API_KEY,
      geometries: 'geojson',
      overview: 'full',
    });

    const results = await axios(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?${params}`
    );

    res.status(200).json(results.data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
