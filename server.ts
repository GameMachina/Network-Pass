import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1499744310667509793";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "DGor2BOU4xj-SDZpnd3oJo5LE2rWPa7j";
const NS_AUTH_API_KEY = process.env.NS_AUTH_API_KEY || "nsauth_QMVI96jizkxs-lFOjDFzv7K8CQVfbDtoI8EKIECFVJU";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // OAuth endpoint that gives the authorize URL
  app.get('/api/auth/url', (req, res) => {
    // We construct the redirect URI using the host from the request or provide instructions
    // AI studio routes the request, so we can use the origin from the request headers if available, or just send a relative URL and frontend handles it.
    // Wait, the frontend calls this and passes the redirect URI? 
    // Yes, that's better securely.
    res.json({ client_id: DISCORD_CLIENT_ID });
  });

  // Callback handler for Discord OAuth
  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    
    // Send success message to parent window and close popup
    res.send(`
      <html>
        <body>
          <script>
            // We just pass the code. The main window will do the verification
            // so we don't block the popup. Or we can exchange here. 
            // Better to exchange here!
            if (window.opener && window.opener !== window) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_CODE', code: '${code}' }, '*');
              window.close();
            } else {
              window.location.href = '/?code=${code}';
            }
          </script>
          <p>Authentication successful. Completing login...</p>
        </body>
      </html>
    `);
  });

  // Verification endpoint called by the frontend after receiving the code
  app.post('/api/auth/verify', async (req, res) => {
    try {
      const { code, redirectUri } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "Missing code" });
      }

      // Step 1: Exchange Discord code for token
      const tokenParams = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      });

      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NetworkPassApp (https://networkschool.com, 1.0.0)'
        },
        body: tokenParams
      });
      
      const tokenText = await tokenRes.text();
      let tokenData;
      try {
        tokenData = JSON.parse(tokenText);
      } catch (e) {
        console.error("Failed to parse token response:", tokenText);
        return res.status(500).json({ error: `Discord Token Error: ${tokenRes.status} ${tokenRes.statusText}` });
      }
      
      if (!tokenRes.ok) {
        console.error("Token exchange failed:", tokenData);
        return res.status(400).json({ error: `Token exchange failed: ${JSON.stringify(tokenData)}` });
      }

      // Step 2: Get user info from Discord
      const userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'NetworkPassApp (https://networkschool.com, 1.0.0)'
        }
      });
      
      const userText = await userRes.text();
      let userData;
      try {
        userData = JSON.parse(userText);
      } catch (e) {
        console.error("Failed to parse user response:", userText);
        return res.status(500).json({ error: `Discord User Error: ${userRes.status} ${userRes.statusText}` });
      }
      
      if (!userRes.ok) {
        return res.status(400).json({ error: "Failed to get Discord user." });
      }

      // Step 3: Check if they are a member of Network School via Discord Guilds Member API
      const NETWORK_SCHOOL_GUILD_ID = '900827411917201418';
      const guildMemberRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${NETWORK_SCHOOL_GUILD_ID}/member`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'NetworkPassApp (https://networkschool.com, 1.0.0)'
        }
      });
      
      const guildMemberText = await guildMemberRes.text();
      let guildMemberData;
      try {
        guildMemberData = JSON.parse(guildMemberText);
      } catch (e) {
        console.error("Failed to parse guild member response:", guildMemberText);
        return res.status(500).json({ error: `Discord API Error: ${guildMemberRes.status} ${guildMemberRes.statusText}` });
      }

      if (!guildMemberRes.ok) {
        console.error("Failed to fetch guild member:", guildMemberData);
        return res.status(403).json({ error: `Not a member or lacking permissions: ${JSON.stringify(guildMemberData)}` });
      }
      
      // The user is a member. We can also get their role IDs from guildMemberData.roles
      const roleIds = guildMemberData.roles || [];
      
      // Identify them as a verified member if they are in the guild
      // We don't know the exact role name mapping without a bot token, but we have their role IDs
      
      // Verification successful
      return res.json({
        member: true,
        discordId: userData.id,
        name: guildMemberData.nick || userData.global_name || userData.username,
        email: userData.email,
        discordAvatar: userData.avatar,
        roles: ["Verified Member"], // Abstract name
        roleIds: roleIds
      });
      
    } catch (e: any) {
      console.error("Auth error", e);
      return res.status(500).json({ error: e.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
