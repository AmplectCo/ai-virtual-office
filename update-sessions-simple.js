#!/usr/bin/env node
/**
 * Update GitHub Gist with active OpenClaw sessions
 * Reads from sessions-snapshot.json (updated by OpenClaw cron)
 */

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = fs.readFileSync(path.join(__dirname, '../.github_gist_token'), 'utf8').trim();
const GIST_ID_FILE = path.join(__dirname, '.gist_id');
const SESSIONS_SNAPSHOT = path.join(__dirname, 'sessions-snapshot.json');

// Telegram ID → Character mapping
const TELEGRAM_TO_CHAR = {
  '506059567': 'dmitriy',
  '337524124': 'artemius',
  '1140181642': 'pavel',
  '698546795': 'krasner',
  '177845028': 'xamel1ion',
  '5586780151': 'egor',
  '1352356572': 'slava',
  '16656494': 'molchan',
  '588611813': 'anton',
};

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
  
  if (!gistId) {
    fs.writeFileSync(GIST_ID_FILE, result.id);
    console.log(`✅ Created Gist: ${result.html_url}`);
  }

  return result;
}

async function main() {
  try {
    // Read snapshot created by OpenClaw cron
    if (!fs.existsSync(SESSIONS_SNAPSHOT)) {
      console.log('⏳ No sessions snapshot yet');
      process.exit(0);
    }

    const raw = JSON.parse(fs.readFileSync(SESSIONS_SNAPSHOT, 'utf8'));
    const sessions = Array.isArray(raw) ? raw : (raw.sessions || []);
    
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // Filter and map active sessions
    const activeSessions = sessions
      .filter(s => {
        // Support both formats: {key: "agent:main:telegram:dm:123"} and {telegramId: "123", active: true}
        if (s.telegramId) return s.active !== false;
        if (!s.key || !s.key.startsWith('agent:main:telegram:dm:')) return false;
        if (s.updatedAt && s.updatedAt < fiveMinutesAgo) return false;
        return true;
      })
      .map(s => {
        const telegramId = s.telegramId || s.key.split(':').pop();
        return {
          telegramId,
          character: TELEGRAM_TO_CHAR[telegramId],
          lastActive: s.updatedAt || s.lastActivity
        };
      })
      .filter(s => s.character);

    const data = {
      timestamp: new Date().toISOString(),
      activeCharacters: activeSessions.map(s => s.character)
    };

    await updateGist(data);
    
    const chars = data.activeCharacters.join(', ') || 'none';
    console.log(`[${data.timestamp}] Active: ${chars}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
