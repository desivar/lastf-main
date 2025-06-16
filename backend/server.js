const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pipeline-manager');

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
  // In real GitHub OAuth, you'd get user data from GitHub API
  // For simplicity, we'll just create/find user with github username
  try {
    let user = await User.findOne({ githubUsername: 'desivar' });
    
    if (!user) {
      // Create user and sample data
      user = await User.create({
        githubUsername: 'desivar',
        name: 'Desivar Developer',
        email: 'desivar@example.com',
        avatar: 'https://avatars.githubusercontent.com/u/1?v=4'
      });
      
      // Create sample data
      await createSampleData();
    }
    
    res.redirect('http://localhost:3000?auth=success');
  } catch (error) {
    res.redirect('http://localhost:3000?auth=error');
  }
});

// Get user info
app.get('/api/user', async (req, res) => {
  try {
    const user = await User.findOne({ githubUsername: 'desivar' });
    res.json(user || { error: 'User not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// Create job
app.post('/api/jobs', async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

// Create customer
app.post('/api/customers', async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Get all pipelines
app.get('/api/pipelines', async (req, res) => {
  try {
    const pipelines = await Pipeline.find();
    res.json(pipelines);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pipelines' });
  }
});

// Create pipeline
app.post('/api/pipelines', async (req, res) => {
  try {
    const pipeline = await Pipeline.create(req.body);
    res.json(pipeline);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

// Create sample data function
async function createSampleData() {
  // Sample pipelines
  await Pipeline.create([
    {
      name: "Web Development",
      description: "Standard web development workflow",
      steps: ["Initial Contact", "Requirements", "Design", "Development", "Testing", "Deployment"],
      jobCount: 2
    },
    {
      name: "Mobile App Development",
      description: "Mobile application development process",
      steps: ["Discovery", "Wireframes", "UI/UX", "Development", "Beta Testing", "App Store"],
      jobCount: 1
    }
  ]);

  // Sample customers
  await Customer.create([
    {
      name: "ABC Corp",
      email: "contact@abccorp.com",
      phone: "+1-555-0123",
      activeJobs: 1,
      totalJobs: 2
    },
    {
      name: "Tasty Bites",
      email: "info@tastybites.com",
      phone: "+1-555-0456",
      activeJobs: 1,
      totalJobs: 1
    },
    {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "+1-555-0789",
      activeJobs: 1,
      totalJobs: 1
    }
  ]);

  // Sample jobs
  await Job.create([
    {
      title: "E-commerce Website",
      customer: "ABC Corp",
      pipeline: "Web Development",
      currentStep: "Development",
      status: "active",
      dueDate: "2025-07-01",
      progress: 60
    },
    {
      title: "Restaurant App",
      customer: "Tasty Bites",
      pipeline: "Mobile App Development",
      currentStep: "UI/UX",
      status: "active",
      dueDate: "2025-07-15",
      progress: 30
    },
    {
      title: "Portfolio Site",
      customer: "Jane Smith",
      pipeline: "Web Development",
      currentStep: "Testing",
      status: "active",
      dueDate: "2025-06-20",
      progress: 85
    }
  ]);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`GitHub OAuth: http://localhost:${PORT}/auth/github/callback`);
});