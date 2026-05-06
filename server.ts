import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import admin from "firebase-admin";

admin.initializeApp({ projectId: "gen-lang-client-0107261838" });
const db = admin.firestore();
db.settings({ databaseId: "ai-studio-9c567fd4-5e38-4ab1-949d-714df054d7a1" });

// ─── Discord OAuth constants ──────────────────────────────────────────────────
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1499744310667509793";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "DGor2BOU4xj-SDZpnd3oJo5LE2rWPa7j";
const NETWORK_SCHOOL_GUILD_ID = "900827411917201418";

// ─── Server ───────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ── Auth: Get Discord OAuth URL ──────────────────────────────────────────
  app.get("/api/auth/url", (req, res) => {
    res.json({ client_id: DISCORD_CLIENT_ID });
  });

  // ── Auth: OAuth Callback (passes code to frontend) ───────────────────────
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code } = req.query;
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener && window.opener !== window) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_CODE', code: '${code}' }, '*');
              window.close();
            } else {
              window.location.href = '/?code=${code}';
            }
          </script>
        </body>
      </html>
    `);
  });

  // ── Auth: Verify Discord code and return user ─────────────────────────────
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { code, redirectUri } = req.body;
      if (!code) return res.status(400).json({ error: "Missing code" });

      // 1. Exchange code for Discord token
      const tokenParams = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      });

      const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "NetworkPassApp (https://networkschool.com, 1.0.0)"
        },
        body: tokenParams
      });

      const tokenData = await tokenRes.json() as any;
      if (!tokenRes.ok) {
        console.error("Token exchange failed:", tokenData);
        return res.status(400).json({ error: `Token exchange failed: ${JSON.stringify(tokenData)}` });
      }

      // 2. Get Discord user info
      const userRes = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "NetworkPassApp (https://networkschool.com, 1.0.0)"
        }
      });
      const userData = await userRes.json() as any;
      if (!userRes.ok) return res.status(400).json({ error: "Failed to get Discord user." });

      // 3. Verify Network School guild membership
      const memberRes = await fetch(
        `https://discord.com/api/v10/users/@me/guilds/${NETWORK_SCHOOL_GUILD_ID}/member`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "User-Agent": "NetworkPassApp (https://networkschool.com, 1.0.0)"
          }
        }
      );
      const memberData = await memberRes.json() as any;
      if (!memberRes.ok) {
        return res.status(403).json({ error: "Not a member of Network School Discord." });
      }

      // 4. Firestore user storage
      const isAdmin = userData.email === "jalen@clayboylabs.com" || userData.email === "jalendnelson@gmail.com";
      const userPayload = {
        id: userData.id,
        discordId: userData.id,
        name: memberData.nick || userData.global_name || userData.username,
        email: userData.email,
        discordAvatar: userData.avatar,
        roles: ["Verified Member"],
        roleIds: memberData.roles || [],
        member: true,
        memberStatus: true,
        lastLogin: new Date().toISOString()
      };

      await db.collection("users").doc(userPayload.id).set(userPayload, { merge: true });

      return res.json({ ...userPayload, isAdmin });

    } catch (e: any) {
      console.error("Auth error:", e);
      return res.status(500).json({ error: e.message || "Internal Server Error" });
    }
  });

  // ── Admin API: Get all users ──────────────────────────────────────────────
  app.get("/api/admin/users", async (req, res) => {
    try {
      const snap = await db.collection("users").get();
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(docs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin API: Get all claims ─────────────────────────────────────────────
  app.get("/api/admin/claims", async (req, res) => {
    try {
      const snap = await db.collection("claims").get();
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const timeA = a.claimedAt?._seconds ? a.claimedAt._seconds * 1000 : (a.claimedAt ? new Date(a.claimedAt).getTime() : 0);
        const timeB = b.claimedAt?._seconds ? b.claimedAt._seconds * 1000 : (b.claimedAt ? new Date(b.claimedAt).getTime() : 0);
        return timeB - timeA;
      });
      res.json(docs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin API: Create claim ───────────────────────────────────────────────
  app.post("/api/admin/claims", async (req, res) => {
    try {
      const { userId, discordId, userName, partnerId, partnerName, offer, expiry } = req.body;
      const newClaim = {
        userId, discordId, userName, partnerId, partnerName, offer, expiry,
        claimedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      const docRef = await db.collection("claims").add(newClaim);
      res.json({ id: docRef.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin API: Get all partners ───────────────────────────────────────────
  app.get("/api/admin/partners", async (req, res) => {
    try {
      const snap = await db.collection("partners").get();
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?._seconds ? a.createdAt._seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?._seconds ? b.createdAt._seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      res.json(docs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin API: Create partner ─────────────────────────────────────────────
  app.post("/api/admin/partners", async (req, res) => {
    try {
      const { name, offer, status, expiry } = req.body;
      if (!name || !offer) return res.status(400).json({ error: "Name and offer are required" });
      const newPartner = {
        name, offer,
        status: status || "Active",
        expiry: expiry || "24",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      const docRef = await db.collection("partners").add(newPartner);
      const partnerDoc = await docRef.get();
      res.json({ id: docRef.id, ...partnerDoc.data() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin API: Update partner ─────────────────────────────────────────────
  app.put("/api/admin/partners/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, offer, status, expiry } = req.body;
      const updates = { name, offer, status, expiry, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      await db.collection("partners").doc(id).update(updates);
      res.json({ id, ...updates });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin API: Delete partner ─────────────────────────────────────────────
  app.delete("/api/admin/partners/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("partners").doc(id).delete();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Vite middleware ───────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
