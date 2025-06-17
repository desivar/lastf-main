const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5500; // Consistent port for backend

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URL|| 'mongodb://localhost:27017/pipeline-manager')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Simple schemas
const userSchema = new mongoose.Schema({
  githubUsername: String,
  name: String,
  email: String,
  avatar: String
});

const pipelineSchema = new mongoose.Schema({
  name: String,
  description: String,
  steps: [String],
  jobCount: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

const customerSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  activeJobs: { type: Number, default: 0 },
  totalJobs: { type: Number, default: 0 }
});

const jobSchema = new mongoose.Schema({
  title: String,
  customer: String,
  pipeline: String,
  currentStep: String,
  status: { type: String, default: 'active' },
  dueDate: String,
  progress: { type: Number, default: 0 }
});

// Models
const User = mongoose.model('User', userSchema);
const Pipeline = mongoose.model('Pipeline', pipelineSchema);
const Customer = mongoose.model('Customer', customerSchema);
const Job = mongoose.model('Job', jobSchema);

// GitHub OAuth callback - simple version
app.get('/auth/github/callback', async (req, res) => {
  try {
    let user = await User.findOne({ githubUsername: 'desivar' });

    if (!user) {
      user = await User.create({
        githubUsername: 'desivar',
        name: 'Desivar Developer',
        email: 'desivar@example.com',
        avatar: 'https://avatars.githubusercontent.com/u/1?v=4'
      });
      await createSampleData();
      console.log("New user 'desivar' created and sample data generated.");
    } else {
      console.log("User 'desivar' already exists. Skipping creation.");
      // If user exists, ensure sample data is there. This prevents recreation on every login.
      const pipelinesCount = await Pipeline.countDocuments();
      if (pipelinesCount === 0) { // Check if sample data is missing
          await createSampleData();
          console.log("Sample data added for existing user.");
      } else {
          console.log("Sample data already exists. Skipping creation.");
      }
    }

    res.redirect('http://localhost:5173?auth=success'); // Redirect to your frontend's port
  } catch (error) {
    console.error("GitHub callback error:", error);
    res.redirect('http://localhost:5173?auth=error'); // Redirect to your frontend's port
  }
});

// Get user info
app.get('/api/user', async (req, res) => {
  try {
    const user = await User.findOne({ githubUsername: 'desivar' });
    res.json(user || { error: 'User not found' });
  } catch (error) {
    console.error('Failed to get user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find();
    res.json(jobs);
  } catch (error) {
    console.error('Failed to get jobs:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// Create job
app.post('/api/jobs', async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json(job); // Use 201 for resource created
  } catch (error) {
    console.error('Failed to create job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) {
    console.error('Failed to get customers:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

// Create customer
app.post('/api/customers', async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    console.error('Failed to create customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Get all pipelines
app.get('/api/pipelines', async (req, res) => {
  try {
    const pipelines = await Pipeline.find();
    res.json(pipelines);
  } catch (error) {
    console.error('Failed to get pipelines:', error);
    res.status(500).json({ error: 'Failed to get pipelines' });
  }
});

// Create pipeline
app.post('/api/pipelines', async (req, res) => {
  try {
    const pipeline = await Pipeline.create(req.body);
    res.status(201).json(pipeline);
  } catch (error) {
    console.error('Failed to create pipeline:', error);
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

// Get dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const activeJobs = await Job.countDocuments({ status: 'active' });
        const totalCustomers = await Customer.countDocuments();
        const totalPipelines = await Pipeline.countDocuments();

        const today = new Date();
        const next7Days = new Date();
        next7Days.setDate(today.getDate() + 7);

        // Simple string comparison for due date for demonstration.
        // For more robust date range queries, consider storing dates as Date objects in MongoDB.
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


// Start server and create sample data on initial run if DB is empty
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`GitHub OAuth: http://localhost:${PORT}/auth/github/callback`);
  // This will try to create sample data only if the collections are empty
  // await createSampleData(); // Moved this call into the /auth/github/callback to ensure user creation happens first
});