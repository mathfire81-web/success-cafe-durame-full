const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");

const COOKIE_NAME = "sc_admin_token";
const SALT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

function verifyAdminToken(token) {
  return jwt.verify(token, config.jwtSecret); // throws on invalid/expired
}

module.exports = { COOKIE_NAME, hashPassword, comparePassword, signAdminToken, verifyAdminToken };
