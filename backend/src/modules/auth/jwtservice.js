import jwt from 'jsonwebtoken';

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.ACCESS_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
    },
    process.env.REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_SECRET);
};

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};