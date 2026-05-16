const passport      = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const User          = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        // Check if user already exists (email/password account or returning Google user)
        let user = await User.findOne({ email });

        if (user) {
          // Existing email/password user — link their Google ID and mark verified
          if (!user.googleId) {
            user.googleId  = profile.id;
            user.isVerified = true;
            await user.save();
          }
          return done(null, user);
        }

        // New user — create a Google-only account (no password)
        user = await User.create({
          name:       profile.displayName,
          email,
          googleId:   profile.id,
          isVerified: true,   // Google already verified the email
          password:   null,
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;