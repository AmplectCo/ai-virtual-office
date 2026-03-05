#!/usr/bin/env node
/**
 * Update GitHub Gist with active OpenClaw sessions
 * Runs every 30 seconds via systemd timer or cron
 */

const fs = require('fs');
const path = require('path');

// GitHub token and Gist ID (will be set after first creation)
const GITHUB_TOKEN = fs.readFileSync(path.join(__dirname, '../.github_gist_token'), 'utf8').trim();
const GIST_ID_FILE = path.join(__dirname, '.gist_id');

// Gateway URL and token (read from OpenClaw config or env)
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3380';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || ''; // Empty for local

// Telegram ID → Character mapping
const TELEGRAM_TO_CHAR = {
  '506059567': 'dmitriy',      // Дмитрий
  '337524124': 'artemius',     // Artemius
  '1140181642': 'pavel',       // Pavel
  '698546795': 'krasner',      // Alex Krasner
  '177845028': 'xamel1ion',    // Alex xamel1ion
  '5586780151': 'egor',        // Egor
  '1352356572': 'slava',       // Slava
  '16656494': 'molchan',       // Alexander Molchan
  '588611813': 'anton',        // Anton
  // Ilya's Telegram ID TBD
};

async function getActiveSessions() {
  // Call OpenClaw Gateway API to get sessions
  const headers = {
    'Content-Type': 'application/json'
  };
  if (GATEWAY_TOKEN) {
    headers['Authorization'] = `Bearer ${GATEWAY_TOKEN}`;
  }

  const response = await fetch(`${GATEWAY_URL}/api/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'list',
      limit: 50,
      kinds: ['agent:main']
    })
  });

  if (!response.ok) {
    throw new Error(`Gateway API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  return data.sessions
    .filter(s => {
      // Filter telegram DM sessions active in last 5 minutes
      if (!s.key.startsWith('agent:main:telegram:dm:')) return false;
      if (s.updatedAt < fiveMinutesAgo) return false;
      return true;
    })
    .map(s => {
      // Extract Telegram ID from key: "agent:main:telegram:dm:506059567"
      const parts = s.key.split(':');
      const telegramId = parts[parts.length - 1];
      return {
        telegramId,
        character: TELEGRAM_TO_CHAR[telegramId],
        lastActive: s.updatedAt
      };
    })
    .filter(s => s.character); // Only include mapped characters
}

async function updateGist(data) {
  const gistId = fs.existsSync(GIST_ID_FILE) 
    ? fs.readFileSync(GIST_ID_FILE, 'utf8').trim() 
    : null;

  const payload = {
    description: 'Amplect Office - Active Sessions',
    public: true,
    files: {
      'active-sessions.json': {
        content: JSON.stringify(data, null, 2)
      }
    }
  };

  const url = gistId 
    ? `https://api.github.com/gists/${gistId}` 
    : 'https://api.github.com/gists';
  
  const method = gistId ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Amplect-Office-Bot'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  
  // Save gist ID for future updates
  if (!gistId) {
    fs.writeFileSync(GIST_ID_FILE, result.id);
    console.log(`✅ Created new Gist: ${result.html_url}`);
    console.log(`📍 Raw URL: https://gist.githubusercontent.com/AmplectCo/${result.id}/raw/active-sessions.json`);
  }

  return result;
}

async function main() {
  try {
    console.log('⚠️  Gist updates are disabled. Exiting.');
    console.log('🔧 To re-enable, uncomment the code in update-sessions.js');
    process.exit(0);
    
    // DISABLED: Get active sessions from OpenClaw
    // const activeSessions = await getActiveSessions();
    
    // const activeCharacters = activeSessions.map(s => s.character);

    // const data = {
    //   timestamp: new Date().toISOString(),
    //   activeCharacters,
    //   sessions: activeSessions
    // };

    // DISABLED: Update Gist
    // await updateGist(data);
    
    // console.log(`[${data.timestamp}] Active: ${activeCharacters.join(', ') || 'none'}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
