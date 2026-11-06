/* ============================================================
   Server settings — mirrors config/settings.py
   ============================================================ */

const path = require('path');

const BOOKING_MIN_NOTICE_HOURS = Number(process.env.BOOKING_MIN_NOTICE_HOURS || 0);
const BOOKING_MAX_ADVANCE_DAYS = Number(process.env.BOOKING_MAX_ADVANCE_DAYS || 90);

/* Dinkhub runs on TIME_ZONE = "Asia/Manila"; the port keeps that clock
   whatever machine the server happens to sit on. */
const TIME_ZONE = 'Asia/Manila';

module.exports = {
  BASE_DIR: path.join(__dirname, '..'),
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
  /* The Pickleball club app shares this origin, so both apps read and write
     the same localStorage database (key piklemarawi-db). */
  PICKLEBALL_DIR: path.join(__dirname, '..', 'pickleball'),
  DB_FILE: process.env.DINKHUB_DB || path.join(__dirname, '..', 'dinkhub.sqlite3'),
  UPLOAD_DIR: process.env.DINKHUB_MEDIA || path.join(__dirname, '..', 'media'),
  PORT: Number(process.env.PORT || 3000),
  SESSION_TTL_DAYS: 14,
  BOOKING_MIN_NOTICE_HOURS,
  BOOKING_MAX_ADVANCE_DAYS,
  BOOKING_MAX_PER_DAY: 3,
  TIME_ZONE,
  MEDIA_URL: '/media/'
};
