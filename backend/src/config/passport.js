/**
 * Passport Google OAuth 2.0 Configuration
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GCP_OAUTH2_CLIENT_ID,
  clientSecret: process.env.GCP_OAUTH2_CLIENT_SECRET,
  // Allow the callback URL to be provided via environment (useful for ngrok or production domains)
  // If multiple comma-separated URIs are provided, pick the first one.
  callbackURL: (function() {
    const raw = process.env.GCP_OAUTH2_REDIRECT_URI || '';
    if (!raw) return '/auth/google/callback';
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) console.warn('⚠️  Multiple GCP_OAUTH2_REDIRECT_URI values found; using the first:', parts[0]);
    return parts[0];
  })()
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // If mongoose isn't connected yet, don't fail the OAuth flow.
    // Instead create a transient user-like object so the callback can continue
    // and generate tokens; persistence will be attempted later when DB is available.
    const mongoose = require('mongoose');
    const dbConnected = mongoose.connection && mongoose.connection.readyState !== 0;
    if (!dbConnected) {
      console.warn('⚠️  Google OAuth attempted while DB not connected - proceeding with transient user object');
      const transientUser = {
        googleId: profile.id,
        userId: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        email: (profile.emails && profile.emails[0] && profile.emails[0].value) || null,
        displayName: profile.displayName || null,
        firstName: (profile.name && profile.name.givenName) || null,
        lastName: (profile.name && profile.name.familyName) || null,
        profilePicture: (profile.photos && profile.photos[0] && profile.photos[0].value) || null,
        accessToken: accessToken,
        refreshToken: refreshToken,
        provider: 'google',
        isTransient: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return done(null, transientUser);
    }

    // Check if user exists (DB is connected)
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      // Update user data with latest info from Google
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
      user.lastLoginAt = new Date();
      await user.save();
      return done(null, user);
    }

    // Create new persistent user
    const newUser = new User({
      googleId: profile.id,
      userId: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      email: (profile.emails && profile.emails[0] && profile.emails[0].value) || null,
      displayName: profile.displayName || null,
      firstName: (profile.name && profile.name.givenName) || null,
      lastName: (profile.name && profile.name.familyName) || null,
      profilePicture: (profile.photos && profile.photos[0] && profile.photos[0].value) || null,
      accessToken: accessToken,
      refreshToken: refreshToken,
      provider: 'google',
      personality: {
        mode: 'friendly',
        voice: { gender: 'neutral', language: 'ja-JP' },
        responseStyle: { formality: 'polite', emoji: true }
      },
      preferences: {
        language: 'ja',
        theme: 'auto',
        notifications: {
          email: true,
          push: true,
          calendar: true
        }
      },
      permissions: {
        calendar: true,
        contacts: false,
        drive: false
      },
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newUser.save();
    return done(null, newUser);
  } catch (error) {
    console.error('Google OAuth Error:', error && error.message ? error.message : error);
    return done(error, null);
  }
}));

// Helpful debug warnings when env vars are missing
if (!process.env.GCP_OAUTH2_CLIENT_ID || !process.env.GCP_OAUTH2_CLIENT_SECRET) {
  console.warn('⚠️  Google OAuth client ID/secret are not set in environment variables. Set GCP_OAUTH2_CLIENT_ID and GCP_OAUTH2_CLIENT_SECRET in backend/.env or your shell.');
}

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
