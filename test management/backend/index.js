const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

dotenv.config();

const authRouter = require('./router/auth');
const workspaceRouter = require('./router/workspace');
const app = express();
const port = Number(process.env.PORT) || 3000;
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');

app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/workspace', workspaceRouter);

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}!`);
});

if (process.env.MONGO) {
  mongoose
    .connect(process.env.MONGO)
    .then(() => console.log('Connected to MongoDB!'))
    .catch((error) => console.error('MongoDB connection failed:', error.message));
} else {
  console.warn('MONGO is not set. Login and registration require a MongoDB connection.');
}