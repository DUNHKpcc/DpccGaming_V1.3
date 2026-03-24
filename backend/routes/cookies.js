const express = require('express');
const router = express.Router();
const { recordCookieConsent } = require('../controllers/cookieController');

router.post('/consent', recordCookieConsent);

module.exports = router;
