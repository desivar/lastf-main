const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
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
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

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
        done(error, null);
    }
});


// --- GitHub OAuth Routes ---
// This route initiates the GitHub login process
app.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] }) // Request user email scope
);

// This is the callback route GitHub redirects to after authentication
app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: 'http://localhost:5173?auth=error' }),
    (req, res) => {
        // Successful authentication, redirect to frontend dashboard
        res.redirect('http://localhost:5173?auth=success');
    }
);

// Get user info (now using Passport's req.user)
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) { // Check if user is authenticated via session
        res.json(req.user);
    } else {
        // If not authenticated via session, try to retrieve the 'desivar' mock user
        // This is a fallback for testing without full auth, but should ideally be removed
        // in a production setup where all /api calls require authentication.
        User.findOne({ githubUsername: 'desivar' })
            .then(user => {
                res.json(user || { error: 'User not authenticated or found' });
            })
            .catch(error => {
                console.error('Failed to get mock user:', error);
                res.status(500).json({ error: 'Failed to get user' });
            });
    }
});
// --- Logout Route ---
app.get('/auth/logout', (req, res, next) => {
    // Passport.js's req.logout() function (requires a callback in newer versions)
    req.logout(function(err) {
        if (err) {
            console.error('Error during Passport.js logout:', err);
            return next(err); // Pass error to the next middleware
        }
        // Destroy the session to fully clear all session data
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ error: 'Failed to destroy session' });
            }
            // Clear the session cookie from the browser (default name for express-session is 'connect.sid')
            res.clearCookie('connect.sid');
            // Redirect the user back to the frontend's login page or home page
            res.redirect('http://localhost:5173');
        });
    });
});


// All other API routes (jobs, customers, pipelines, dashboard stats)
// You might want to protect these with req.isAuthenticated() middleware
// For now, leaving them as is, but be aware they are publicly accessible if not protected.
app.get('/api/jobs', async (req, res) => { /* ... existing code ... */
    try {
        const jobs = await Job.find();
        res.json(jobs);
    } catch (error) {
        console.error('Failed to get jobs:', error);
        res.status(500).json({ error: 'Failed to get jobs' });
    }
});
app.post('/api/jobs', async (req, res) => { /* ... existing code ... */
    if (!req.isAuthenticated()) { return res.status(401).json({ error: 'Unauthorized' }); }
    try {
        const job = await Job.create(req.body);
        res.status(201).json(job);
    } catch (error) {
        console.error('Failed to create job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});
app.get('/api/customers', async (req, res) => { /* ... existing code ... */
    try {
        const customers = await Customer.find();
        res.json(customers);
    } catch (error) {
        console.error('Failed to get customers:', error);
        res.status(500).json({ error: 'Failed to get customers' });
    }
});
app.post('/api/customers', async (req, res) => { /* ... existing code ... */
    if (!req.isAuthenticated()) { return res.status(401).json({ error: 'Unauthorized' }); }
    try {
        const customer = await Customer.create(req.body);
        res.status(201).json(customer);
    } catch (error) {
        console.error('Failed to create customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});
app.get('/api/pipelines', async (req, res) => { /* ... existing code ... */
    try {
        const pipelines = await Pipeline.find();
        res.json(pipelines);
    } catch (error) {
        console.error('Failed to get pipelines:', error);
        res.status(500).json({ error: 'Failed to get pipelines' });
    }
});
app.post('/api/pipelines', async (req, res) => { /* ... existing code ... */
    if (!req.isAuthenticated()) { return res.status(401).json({ error: 'Unauthorized' }); }
    try {
        const pipeline = await Pipeline.create(req.body);
        res.status(201).json(pipeline);
    } catch (error) {
        console.error('Failed to create pipeline:', error);
        res.status(500).json({ error: 'Failed to create pipeline' });
    }
});
app.get('/api/dashboard/stats', async (req, res) => { /* ... existing code ... */
    try {
        const activeJobs = await Job.countDocuments({ status: 'active' });
        const totalCustomers = await Customer.countDocuments();
        const totalPipelines = await Pipeline.countDocuments();

        const today = new Date();
        const next7Days = new Date();
        next7Days.setDate(today.getDate() + 7);

        const jobsDueThisWeek = await Job.countDocuments({
            dueDate: { $gte: today.toISOString().split('T')[0], $lte: next7Days.toISOString().split('T')[0] },
            status: 'active'
        });

        res.json({
            activeJobs,
            totalCustomers,
            totalPipelines,
            jobsDueThisWeek
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Function to create sample data
async function createSampleData() {
    console.log("Attempting to create sample data...");
    const pipelinesCount = await Pipeline.countDocuments();
    const customersCount = await Customer.countDocuments();
    const jobsCount = await Job.countDocuments();

    if (pipelinesCount === 0 && customersCount === 0 && jobsCount === 0) {
        await Pipeline.create([
            { name: "Web Development", description: "Standard web development workflow", steps: ["Initial Contact", "Requirements", "Design", "Development", "Testing", "Deployment"], jobCount: 2 },
            { name: "Mobile App Development", description: "Mobile application development process", steps: ["Discovery", "Wireframes", "UI/UX", "Development", "Beta Testing", "App Store"], jobCount: 1 }
        ]);
        await Customer.create([
            { name: "ABC Corp", email: "contact@abccorp.com", phone: "+1-555-0123", activeJobs: 1, totalJobs: 2 },
            { name: "Tasty Bites", email: "info@tastybites.com", phone: "+1-555-0456", activeJobs: 1, totalJobs: 1 },
            { name: "Jane Smith", email: "jane@example.com", phone: "+1-555-0789", activeJobs: 1, totalJobs: 1 }
        ]);
        await Job.create([
            { title: "E-commerce Website", customer: "ABC Corp", pipeline: "Web Development", currentStep: "Development", status: "active", dueDate: "2025-07-01", progress: 60 },
            { title: "Restaurant App", customer: "Tasty Bites", pipeline: "Mobile App Development", currentStep: "UI/UX", status: "active", dueDate: "2025-07-15", progress: 30 },
            { title: "Portfolio Site", customer: "Jane Smith", pipeline: "Web Development", currentStep: "Testing", status: "active", dueDate: "2025-06-20", progress: 85 }
        ]);
        console.log("Sample data created successfully.");
    } else {
        console.log("Sample data already exists. Skipping creation.");
    }
}


// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend should be running on http://localhost:5173`);
});