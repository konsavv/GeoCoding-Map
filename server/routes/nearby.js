const express = require('express');
const router = express.Router();
const axios = require('axios');

// find POIs of a category (coffee, restaurant, hotel, ...) around a point
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const params = new URLSearchParams({
      access_token: process.env.API_KEY,
      limit: 10,
      proximity: req.query.proximity || '0,0',
    });

    const results = await axios(
      `https://api.mapbox.com/search/searchbox/v1/category/${category}?${params}`
    );

    res.status(200).json(results.data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
