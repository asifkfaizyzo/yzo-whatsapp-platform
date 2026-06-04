import jwt from 'jsonwebtoken';



//generate access token
const generateAccessToken = (payload) => {
return jwt.sign(
payload, process.env.ACCESS_SECRET, { expiresIn: '15m' }
  );
};



//generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};


//verify access token
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.ACCESS_SECRET);
};


//verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_SECRET);
};

export {
  generateAccessToken,generateRefreshToken,
  verifyAccessToken,verifyRefreshToken,
};