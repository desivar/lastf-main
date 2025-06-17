const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// At the very top of your server.js
require('dotenv').config(); // Ensure this is the first line

const passport = require('passport'); // New
const GitHubStrategy = require('passport-github2').Strategy; // New
const session = require('express-session'); // New

const app = express();
const PORT = process.env.PORT || 5500;

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', // Allow your frontend to make requests
    credentials: true // Allow cookies/sessions to be sent
}));
app.use(express.json());

// Configure session middleware (important for Passport.js)
app.use(session({
    secret: 'your_secret_key', // Replace with a strong, random string from .env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/pipeline-manager')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Simple schemas (keep these as they are)
const userSchema = new mongoose.Schema({
    githubId: String, // Store GitHub's unique ID
    githubUsername: String,
    name: String,
    email: String,
    avatar: String
});
const User = mongoose.model('User', userSchema);

const pipelineSchema = new mongoose.Schema({
    name: String,
    description: String,
    steps: [String],
    jobCount: { type: Number, default: 0 },
    createdAt: { type: String, default: () => new Date().toISOString().split('T')[0] }
});
const Pipeline = mongoose.model('Pipeline', pipelineSchema);

const customerSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    activeJobs: { type: Number, default: 0 },
    totalJobs: { type: Number, default: 0 }
});
const Customer = mongoose.model('Customer', customerSchema);

const jobSchema = new mongoose.Schema({
    title: String,
    customer: String,
    pipeline: String,
    currentStep: String,
    status: { type: String, default: 'active' },
    dueDate: String,
    progress: { type: Number, default: 0 }
});
const Job = mongoose.model('Job', jobSchema);


// --- Passport.js Configuration ---
// ADD THIS TRY...CATCH BLOCK AND CONSOLE.LOGS AROUND YOUR PASSPORT.USE
try {
    console.log("Attempting to configure Passport.js GitHub Strategy...");
    console.log("GITHUB_CLIENT_ID check:", process.env.GITHUB_CLIENT_ID ? "Loaded" : "NOT LOADED");
    console.log("GITHUB_CLIENT_SECRET check:", process.env.GITHUB_CLIENT_SECRET ? "Loaded" : "NOT LOADED");
    console.log("CALLBACK_URL set in Passport strategy:", "http://localhost:5500/auth/github/callback"); // Verify this matches GitHub App

    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "http://localhost:5500/auth/github/callback" // This must match your GitHub App setting
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ githubId: profile.id });
            if (!user) {
                user = await User.create({
                    githubId: profile.id,
                    githubUsername: profile.username,
                    name: profile.displayName || profile.username,
                    email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
                    avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null
                });
                await createSampleData(); // Create sample data for new users
                console.log("New user created and sample data generated.");
            } else {
                // Check if sample data already exists for existing user
                const pipelinesCount = await Pipeline.countDocuments();
                if (pipelinesCount === 0) {
                    await createSampleData();
                    console.log("Sample data added for existing user.");
                } else {
                    console.log("Sample data already exists. Skipping creation for existing user.");
                }
            }
            console.log(`Passport callback: User ${profile.username} (${user.githubId}) processed.`); // ADDED LOG
            return done(null, user);
        } catch (error) {
            console.error('Error in GitHub strategy callback:', error); // ADDED LOG
            return done(error, null);
        }
    }));
    console.log("Passport.js GitHub Strategy configured successfully."); // ADDED LOG

} catch (e) {
    console.error("CRITICAL ERROR: Failed to configure Passport.js GitHub Strategy:", e); // ADDED LOG
}

// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user.id); // Store user ID in session
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user); // Attach user object to req.user
    } catch (error) {
        console.error('Error in deserializeUser:', error); // ADDED LOG
        done(error, null);
    }
});

// Ensure app.use(passport.initialize()) and app.use(passport.session()) are here
// (You've likely done this earlier in your server.js, just confirming their position)

// --- GitHub OAuth Routes ---
// This route initiates the GitHub login process
app.get('/auth/github',
    (req, res, next) => { // ADDED THIS MIDDLEWARE FOR LOGGING
        console.log("Received GET request for /auth/github. Initiating GitHub authentication.");
        next();
    },
    passport.authenticate('github', { scope: ['user:email'] }) // Request user email scope
);

// This is the callback route GitHub redirects to after authentication
app.get('/auth/github/callback',
    (req, res, next) => { // ADDED THIS MIDDLEWARE FOR LOGGING
        console.log("Received GET request for /auth/github/callback. Handling GitHub authentication callback.");
        next();
    },
    passport.authenticate('github', { failureRedirect: 'http://localhost:5173?auth=error' }),
    (req, res) => {
        console.log("GitHub authentication successful. Redirecting to frontend."); // ADDED LOG
        res.redirect('http://localhost:5173?auth=success');
    }
);

// ... (Rest of your API routes for /api/user, /api/jobs, etc.)

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend should be running on http://localhost:5173`);
});
