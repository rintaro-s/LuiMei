const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Google Calendar integration
router.get('/calendar/events', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.isGoogleUser()) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication required for calendar access'
      });
    }

    if (!user.hasPermission('calendar.read')) {
      return res.status(403).json({
        success: false,
        message: 'Calendar read permission not granted'
      });
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_OAUTH2_CLIENT_ID,
      process.env.GCP_OAUTH2_CLIENT_SECRET,
      process.env.GCP_OAUTH2_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const { timeMin, timeMax, maxResults = 10 } = req.query;
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax,
      maxResults: parseInt(maxResults),
      singleEvents: true,
      orderBy: 'startTime'
    });

    res.json({
      success: true,
      data: {
        events: response.data.items,
        summary: {
          total: response.data.items.length,
          timeRange: { timeMin, timeMax }
        }
      }
    });
  } catch (error) {
    console.error('Calendar events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar events',
      error: error.message
    });
  }
});

router.post('/calendar/events', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.isGoogleUser()) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication required for calendar access'
      });
    }

    if (!user.hasPermission('calendar.write')) {
      return res.status(403).json({
        success: false,
        message: 'Calendar write permission not granted'
      });
    }

    const { summary, description, start, end, location } = req.body;

    if (!summary || !start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Summary, start, and end times are required'
      });
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_OAUTH2_CLIENT_ID,
      process.env.GCP_OAUTH2_CLIENT_SECRET,
      process.env.GCP_OAUTH2_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary,
      description,
      location,
      start: {
        dateTime: start,
        timeZone: user.preferences.timezone || 'Asia/Tokyo'
      },
      end: {
        dateTime: end,
        timeZone: user.preferences.timezone || 'Asia/Tokyo'
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    res.json({
      success: true,
      data: {
        event: response.data,
        message: 'Event created successfully'
      }
    });
  } catch (error) {
    console.error('Calendar event creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create calendar event',
      error: error.message
    });
  }
});

// Google Contacts integration
router.get('/contacts', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.isGoogleUser()) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication required for contacts access'
      });
    }

    if (!user.hasPermission('contacts.read')) {
      return res.status(403).json({
        success: false,
        message: 'Contacts read permission not granted'
      });
    }

    // Initialize Google People API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_OAUTH2_CLIENT_ID,
      process.env.GCP_OAUTH2_CLIENT_SECRET,
      process.env.GCP_OAUTH2_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken
    });

    const people = google.people({ version: 'v1', auth: oauth2Client });
    
    const { pageSize = 20 } = req.query;
    
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: parseInt(pageSize),
      personFields: 'names,emailAddresses,phoneNumbers,photos'
    });

    res.json({
      success: true,
      data: {
        contacts: response.data.connections || [],
        summary: {
          total: response.data.totalItems || 0,
          fetched: (response.data.connections || []).length
        }
      }
    });
  } catch (error) {
    console.error('Contacts fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts',
      error: error.message
    });
  }
});

// Google Drive integration
router.get('/drive/files', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.isGoogleUser()) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication required for Drive access'
      });
    }

    if (!user.hasPermission('drive.read')) {
      return res.status(403).json({
        success: false,
        message: 'Drive read permission not granted'
      });
    }

    // Initialize Google Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_OAUTH2_CLIENT_ID,
      process.env.GCP_OAUTH2_CLIENT_SECRET,
      process.env.GCP_OAUTH2_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const { q, pageSize = 20, orderBy = 'modifiedTime desc' } = req.query;
    
    const response = await drive.files.list({
      q: q || "mimeType!='application/vnd.google-apps.folder'",
      pageSize: parseInt(pageSize),
      orderBy,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)'
    });

    res.json({
      success: true,
      data: {
        files: response.data.files || [],
        summary: {
          fetched: (response.data.files || []).length,
          query: q
        }
      }
    });
  } catch (error) {
    console.error('Drive files fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Drive files',
      error: error.message
    });
  }
});

module.exports = router;
