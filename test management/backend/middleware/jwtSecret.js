const secret = process.env.JWT_SECRET || 'development-only-change-this-secret';

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Using an insecure development-only secret.');
}

module.exports = secret;