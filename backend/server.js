// server.js

require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();
const PORT = process.env.PORT || 5500; // Use port from .env or default to 5500
const MONGODB_URL = process.env.MONGODB_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

// --- Middleware ---
// CORS for frontend communication (adjust origin for production)
app.use(cors({
    origin: 'http://localhost:5173', // Allow your frontend to communicate
    credentials: true, // Allow cookies to be sent
}));

app.use(express.json()); // Body parser for JSON requests

// Session management
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URL,
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'interval',
        autoRemoveInterval: 10 // In minutes. Checks every 10 minutes.
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true, // Prevent client-side JS from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        sameSite: 'lax', // Protect against CSRF
    }
}));

// --- MongoDB Connection ---
mongoose.connect(MONGODB_URL)
    .then(() => {
        console.log('Connected to MongoDB');
        createSampleData(); // Create sample data after successful connection
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err.message);
        process.exit(1); // Exit process with failure
    });

// --- MongoDB Schemas & Models ---
const userSchema = new mongoose.Schema({
    githubId: { type: String, unique: true, sparse: true }, // Using sparse to allow multiple nulls if not GitHub
    githubUsername: { type: String, unique: true, sparse: true },
    name: String,
    email: String,
    avatarUrl: String,
    // You might add more fields as needed for your application
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const jobSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    customer: { type: String, required: true },
    pipeline: { type: String, required: true }, // Can be an ID ref if you make a Pipeline model
    currentStep: { type: String, required: true },
    status: { type: String, enum: ['active', 'completed', 'on-hold', 'cancelled'], default: 'active' },
    dueDate: { type: Date },
    progress: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

const customerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    activeJobs: { type: Number, default: 0 },
    totalJobs: { type: Number, default: 0 },
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);

const pipelineSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: String,
    steps: [String], // Array of strings for pipeline steps
    jobCount: { type: Number, default: 0 },
}, { timestamps: true });

const Pipeline = mongoose.model('Pipeline', pipelineSchema);

// --- Sample Data Creation Function ---
async function createSampleData() {
    try {
        let user = await User.findOne({ githubUsername: 'desivar' });

        if (!user) {
            console.log("Creating sample user 'desivar' and initial data...");
            user = new User({
                githubUsername: 'desivar',
                name: 'Desire Developer',
                email: 'desi@example.com',
                avatarUrl: 'https://avatars.githubusercontent.com/u/89487920?v=4' // Example GitHub avatar
            });
            await user.save();
        } else {
            console.log("User 'desivar' already exists. Checking for sample data...");
        }

        // Check if sample data exists for this user, if not, create it
        const existingJobs = await Job.countDocuments({ userId: user._id });
        if (existingJobs === 0) {
            await Promise.all([
                Job.create({
                    userId: user._id,
                    title: "E-commerce Website",
                    customer: "ABC Corp",
                    pipeline: "Web Development",
                    currentStep: "Development",
                    status: "active",
                    dueDate: new Date("2025-07-01"),
                    progress: 60
                }),
                Job.create({
                    userId: user._id,
                    title: "Restaurant App",
                    customer: "Tasty Bites",
                    pipeline: "Mobile App Development",
                    currentStep: "UI/UX",
                    status: "active",
                    dueDate: new Date("2025-07-15"),
                    progress: 30
                }),
                Job.create({
                    userId: user._id,
                    title: "Portfolio Site",
                    customer: "Jane Smith",
                    pipeline: "Web Development",
                    currentStep: "Testing",
                    status: "active",
                    dueDate: new Date("2025-06-20"),
                    progress: 85
                }),
                Customer.create({
                    userId: user._id,
                    name: "ABC Corp",
                    email: "contact@abccorp.com",
                    phone: "+1-555-0123",
                    activeJobs: 2,
                    totalJobs: 5
                }),
                Customer.create({
                    userId: user._id,
                    name: "Tasty Bites",
                    email: "info@tastybites.com",
                    phone: "+1-555-0456",
                    activeJobs: 1,
                    totalJobs: 2
                }),
                Pipeline.create({
                    userId: user._id,
                    name: "Web Development",
                    description: "Standard web development workflow",
                    steps: ["Initial Contact", "Requirements", "Design", "Development", "Testing", "Deployment"],
                    jobCount: 8
                }),
                Pipeline.create({
                    userId: user._id,
                    name: "Mobile App Development",
                    description: "Mobile application development process",
                    steps: ["Discovery", "Wireframes", "UI/UX", "Development", "Beta Testing", "App Store"],
                    jobCount: 3
                })
            ]);
            console.log("Sample data created for 'desivar'.");
        } else {
            console.log("Sample data already exists for 'desivar'. Skipping creation.");
        }
    } catch (error) {
        console.error("Error creating sample data:", error);
    }
}

// --- Authentication Middleware ---
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next(); // User is authenticated, proceed
    } else {
        res.status(401).json({ success: false, error: 'Authentication required' });
    }
};

// --- Routes ---

// Simulate GitHub authentication
app.post('/auth/github', async (req, res) => {
    // For this homework, we are simulating GitHub OAuth
    // In a real app, you'd exchange a code with GitHub, get user profile, etc.
    const { username } = req.body; // Expecting username from frontend for simulation

    if (!username) {
        return res.status(400).json({ success: false, error: 'Username is required for simulated login' });
    }

    try {
        let user = await User.findOne({ githubUsername: username });

        if (!user) {
            // If user doesn't exist, create them (this is part of the simulation)
            user = new User({
                githubUsername: username,
                name: username === 'desivar' ? 'Desire Developer' : username, // Example name based on username
                email: `${username}@example.com`,
                avatarUrl: `https://avatars.githubusercontent.com/u/89487920?v=4` // Generic or placeholder
            });
            await user.save();
            console.log(`Simulated user ${username} created.`);
            // When a new user is created via login, create their sample data
            // This is crucial for the frontend to have data immediately after logging in a new user.
            await createSampleData(); 
        }

        req.session.userId = user._id; // Store user ID in session
        req.session.githubUsername = user.githubUsername; // Store username in session
        
        console.log(`User ${user.githubUsername} logged in. Session ID: ${req.sessionID}`);
        res.status(200).json({ success: true, message: 'Simulated GitHub login successful', user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatarUrl,
            githubUsername: user.githubUsername
        }});

    } catch (error) {
        console.error('Error during simulated GitHub login:', error);
        res.status(500).json({ success: false, error: 'Internal server error during login' });
    }
});

// Logout route
app.post('/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ success: false, error: 'Could not log out' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
});

// Get authenticated user's details
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.status(200).json({
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatarUrl,
            githubUsername: user.githubUsername
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Dashboard stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const activeJobsCount = await Job.countDocuments({ userId: userId, status: 'active' });
        const totalCustomersCount = await Customer.countDocuments({ userId: userId });
        const totalPipelinesCount = await Pipeline.countDocuments({ userId: userId });
        
        // Calculate jobs due this week
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())); // Sunday
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)); // Saturday
        const jobsDueThisWeek = await Job.countDocuments({
            userId: userId,
            dueDate: { $gte: startOfWeek, $lte: endOfWeek },
            status: 'active'
        });

        res.status(200).json({
            activeJobs: activeJobsCount,
            totalCustomers: totalCustomersCount,
            totalPipelines: totalPipelinesCount,
            jobsDueThisWeek: jobsDueThisWeek
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});


// Jobs routes
app.get('/api/jobs', requireAuth, async (req, res) => {
    try {
        const jobs = await Job.find({ userId: req.session.userId }).sort({ createdAt: -1 });
        res.status(200).json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/jobs', requireAuth, async (req, res) => {
    try {
        const newJob = new Job({ ...req.body, userId: req.session.userId });
        await newJob.save();
        res.status(201).json({ success: true, message: 'Job added successfully', job: newJob });
    } catch (error) {
        console.error('Error adding job:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Customers routes
app.get('/api/customers', requireAuth, async (req, res) => {
    try {
        const customers = await Customer.find({ userId: req.session.userId }).sort({ createdAt: -1 });
        res.status(200).json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/customers', requireAuth, async (req, res) => {
    try {
        const newCustomer = new Customer({ ...req.body, userId: req.session.userId });
        await newCustomer.save();
        res.status(201).json({ success: true, message: 'Customer added successfully', customer: newCustomer });
    } catch (error) {
        console.error('Error adding customer:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Pipelines routes
app.get('/api/pipelines', requireAuth, async (req, res) => {
    try {
        const pipelines = await Pipeline.find({ userId: req.session.userId }).sort({ createdAt: -1 });
        res.status(200).json(pipelines);
    } catch (error) {
        console.error('Error fetching pipelines:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/pipelines', requireAuth, async (req, res) => {
    try {
        const newPipeline = new Pipeline({ ...req.body, userId: req.session.userId });
        await newPipeline.save();
        res.status(201).json({ success: true, message: 'Pipeline added successfully', pipeline: newPipeline });
    } catch (error) {
        console.error('Error adding pipeline:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});


// Fallback for undefined routes
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});