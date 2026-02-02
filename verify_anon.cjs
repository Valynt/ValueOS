const jwt = require("jsonwebtoken");
const secret = "super-secret-jwt-token-with-at-least-32-characters-long";

const anonPayload = {
  role: "anon",
  iss: "supabase",
  iat: 1706745600,
  exp: 1864512000,
};
const anonToken = jwt.sign(anonPayload, secret);
console.log("ANON_KEY:");
console.log(anonToken);
