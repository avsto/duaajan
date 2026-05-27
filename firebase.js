const admin = require("firebase-admin");

const serviceAccount = require(
  "./serviceAccountKey.json",
);

if (!admin.apps.length) {

  console.log(admin.apps);

  admin.initializeApp({
    credential:
      admin.credential.cert(
        serviceAccount,
      ),
  });
}

module.exports = admin;